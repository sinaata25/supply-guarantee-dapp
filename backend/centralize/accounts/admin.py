from django.contrib import admin
from django.utils.html import format_html
from django.utils.text import Truncator

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "wallet_address",
        "first_name",
        "last_name",
        "email",
        "phone_number",
        "photo_thumb",
        "short_bio",
        "created_at",
        "updated_at",
    )
    list_filter = ("created_at", "updated_at")
    search_fields = (
        "wallet_address",
        "first_name",
        "last_name",
        "email",
        "phone_number",
        "bio",
    )
    ordering = ("-updated_at",)

    readonly_fields = (
        "wallet_address",
        "nonce",
        "created_at",
        "updated_at",
        "photo_preview",
    )

    fieldsets = (
        ("Identity", {"fields": ("wallet_address", "nonce")}),
        ("Contact", {"fields": ("first_name", "last_name", "email", "phone_number")}),
        ("Profile", {"fields": ("bio", "photo", "photo_preview")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    actions = ("rotate_nonce_action",)

    @admin.display(description="Bio")
    def short_bio(self, obj: Profile) -> str:
        return Truncator(obj.bio or "").chars(60)

    @admin.display(description="Photo")
    def photo_thumb(self, obj: Profile) -> str:
        if obj.photo and hasattr(obj.photo, "url"):
            return format_html(
                '<img src="{}" style="height:32px;width:32px;object-fit:cover;border-radius:50%;" />',
                obj.photo.url,
            )
        return "—"

    @admin.display(description="Photo preview")
    def photo_preview(self, obj: Profile) -> str:
        if obj.photo and hasattr(obj.photo, "url"):
            return format_html(
                '<img src="{}" style="max-height:220px;max-width:220px;object-fit:cover;border-radius:12px;border:1px solid #ddd;" />',
                obj.photo.url,
            )
        return "No photo uploaded"

    @admin.action(description="Rotate nonce for selected profiles")
    def rotate_nonce_action(self, request, queryset):
        updated = 0
        for profile in queryset:
            profile.rotate_nonce()
            profile.save(update_fields=["nonce", "updated_at"])
            updated += 1
        self.message_user(request, f"Rotated nonce for {updated} profile(s).")
