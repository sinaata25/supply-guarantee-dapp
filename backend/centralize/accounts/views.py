from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from rest_framework_simplejwt.tokens import RefreshToken

from eth_account.messages import encode_defunct
from web3 import Web3

from django.contrib.auth import get_user_model

from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from .models import Profile
from .serializers import (
    VerifySerializer,
    ProfileSerializer,
    NonceRequestSerializer,
    NonceResponseSerializer,
)


User = get_user_model()


def normalize_address(addr: str) -> str:
    return Web3.to_checksum_address(addr).lower()


def build_login_message(address: str, nonce: str) -> str:
    return f"Atomicmail login\nAddress: {address}\nNonce: {nonce}"


def normalize_address(addr: str) -> str:
    return Web3.to_checksum_address(addr).lower()


def build_siwe_message(
    *,
    domain: str,
    address: str,
    statement: str,
    uri: str,
    chain_id: int,
    nonce: str,
    issued_at,
):
    # Keep formatting stable. Don’t add extra spaces/newlines later.
    issued_at_str = issued_at.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    statement_block = f"{statement}\n\n" if statement else ""

    return (
        f"{domain} wants you to sign in with your Ethereum account:\n"
        f"{address}\n\n"
        f"{statement_block}"
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
        operation_id="auth_nonce_create",
        summary="Create nonce and SIWE-style message to sign",
        description=(
            "Returns a short-lived nonce and a SIWE-style message.\n\n"
            "Frontend should sign the returned `message` with MetaMask and then call `/auth/verify/`."
        ),
    )
    def post(self, request):
        s = NonceRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        raw_address = s.validated_data["address"]
        chain_id = s.validated_data.get("chain_id", 1)
        statement = s.validated_data.get("statement") or "Sign in to your dashboard."

        try:
            addr = normalize_address(raw_address)
        except Exception:
            return Response({"detail": "invalid address"}, status=400)

        domain = request.get_host()
        uri = request.build_absolute_uri("/")

        issued_at = timezone.now()
        expires_at = issued_at + timedelta(minutes=5)

        profile, _ = Profile.objects.get_or_create(wallet_address=addr)

        profile.rotate_nonce()
        profile.nonce_chain_id = chain_id
        profile.nonce_domain = domain
        profile.nonce_uri = uri
        profile.nonce_statement = statement
        profile.nonce_issued_at = issued_at
        profile.nonce_expires_at = expires_at
        profile.save(
            update_fields=[
                "nonce",
                "nonce_chain_id",
                "nonce_domain",
                "nonce_uri",
                "nonce_statement",
                "nonce_issued_at",
                "nonce_expires_at",
                "updated_at",
            ]
        )

        message = build_siwe_message(
            domain=profile.nonce_domain,
            address=profile.wallet_address,
            statement=profile.nonce_statement,
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
                "statement": profile.nonce_statement,
                "message": message,
            }
        )


class VerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=VerifySerializer,
        responses={
            200: OpenApiResponse(description="JWT tokens returned"),
            400: OpenApiResponse(description="Invalid input/signature"),
            401: OpenApiResponse(description="Signature does not match address"),
        },
    )
    def post(self, request):
        s = VerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        try:
            addr = normalize_address(s.validated_data["address"])
        except Exception:
            return Response({"detail": "invalid address"}, status=400)

        signature = s.validated_data["signature"]

        try:
            profile = Profile.objects.get(wallet_address=addr)
        except Profile.DoesNotExist:
            return Response(
                {"detail": "unknown address (call /auth/nonce first)"}, status=400
            )

        message_text = build_login_message(profile.wallet_address, profile.nonce)
        message = encode_defunct(text=message_text)

        try:
            recovered = Web3().eth.account.recover_message(message, signature=signature)
            recovered = normalize_address(recovered)
        except Exception:
            return Response({"detail": "invalid signature"}, status=400)

        if recovered != addr:
            return Response({"detail": "signature does not match address"}, status=401)

        # create/get a Django user for SimpleJWT
        user, _ = User.objects.get_or_create(username=addr)

        # rotate nonce to prevent replay
        profile.rotate_nonce()
        profile.save(update_fields=["nonce", "updated_at"])

        refresh = RefreshToken.for_user(user)
        return Response({"refresh": str(refresh), "access": str(refresh.access_token)})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_profile(self, request):
        addr = request.user.username  # wallet address
        return Profile.objects.get(wallet_address=addr)

    @extend_schema(responses={200: ProfileSerializer})
    def get(self, request):
        profile = self.get_profile(request)
        return Response(ProfileSerializer(profile).data)

    @extend_schema(
        request=ProfileSerializer,  # good enough; Spectacular will render file fields with multipart
        responses={200: ProfileSerializer},
    )
    def patch(self, request):
        profile = self.get_profile(request)
        ser = ProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
