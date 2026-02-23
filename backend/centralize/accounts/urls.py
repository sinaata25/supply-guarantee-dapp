from django.urls import path
from .views import NonceView, VerifyView, MeView, ProfileListView

urlpatterns = [
    path("auth/nonce/", NonceView.as_view()),
    path("auth/verify/", VerifyView.as_view()),
    path("me/", MeView.as_view()),
    path("me/all/", ProfileListView.as_view()),
]
