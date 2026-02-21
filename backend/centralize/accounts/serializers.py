from rest_framework import serializers
from .models import Profile


class VerifySerializer(serializers.Serializer):
    address = serializers.CharField()
    signature = serializers.CharField()


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


class NonceRequestSerializer(serializers.Serializer):
    address = serializers.CharField()
    chain_id = serializers.IntegerField(required=False, default=1, min_value=1)
    statement = serializers.CharField(required=False, allow_blank=True, max_length=255)


from rest_framework import serializers


class NonceRequestSerializer(serializers.Serializer):
    address = serializers.CharField(help_text="Wallet address (0x...)")
    chain_id = serializers.IntegerField(
        required=False, default=1, min_value=1, help_text="EVM chain id (e.g. 1, 137)"
    )
    statement = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        help_text="Optional human-readable message shown to the user",
    )


class NonceResponseSerializer(serializers.Serializer):
    address = serializers.CharField()
    chain_id = serializers.IntegerField()
    nonce = serializers.CharField()
    issued_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField()
    domain = serializers.CharField()
    uri = serializers.CharField()
    statement = serializers.CharField()
    message = serializers.CharField()
