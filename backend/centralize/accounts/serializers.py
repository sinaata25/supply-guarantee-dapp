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
