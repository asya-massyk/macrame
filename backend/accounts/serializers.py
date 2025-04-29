from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        print(f"Validating login data: {data}")
        identifier = data.get('identifier')
        password = data.get('password')

        if not identifier or not password:
            raise serializers.ValidationError('Будь ласка, введіть email/нікнейм та пароль')

        user = User.objects.filter(email=identifier).first() or User.objects.filter(nickname=identifier).first()
        print(f"Found user: {user}")
        if not user:
            raise serializers.ValidationError('Користувача з таким email або нікнеймом не знайдено')

        print(f"User email verified: {user.is_email_verified}")
        if not user.is_email_verified:
            raise serializers.ValidationError('Будь ласка, підтвердьте свій email')

        if not user.is_active:
            raise serializers.ValidationError('Обліковий запис неактивний')

        auth_user = authenticate(
            request=self.context.get('request'),
            username=user.nickname,
            password=password
        )
        print(f"Authenticate result: {auth_user}")
        if not auth_user:
            raise serializers.ValidationError('Невірний пароль')

        data['user'] = auth_user
        return data