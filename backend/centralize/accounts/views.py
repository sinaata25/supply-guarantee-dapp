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

from .models import Profile
from .serializers import (
    NonceRequestSerializer,
    NonceResponseSerializer,
    VerifySerializer,
    TokenPairSerializer,
    ProfileSerializer,
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
