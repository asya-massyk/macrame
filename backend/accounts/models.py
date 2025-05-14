from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator

class CustomUserManager(BaseUserManager):
    def create_user(self, nickname, email, password=None, **extra_fields):
        if not nickname:
            raise ValueError('Нікнейм обов’язковий')
        if not email:
            raise ValueError('Email обов’язковий')
        email = self.normalize_email(email)
        user = self.model(nickname=nickname, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, nickname, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Суперкористувач має мати is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Суперкористувач має мати is_superuser=True.')
        return self.create_user(nickname, email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    nickname = models.CharField(max_length=30, unique=True, verbose_name="Нікнейм")
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)
    name = models.CharField(max_length=30, verbose_name="Ім’я")
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        validators=[RegexValidator(r'^\+?1?\d{9,15}$', message="Телефон у форматі: '+380991234567'")]
    )
    date_of_birth = models.DateField(null=True, blank=True, verbose_name="Дата народження")
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name="Аватар")
    bio = models.TextField(max_length=500, blank=True, verbose_name="Біо")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'nickname'
    REQUIRED_FIELDS = ['email', 'name']
    objects = CustomUserManager()

    def __str__(self):
        return self.nickname

class Sketch(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sketches')
    image = models.ImageField(upload_to='sketches/', null=True, blank=True, verbose_name="Зображення ескізу")
    caption = models.TextField(max_length=1000, blank=True, verbose_name="Опис")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата створення")

    def __str__(self):
        return f"Ескіз від {self.user.nickname} - {self.created_at}"