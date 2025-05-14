from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Sketch, User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ('nickname', 'email', 'name', 'is_staff')
    list_filter = ('is_staff', 'is_superuser', 'is_active')

    fieldsets = (
        (None, {'fields': ('nickname', 'email', 'password')}),
        ('Особиста інформація', {'fields': ('name', 'phone_number', 'date_of_birth', 'avatar', 'bio')}),
        ('Права доступу', {'fields': ('is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('nickname', 'email', 'name', 'password1', 'password2', 'is_staff', 'is_active')}
        ),
    )

    search_fields = ('nickname', 'email')
    ordering = ('nickname',)

@admin.register(Sketch)
class SketchAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'caption')
    list_filter = ('created_at',)
    search_fields = ('caption',)
    date_hierarchy = 'created_at'

