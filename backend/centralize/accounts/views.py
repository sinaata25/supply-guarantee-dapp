from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from rest_framework_simplejwt.tokens import RefreshToken

from eth_account.messages import encode_defunct
from web3 import Web3

from drf_spectacular.utils import extend_schema, OpenApiResponse

from django.conf import settings

from .models import Profile
from .sms import send_pattern_sms
from .ipfs import pin_file, pinata_configured
from .serializers import (
    NonceRequestSerializer,
    NonceResponseSerializer,
    VerifySerializer,
    TokenPairSerializer,
    ProfileSerializer,
    PublicProfileSerializer,
    NotifyOrderStageSerializer,
)

User = get_user_model()


def normalize_address(addr: str) -> str:
    # checksum + store lowercased
    return Web3.to_checksum_address(addr).lower()


def build_siwe_message(
    *, domain: str, address: str, uri: str, chain_id: int, nonce: str, issued_at
) -> str:
    """
    SIWE-style message. Formatting must remain stable because the user signs this exact string.
    """
    issued_at_str = issued_at.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    return (
        f"{domain} wants you to sign in with your Ethereum account:\n"
        f"{address}\n\n"
        f"Sign in to your dashboard.\n\n"
        f"URI: {uri}\n"
        f"Version: 1\n"
        f"Chain ID: {chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at_str}"
    )


class NonceView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Auth"],
        request=NonceRequestSerializer,
        responses={
            200: NonceResponseSerializer,
            400: OpenApiResponse(description="Invalid address or bad input"),
        },
        summary="Create nonce + SIWE-style message",
        description="Call this first. Sign the returned `message` with MetaMask, then call `/auth/verify/`.",
    )
    def post(self, request):
        s = NonceRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        raw_address = s.validated_data["address"]
        chain_id = s.validated_data.get("chain_id", 1)

        try:
            addr = normalize_address(raw_address)
        except Exception:
            return Response({"detail": "invalid address"}, status=400)

        # never trust frontend for these
        domain = request.get_host()  # includes port in dev
        uri = request.build_absolute_uri("/")  # e.g. http://127.0.0.1:8000/

        profile, _ = Profile.objects.get_or_create(wallet_address=addr)

        # always rotate on request
        profile.rotate_nonce(minutes_valid=5)
        profile.nonce_chain_id = chain_id
        profile.nonce_domain = domain
        profile.nonce_uri = uri
        profile.save(
            update_fields=[
                "nonce",
                "nonce_issued_at",
                "nonce_expires_at",
                "nonce_chain_id",
                "nonce_domain",
                "nonce_uri",
                "updated_at",
            ]
        )

        message = build_siwe_message(
            domain=profile.nonce_domain,
            address=profile.wallet_address,
            uri=profile.nonce_uri,
            chain_id=profile.nonce_chain_id,
            nonce=profile.nonce,
            issued_at=profile.nonce_issued_at,
        )

        return Response(
            {
                "address": profile.wallet_address,
                "chain_id": profile.nonce_chain_id,
                "nonce": profile.nonce,
                "issued_at": profile.nonce_issued_at,
                "expires_at": profile.nonce_expires_at,
                "domain": profile.nonce_domain,
                "uri": profile.nonce_uri,
                "message": message,
            }
        )


class VerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Auth"],
        request=VerifySerializer,
        responses={
            200: TokenPairSerializer,
            400: OpenApiResponse(description="Invalid input/signature/expired nonce"),
            401: OpenApiResponse(description="Signature does not match address"),
        },
        summary="Verify signature and issue JWT",
        description="Backend rebuilds the exact message from stored nonce metadata, verifies signature, then returns JWT.",
    )
    def post(self, request):
        s = VerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        raw_address = s.validated_data["address"]
        signature = s.validated_data["signature"]

        try:
            addr = normalize_address(raw_address)
        except Exception:
            return Response({"detail": "invalid address"}, status=400)

        try:
            profile = Profile.objects.get(wallet_address=addr)
        except Profile.DoesNotExist:
            return Response(
                {"detail": "unknown address (call /auth/nonce first)"}, status=400
            )

        if not profile.nonce_is_valid():
            return Response(
                {"detail": "nonce expired (call /auth/nonce again)"}, status=400
            )

        # rebuild the *exact* message the user signed
        message_text = build_siwe_message(
            domain=profile.nonce_domain,
            address=profile.wallet_address,
            uri=profile.nonce_uri,
            chain_id=profile.nonce_chain_id,
            nonce=profile.nonce,
            issued_at=profile.nonce_issued_at,
        )
        message = encode_defunct(text=message_text)

        try:
            recovered = Web3().eth.account.recover_message(message, signature=signature)
            recovered = normalize_address(recovered)
        except Exception:
            return Response({"detail": "invalid signature"}, status=400)

        if recovered != addr:
            return Response({"detail": "signature does not match address"}, status=401)

        # ensure there is a Django user for SimpleJWT
        user, _ = User.objects.get_or_create(username=addr)

        # rotate nonce immediately to prevent replay
        profile.rotate_nonce(minutes_valid=5)
        profile.save(
            update_fields=["nonce", "nonce_issued_at", "nonce_expires_at", "updated_at"]
        )

        refresh = RefreshToken.for_user(user)
        return Response({"refresh": str(refresh), "access": str(refresh.access_token)})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_profile(self, request) -> Profile:
        addr = (request.user.username or "").lower()
        return Profile.objects.get(wallet_address=addr)

    @extend_schema(
        tags=["Profile"],
        responses={200: ProfileSerializer},
        summary="Get my profile",
    )
    def get(self, request):
        profile = self.get_profile(request)
        return Response(ProfileSerializer(profile).data)

    @extend_schema(
        tags=["Profile"],
        request=ProfileSerializer,
        responses={200: ProfileSerializer},
        summary="Update my profile",
        description="Send JSON for normal updates, or multipart/form-data to upload `photo`.",
    )
    def patch(self, request):
        profile = self.get_profile(request)
        ser = ProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class NotifyOrderStageView(APIView):
    """Send a pattern SMS to the next actor when an order's stage changes.

    The frontend computes who must act next (their wallet address) and the
    Persian status text, then calls this endpoint. We look up that wallet's
    profile and, only if a phone number is on file, send the SMS.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Notify"],
        request=NotifyOrderStageSerializer,
        responses={200: OpenApiResponse(description="{ sent: bool, reason?: str }")},
        summary="SMS the next actor about an order stage change",
    )
    def post(self, request):
        s = NotifyOrderStageSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        raw_address = s.validated_data["wallet_address"]
        orderstage = s.validated_data["orderstage"]

        try:
            addr = normalize_address(raw_address)
        except Exception:
            return Response({"detail": "invalid address"}, status=400)

        try:
            profile = Profile.objects.get(wallet_address=addr)
        except Profile.DoesNotExist:
            return Response({"sent": False, "reason": "no profile"})

        phone = (profile.phone_number or "").strip()
        if not phone:
            return Response({"sent": False, "reason": "no phone"})

        result = send_pattern_sms(to=phone, params={"orderstage": orderstage})
        if result.get("ok"):
            return Response({"sent": True})
        return Response({"sent": False, "reason": result.get("detail")})


class IpfsUploadView(APIView):
    """Upload a document/photo to IPFS via Pinata (server-side credentials).

    The frontend sends multipart/form-data with a `file` field; we pin it and
    return the CIDv0 plus a gateway URL. The 32-byte sha2-256 digest inside the
    CID is what gets anchored on-chain as the DocSlot hash.
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["IPFS"],
        responses={200: OpenApiResponse(description="{ cid, gateway_url }")},
        summary="Pin a file to IPFS via Pinata",
    )
    def post(self, request):
        if not pinata_configured():
            return Response(
                {"detail": "IPFS uploads not configured on the server (missing Pinata secret/JWT)."},
                status=503,
            )

        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file field is required"}, status=400)
        if f.size > settings.IPFS_MAX_UPLOAD_BYTES:
            mb = settings.IPFS_MAX_UPLOAD_BYTES // (1024 * 1024)
            return Response({"detail": f"file too large (max {mb} MB)"}, status=400)

        uploader = (request.user.username or "").lower()
        result = pin_file(file_obj=f, filename=f.name, uploader=uploader)
        if not result.get("ok"):
            return Response({"detail": result.get("detail")}, status=502)

        cid = result["cid"]
        return Response({"cid": cid, "gateway_url": f"{settings.PINATA_GATEWAY}/{cid}"})


class ProfileListView(APIView):
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Profile"],
        responses={200: PublicProfileSerializer(many=True)},
        summary="List all profiles (basic info only)",
    )
    def get(self, request):
        profiles = Profile.objects.all().only(
            "wallet_address",
            "email",
        )
        serializer = PublicProfileSerializer(profiles, many=True)
        return Response(serializer.data)
