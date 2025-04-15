import { Component, ChangeDetectorRef } from '@angular/core';  
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';

interface FormErrors {
  name?: string;
  nickname?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
}

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
  standalone: true,
  imports: [FormsModule],
  providers: [AuthService]
})
export class RegistrationComponent {
  user = { name: '', nickname: '', email: '', password: '', confirm_password: '' };
  message: string | null = null;
  error: string | null = null;
  errors: FormErrors = {};
  isFormInvalid: boolean = true;

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef 
  ) {}

  validateForm(): boolean {
    this.errors = {};

    if (!this.user.name) {
      this.errors['name'] = 'Ім’я є обов’язковим';
    } else if (this.user.name.length < 2) {
      this.errors['name'] = 'Ім’я повинно містити щонайменше 2 символи';
    }

    if (!this.user.nickname) {
      this.errors['nickname'] = 'Нікнейм є обов’язковим';
    } else if (this.user.nickname.length < 3 || this.user.nickname.length > 20) {
      this.errors['nickname'] = 'Нікнейм повинен бути від 3 до 20 символів';
    } else if (!/^[a-zA-Z0-9_]+$/.test(this.user.nickname)) {
      this.errors['nickname'] = 'Нікнейм може містити лише літери, цифри та підкреслення';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.user.email) {
      this.errors['email'] = 'Email є обов’язковим';
    } else if (!emailRegex.test(this.user.email)) {
      this.errors['email'] = 'Введіть коректний email';
    }

    if (!this.user.password) {
      this.errors['password'] = 'Пароль є обов’язковим';
    } else {
      if (this.user.password.length < 8) {
        this.errors['password'] = 'Пароль повинен містити щонайменше 8 символів';
      } else if (!/[a-z]/.test(this.user.password)) {
        this.errors['password'] = 'Пароль повинен містити щонайменше одну малу літеру';
      } else if (!/[A-Z]/.test(this.user.password)) {
        this.errors['password'] = 'Пароль повинен містити щонайменше одну велику літеру';
      } else if (!/\d/.test(this.user.password)) {
        this.errors['password'] = 'Пароль повинен містити щонайменше одну цифру';
      }
    }

    if (!this.user.confirm_password) {
      this.errors['confirm_password'] = 'Підтвердження пароля є обов’язковим';
    } else if (this.user.password !== this.user.confirm_password) {
      this.errors['confirm_password'] = 'Паролі не співпадають';
    }

    this.isFormInvalid = Object.keys(this.errors).length > 0;
    return !this.isFormInvalid;
  }

  hasErrors(): boolean {
    return this.isFormInvalid;
  }

  onInputChange() {
    this.validateForm();
  }

  registerUser(event: Event) {
    event.preventDefault();
    console.log('registerUser called:', this.user);
  
    if (!this.validateForm()) {
      console.log('Validation failed:', this.errors);
      return;
    }
  
    this.authService.register(this.user).subscribe({
      next: (response) => {
        console.log('Register response:', response);
        this.message = 'Підтвердьте пошту на вашому email';  
        this.error = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.log('Register error:', err);
        this.error = err.error?.error || 'Помилка при реєстрації';
        this.message = null;
        this.cdr.detectChanges();
      }
    });
  }

  togglePassword(inputId: string, event: Event) {
    event.preventDefault();
    const input = document.getElementById(inputId) as HTMLInputElement;
    const icon = event.target as HTMLImageElement;

    if (input.type === "password") {
      input.type = "text";
      icon.src = "../../../../assets/icons/eye.svg";
    } else {
      input.type = "password";
      icon.src = "../../../../assets/icons/eye-closed.svg";
    }
  }
}