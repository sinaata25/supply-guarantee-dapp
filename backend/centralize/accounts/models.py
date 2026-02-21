import secrets
from django.db import models
from django.core.validators import RegexValidator


def profile_photo_path(instance, filename):
    return f"profiles/{instance.wallet_address}/{filename}"


phone_validator = RegexValidator(
    regex=r"^\+?[0-9]{7,15}$",
    message="Phone number must be 7-15 digits, optionally starting with +",
)


class Profile(models.Model):
    wallet_address = models.CharField(max_length=42, unique=True)  # 0x + 40 hex
    nonce = models.CharField(max_length=64, default=secrets.token_hex)

    first_name = models.CharField(max_length=120, blank=True)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone_number = models.CharField(
        max_length=16, blank=True, validators=[phone_validator]
    )

    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to=profile_photo_path, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def rotate_nonce(self):
        self.nonce = secrets.token_hex(16)

    def save(self, *args, **kwargs):
        # normalize stored wallet address
        if self.wallet_address:
            self.wallet_address = self.wallet_address.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.wallet_address
