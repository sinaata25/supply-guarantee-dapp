from rest_framework import serializers
from .models import Profile


class NonceRequestSerializer(serializers.Serializer):
    address = serializers.CharField(help_text="Wallet address (0x...)")
    chain_id = serializers.IntegerField(
        required=False, default=1, min_value=1, help_text="EVM chain id (e.g. 1, 137)"
    )


class NonceResponseSerializer(serializers.Serializer):
    address = serializers.CharField()
    chain_id = serializers.IntegerField()
    nonce = serializers.CharField()
    issued_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField()
    domain = serializers.CharField()
    uri = serializers.CharField()
    message = serializers.CharField()


class VerifySerializer(serializers.Serializer):
    address = serializers.CharField(help_text="Wallet address (0x...)")
    signature = serializers.CharField(
        help_text="Signature produced by signing the message"
    )


class TokenPairSerializer(serializers.Serializer):
    refresh = serializers.CharField()
    access = serializers.CharField()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "wallet_address",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "photo",
            "bio",
        ]
        read_only_fields = ["wallet_address"]


class PublicProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["wallet_address", "email"]


class NotifyOrderStageSerializer(serializers.Serializer):
    wallet_address = serializers.CharField(help_text="Recipient wallet (the next actor)")
    orderstage = serializers.CharField(help_text="Persian status injected into the SMS pattern")
    order_id = serializers.CharField(required=False, allow_blank=True)
