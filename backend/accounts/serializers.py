from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Sketch
import logging

logger = logging.getLogger(__name__)

class SketchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sketch
        fields = ['id', 'caption', 'image', 'created_at']
        read_only_fields = ['id', 'created_at', 'user']

    image = serializers.ImageField(use_url=True, allow_null=True)

class UserSerializer(serializers.ModelSerializer):
    sketches = SketchSerializer(many=True, read_only=True)
    avatar = serializers.ImageField(use_url=True, allow_null=True)

    class Meta:
        model = User
        fields = ['nickname', 'name', 'bio', 'avatar', 'sketches']

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        logger.info(f"Validating login data: {data}")
        identifier = data.get('identifier')
        password = data.get('password')

        if not identifier or not password:
            raise serializers.ValidationError('Будь ласка, введіть email/нікнейм та пароль')

        user = User.objects.filter(email=identifier).first() or User.objects.filter(nickname=identifier).first()
        logger.info(f"Found user: {user}")
        if not user:
            raise serializers.ValidationError('Користувача з таким email або нікнеймом не знайдено')

        logger.info(f"User email verified: {user.is_email_verified}")
        if not user.is_email_verified:
            raise serializers.ValidationError('Будь ласка, підтвердьте свій email')

        if not user.is_active:
            raise serializers.ValidationError('Обліковий запис неактивний')

        auth_user = authenticate(
            request=self.context.get('request'),
            username=user.nickname,
            password=password
        )
        logger.info(f"Authenticate result: {auth_user}")
        if not auth_user:
            raise serializers.ValidationError('Невірний пароль')

        data['user'] = auth_user
        return data

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        logger.info(f"Validating email: {value}")
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Користувача з таким email не знайдено')
        return value

class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        logger.info(f"Validating reset password data: {data}")
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        if new_password != confirm_password:
            raise serializers.ValidationError('Паролі не співпадають')
        return data