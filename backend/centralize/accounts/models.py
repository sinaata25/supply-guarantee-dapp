import secrets
from datetime import timedelta

from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone


def profile_photo_path(instance, filename: str) -> str:
    return f"profiles/{instance.wallet_address}/{filename}"


phone_validator = RegexValidator(
    regex=r"^\+?[0-9]{7,15}$",
    message="Phone number must be 7-15 digits, optionally starting with +",
)


class Profile(models.Model):
    # Wallet identity
    wallet_address = models.CharField(max_length=42, unique=True)  # 0x + 40 hex
    nonce = models.CharField(max_length=64, blank=True, default="")

    # Profile fields
    first_name = models.CharField(max_length=120, blank=True)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone_number = models.CharField(
        max_length=16,
        blank=True,
        validators=[phone_validator],
    )
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to=profile_photo_path, blank=True, null=True)

    # Nonce metadata (server-controlled, used to rebuild the exact login message)
    nonce_issued_at = models.DateTimeField(null=True, blank=True)
    nonce_expires_at = models.DateTimeField(null=True, blank=True)
    nonce_chain_id = models.PositiveIntegerField(default=1)
    nonce_domain = models.CharField(max_length=255, blank=True)
    nonce_uri = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # -------------------------
    # Helpers
    # -------------------------

    def rotate_nonce(self, minutes_valid: int = 5) -> None:
        now = timezone.now()
        self.nonce = secrets.token_hex(16)
        self.nonce_issued_at = now
        self.nonce_expires_at = now + timedelta(minutes=minutes_valid)

    def nonce_is_valid(self) -> bool:
        return bool(
            self.nonce
            and self.nonce_expires_at
            and timezone.now() <= self.nonce_expires_at
        )

    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def save(self, *args, **kwargs):
        if self.wallet_address:
            self.wallet_address = self.wallet_address.lower()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.full_name() or self.wallet_address

    class Meta:
        indexes = [
            models.Index(fields=["wallet_address"]),
            models.Index(fields=["email"]),
            models.Index(fields=["phone_number"]),
        ]
