from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings
from .models import User
from .utils import generate_verification_token, verify_token
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import LoginSerializer

class LoginView(APIView):
    def post(self, request):
        print(f"Login request data: {request.data}")
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            print(f"Returning tokens for user: {user}")
            return Response({
                'token': str(refresh.access_token),
                'refresh': str(refresh)
            }, status=status.HTTP_200_OK, headers={'Content-Type': 'application/json; charset=utf-8'})
        print(f"Serializer errors: {serializer.errors}")
        # Перетворюємо помилки в рядок, щоб уникнути проблем із кодуванням
        error_message = str(serializer.errors.get('non_field_errors', ['Помилка авторизації'])[0])
        return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST, headers={'Content-Type': 'application/json; charset=utf-8'})
    
class RegisterView(APIView):
    def post(self, request):
        print("Received request data:", request.data)
        username = request.data.get('name')
        nickname = request.data.get('nickname')
        email = request.data.get('email')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        # Validate required fields
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
            return Response(
                {'error': f'Ці поля обов\'язкові: {", ".join(missing_fields)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate password match
        if password != confirm_password:
            print("Passwords do not match")
            return Response(
                {'error': 'Паролі не співпадають'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email exists
        existing_user = User.objects.filter(email=email).first()
        print(f"Checking existing user for email {email}: {existing_user}")
        if existing_user:
            print(f"Email {email} already exists, verified: {existing_user.is_email_verified}")
            if existing_user.is_email_verified:
                return Response(
                    {'error': 'Цей email вже зареєстровано і підтверджено'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                self.send_verification_email(existing_user)
                return Response(
                    {
                        'message': 'Цей email вже зареєстровано, але не підтверджено. '
                                  'Ми надіслали новий лист для підтвердження.'
                    },
                    status=status.HTTP_200_OK
                )

        try:
            print("Creating user with:", {
                "nickname": nickname,
                "email": email,
                "first_name": username
            })
            user = User.objects.create_user(
                nickname=nickname,
                email=email,
                password=password,
                first_name=username,
                last_name='',
                is_email_verified=False
            )
            print("User created successfully:", user.email)
            
            self.send_verification_email(user)
            
            return Response(
                {
                    'message': 'Реєстрація успішна! Перевірте ваш email для підтвердження.',
                    'user_id': user.id
                },
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            print("Error creating user:", str(e))
            return Response(
                {'error': f'Помилка створення користувача: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def send_verification_email(self, user):
        token = generate_verification_token(user.email)
        verification_url = f"http://localhost:4200/verify-email?token={token}"
        subject = 'Підтвердження email для Macrame'
        html_message = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Привіт, {user.first_name}!</h2>
        <p>Дякуємо за реєстрацію в Macrame!</p>
        <p>Будь ласка, підтвердіть свій email, натиснувши на кнопку нижче:</p>
        <a href="{verification_url}" target="_self" style="display: inline-block; padding: 10px 20px; 
            background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
            Підтвердити Email
        </a>
        <p>Якщо ви не реєструвались на нашому сайті, проігноруйте це повідомлення.</p>
        <p>Дякуємо!</p>
      </body>
    </html>
    """
        
        try:
            print(f"Sending verification email to: {user.email}")
            send_mail(
                subject,
                '',
                f"Macrame Support <{settings.DEFAULT_FROM_EMAIL}>",
                [user.email],
                fail_silently=False,
                html_message=html_message
            )
            print(f"Verification email sent to {user.email}")
        except Exception as e:
            print(f"Failed to send verification email: {str(e)}")
            raise

class VerifyEmailView(APIView):
    def get(self, request):
        token = request.query_params.get('token')
        print(f"Verification token received: {token}")
        if not token:
            print("No token provided")
            return Response({
                'status': 'error',
                'message': 'Токен не надано'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            email = verify_token(token)
            print(f"Decoded email: {email}")
            
            if not email:
                print("Token verification failed - no email decoded")
                return Response({
                    'status': 'error',
                    'message': 'Недійсний або прострочений токен'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            user = User.objects.filter(email=email).first()
            print(f"User lookup: email={email}, found user={user}")
            if not user:
                print(f"User not found for email: {email}")
                return Response({
                    'status': 'error',
                    'message': 'Користувача не знайдено'
                }, status=status.HTTP_404_NOT_FOUND)
            
            print(f"User found: {user.email}, current verified status: {user.is_email_verified}")
            if not user.is_email_verified:
                user.is_email_verified = True
                user.save(update_fields=['is_email_verified'])
                user.refresh_from_db()
                print(f"After save, is_email_verified: {user.is_email_verified}")
                
                refresh = RefreshToken.for_user(user)
                return Response({
                    'status': 'success',
                    'message': 'Email успішно підтверджено!',
                    'access_token': str(refresh.access_token),
                    'refresh_token': str(refresh)
                }, status=status.HTTP_200_OK)
            
            print("Email already verified")
            return Response({
                'status': 'already_verified',
                'message': 'Email уже підтверджено'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Verification error: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'Помилка підтвердження email: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)