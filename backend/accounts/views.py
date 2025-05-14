from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings
from .models import Sketch, User
from .utils import generate_verification_token, verify_token
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import LoginSerializer, SketchSerializer, UserSerializer
from rest_framework.permissions import IsAuthenticated
import base64
import logging

# Налаштування логування
logger = logging.getLogger(__name__)

class LoginView(APIView):
    def post(self, request):
        logger.info(f"Login request data: {request.data}")
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            logger.info(f"Returning tokens for user: {user}")
            return Response({
                'token': str(refresh.access_token),
                'refresh': str(refresh)
            }, status=status.HTTP_200_OK, headers={'Content-Type': 'application/json; charset=utf-8'})
        logger.error(f"Serializer errors: {serializer.errors}")
        error_message = str(serializer.errors.get('non_field_errors', ['Помилка авторизації'])[0])
        return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST, headers={'Content-Type': 'application/json; charset=utf-8'})

class RegisterView(APIView):
    def post(self, request):
        logger.info("Received request data: %s", request.data)
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
            logger.error("Missing fields: %s", missing_fields)
            return Response(
                {'error': f'Ці поля обов\'язкові: {", ".join(missing_fields)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if password != confirm_password:
            logger.error("Passwords do not match")
            return Response(
                {'error': 'Паролі не співпадають'},
                status=status.HTTP_400_BAD_REQUEST
            )

        existing_user = User.objects.filter(email=email).first()
        logger.info(f"Checking existing user for email {email}: {existing_user}")
        if existing_user:
            logger.info(f"Email {email} already exists, verified: {existing_user.is_email_verified}")
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
            logger.info("Creating user with: %s", {
                "nickname": nickname,
                "email": email,
                "first_name": username
            })
            user = User.objects.create_user(
                nickname=nickname,
                email=email,
                password=password,
                name=username,
                is_email_verified=False
            )
            logger.info("User created successfully: %s", user.email)

            self.send_verification_email(user)

            return Response(
                {
                    'message': 'Реєстрація успішна! Перевірте ваш email для підтвердження.',
                    'user_id': user.id
                },
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            logger.error("Error creating user: %s", str(e))
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
        <h2>Привіт, {user.name}!</h2>
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
            logger.info(f"Sending verification email to: {user.email}")
            send_mail(
                subject,
                '',
                f"Macrame Support <{settings.DEFAULT_FROM_EMAIL}>",
                [user.email],
                fail_silently=False,
                html_message=html_message
            )
            logger.info(f"Verification email sent to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send verification email: {str(e)}")
            raise

class VerifyEmailView(APIView):
    def get(self, request):
        token = request.query_params.get('token')
        logger.info(f"Verification token received: {token}")
        if not token:
            logger.error("No token provided")
            return Response({
                'status': 'error',
                'message': 'Токен не надано'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            email = verify_token(token)
            logger.info(f"Decoded email: {email}")

            if not email:
                logger.error("Token verification failed - no email decoded")
                return Response({
                    'status': 'error',
                    'message': 'Недійсний або прострочений токен'
                }, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.filter(email=email).first()
            logger.info(f"User lookup: email={email}, found user={user}")
            if not user:
                logger.error(f"User not found for email: {email}")
                return Response({
                    'status': 'error',
                    'message': 'Користувача не знайдено'
                }, status=status.HTTP_404_NOT_FOUND)

            logger.info(f"User found: {user.email}, current verified status: {user.is_email_verified}")
            if not user.is_email_verified:
                user.is_email_verified = True
                user.save(update_fields=['is_email_verified'])
                user.refresh_from_db()
                logger.info(f"After save, is_email_verified: {user.is_email_verified}")

                refresh = RefreshToken.for_user(user)
                return Response({
                    'status': 'success',
                    'message': 'Email успішно підтверджено!',
                    'access_token': str(refresh.access_token),
                    'refresh_token': str(refresh)
                }, status=status.HTTP_200_OK)

            logger.info("Email already verified")
            return Response({
                'status': 'already_verified',
                'message': 'Email уже підтверджено'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Verification error: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'Помилка підтвердження email: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            logger.info(f"Fetching profile for user: {user.nickname}")
            serializer = UserSerializer(user)
            logger.info(f"Returning profile data for user: {user.nickname}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"ProfileAPIView error for user {request.user.nickname}: {str(e)}", exc_info=True)
            return Response({'error': f'Помилка отримання профілю: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
@login_required
def profile(request):
    user = request.user
    sketches = user.sketches.all().order_by('-created_at')  # Замінюємо posts на sketches
    if not user.date_of_birth:
        return redirect('complete_profile')
    return render(request, 'profile/ProfilePage.html', {'user': user, 'sketches': sketches})

@login_required
def complete_profile(request):
    if request.method == 'POST':
        user = request.user
        user.date_of_birth = request.POST.get('date_of_birth')
        user.phone_number = request.POST.get('phone_number')
        user.set_password(request.POST.get('password'))
        user.save()
        return redirect('profile')
    return render(request, 'profile/CompleteProfile.html', {})

@login_required
def edit_profile(request):
    if request.method == 'POST':
        user = request.user
        user.first_name = request.POST.get('name')
        user.bio = request.POST.get('bio')
        if 'avatar' in request.FILES:
            avatar_file = request.FILES['avatar']
            user.avatar = avatar_file  # Assign file object directly
        password = request.POST.get('password')
        if password:
            user.set_password(password)
        user.save()
        return redirect('profile')
    return render(request, 'profile/EditProfile.html', {'user': request.user})

class EditProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            user = request.user
            logger.info(f"Editing profile for user: {user.nickname}")
            
            # Обмеження розміру зображення (5 МБ)
            MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
            
            # Оновлення полів
            name = request.POST.get('name')
            bio = request.POST.get('bio')
            password = request.POST.get('password')
            avatar_file = request.FILES.get('avatar')

            if name:
                user.name = name
            if bio is not None:
                user.bio = bio
            if password:
                user.set_password(password)
            if avatar_file:
                if avatar_file.size > MAX_IMAGE_SIZE:
                    logger.error(f"Avatar file too large for user {user.nickname}: {avatar_file.size} bytes")
                    return Response({
                        'error': 'Зображення занадто велике (макс. 5 МБ)'
                    }, status=status.HTTP_400_BAD_REQUEST)
                if avatar_file.content_type not in ['image/jpeg', 'image/png']:
                    logger.error(f"Invalid avatar format: {avatar_file.content_type}")
                    return Response({
                        'error': 'Дозволені формати: JPEG, PNG'
                    }, status=status.HTTP_400_BAD_REQUEST)
                user.avatar = avatar_file  # Assign file object directly

            user.save()
            logger.info(f"Profile updated successfully for user: {user.nickname}")
            return Response({
                'message': 'Профіль успішно оновлено'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error updating profile for user {request.user.nickname}: {str(e)}", exc_info=True)
            return Response({
                'error': f'Помилка оновлення профілю: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SketchAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.info(f"Fetching sketches for user: {request.user.nickname}")
        try:
            sketches = Sketch.objects.filter(user=request.user).order_by('-created_at')
            serializer = SketchSerializer(sketches, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching sketches for user {request.user.nickname}: {str(e)}")
            return Response({'error': f'Помилка отримання ескізів: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        logger.info(f"Adding sketch for user: {request.user.nickname}")
        image = request.FILES.get('image')
        caption = request.POST.get('caption', '')

        if not image and not caption:
            logger.error("No image or caption provided")
            return Response({'error': 'Потрібно завантажити зображення або ввести опис'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if image:
                if image.size > 5 * 1024 * 1024:  # 5MB limit
                    logger.error(f"Image too large: {image.size} bytes")
                    return Response({'error': 'Зображення занадто велике (макс. 5 МБ)'}, status=status.HTTP_400_BAD_REQUEST)
                if image.content_type not in ['image/jpeg', 'image/png']:
                    logger.error(f"Invalid image format: {image.content_type}")
                    return Response({'error': 'Дозволені формати: JPEG, PNG'}, status=status.HTTP_400_BAD_REQUEST)

            sketch = Sketch(user=request.user, caption=caption)
            if image:
                sketch.image = image
            sketch.save()
            serializer = SketchSerializer(sketch)
            logger.info(f"Sketch created successfully for user: {request.user.nickname}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error adding sketch for user {request.user.nickname}: {str(e)}")
            return Response({'error': f'Помилка додавання ескізу: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, sketch_id):
        logger.info(f"Deleting sketch {sketch_id} for user: {request.user.nickname}")
        try:
            sketch = Sketch.objects.get(id=sketch_id, user=request.user)
            sketch.delete()
            logger.info(f"Sketch {sketch_id} deleted successfully by user: {request.user.nickname}")
            return Response({'message': 'Ескіз успішно видалено'}, status=status.HTTP_200_OK)
        except Sketch.DoesNotExist:
            logger.error(f"Sketch {sketch_id} not found or not owned by user {request.user.nickname}")
            return Response({'error': 'Ескіз не знайдено або ви не маєте прав на видалення'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deleting sketch {sketch_id}: {str(e)}")
            return Response({'error': f'Помилка видалення ескізу: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)