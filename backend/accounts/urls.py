from django.urls import path
from .views import RegisterView, SketchAPIView, VerifyEmailView, LoginView, ProfileAPIView, complete_profile, EditProfileAPIView, ForgotPasswordView, ResetPasswordView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('login/', LoginView.as_view(), name='login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('profile/', ProfileAPIView.as_view(), name='profile'),
    path('complete-profile/', complete_profile, name='complete_profile'),
    path('edit-profile/', EditProfileAPIView.as_view(), name='edit_profile'),
    path('sketches/', SketchAPIView.as_view(), name='sketches'),
    path('sketches/<int:sketch_id>/', SketchAPIView.as_view(), name='delete_sketch')
]