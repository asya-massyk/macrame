# Generated by Django 5.1.5 on 2025-05-07 13:27

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_alter_user_phone_number'),
    ]

    operations = [
        migrations.AlterField(
            model_name='post',
            name='image',
            field=models.BinaryField(blank=True, null=True, verbose_name='Фото поста'),
        ),
        migrations.AlterField(
            model_name='user',
            name='avatar',
            field=models.BinaryField(blank=True, null=True, verbose_name='Аватар'),
        ),
    ]
