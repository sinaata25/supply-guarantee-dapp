from django.urls import path
from .views import NonceView, VerifyView, MeView

urlpatterns = [
    path("auth/nonce/", NonceView.as_view()),
    path("auth/verify/", VerifyView.as_view()),
    path("me/", MeView.as_view()),
]
