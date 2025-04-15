from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings
from .models import User
from .utils import generate_verification_token, verify_token
from django.http import HttpResponseRedirect

class RegisterView(APIView):
    def post(self, request):
        print("Received request data:", request.data)
        username = request.data.get('name')
        nickname = request.data.get('nickname')
        email = request.data.get('email')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        missing_fields = []
        if not username:
            missing_fields.append('name')
        if not nickname:
            missing_fields.append('nickname')
        if not email:
            missing_fields.append('email')
        if not password:
            missing_fields.append('password')
        if not confirm_password:
            missing_fields.append('confirm_password')

        if missing_fields:
            print("Missing fields:", missing_fields)
            return Response({'error': f'Ці поля обов’язкові: {", ".join(missing_fields)}'}, status=status.HTTP_400_BAD_REQUEST)

        if password != confirm_password:
            print("Passwords do not match")
            return Response({'error': 'Паролі не співпадають'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            print(f"Email {email} already exists")
            return Response({'error': 'Email уже зареєстровано'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            print("Creating user with:", {"nickname": nickname, "email": email, "first_name": username})
            user = User.objects.create_user(
                nickname=nickname,
                email=email,
                password=password,
                first_name=username,
                last_name='',
                is_email_verified=False
            )
            print("User created successfully:", user.email)
        except Exception as e:
            print("Error creating user:", str(e))
            return Response({'error': f'Помилка створення користувача: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        token = generate_verification_token(email)
        verification_url = f"http://localhost:4200/verify-success/{token}"

        subject = 'Підтвердження email для Macrame'
        message = f'Привіт, {username}!\n\nБудь ласка, підтвердь свій email, перейшовши за посиланням:\n{verification_url}\n\nДякуємо!'
        html_message = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Привіт, {username}!</h2>
            <p>Дякуємо за реєстрацію в Macrame!</p>
            <p>Будь ласка, підтвердь свій email, натиснувши на кнопку нижче:</p>
            <a href="{verification_url}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Підтвердити</a>
            <p>Дякуємо!</p>
          </body>
        </html>
        """
        try:
            print("Sending email to:", email)
            send_mail(
                subject,
                message,
                f"Macrame Support <{settings.DEFAULT_FROM_EMAIL}>",
                [email],
                fail_silently=False,
                html_message=html_message  # Додаємо HTML-версію
            )
            print(f"Лист успішно відправлено на {email}")
        except Exception as e:
            print(f"Помилка відправлення email: {e}")
            return Response({'error': f'Помилка відправлення email: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': 'Реєстрація успішна! Перевір email для підтвердження.'}, status=status.HTTP_201_CREATED)

class VerifyEmailView(APIView):
    def get(self, request, token):
        email = verify_token(token)
        if email:
            try:
                user = User.objects.get(email=email)
                if not user.is_email_verified:
                    user.is_email_verified = True
                    user.save()
                    return HttpResponseRedirect(f"http://localhost:4200/verify-success/{token}?verified=true")
                return HttpResponseRedirect(f"http://localhost:4200/verify-success/{token}?verified=true")
            except User.DoesNotExist:
                return HttpResponseRedirect(f"http://localhost:4200/verify-success/{token}?verified=false")
        return HttpResponseRedirect(f"http://localhost:4200/verify-success/{token}?verified=false")