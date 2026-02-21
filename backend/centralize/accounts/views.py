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
from .serializers import VerifySerializer, ProfileSerializer

User = get_user_model()


def normalize_address(addr: str) -> str:
    return Web3.to_checksum_address(addr).lower()


def build_login_message(address: str, nonce: str) -> str:
    return f"Atomicmail login\nAddress: {address}\nNonce: {nonce}"


class NonceView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="address",
                description="Wallet address (0x...)",
                required=True,
                type=str,
            ),
        ],
        responses={
            200: OpenApiResponse(description="Nonce + message to sign"),
            400: OpenApiResponse(description="Missing/invalid address"),
        },
    )
    def get(self, request):
        address = request.query_params.get("address")
        if not address:
            return Response({"detail": "address is required"}, status=400)

        try:
            addr = normalize_address(address)
        except Exception:
            return Response({"detail": "invalid address"}, status=400)

        profile, created = Profile.objects.get_or_create(wallet_address=addr)
        if created or not profile.nonce:
            profile.rotate_nonce()
            profile.save(update_fields=["nonce"])

        return Response(
            {
                "address": profile.wallet_address,
                "nonce": profile.nonce,
                "message": build_login_message(profile.wallet_address, profile.nonce),
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
