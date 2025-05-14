import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';

interface FormErrors {
  new_password?: string;
  confirm_password?: string;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  token: string | null = null;
  newPassword: string = '';
  confirmPassword: string = '';
  error: string | null = null;
  message: string | null = null;
  errors: FormErrors = {};

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.error = 'Токен не знайдено. Перевірте посилання.';
      setTimeout(() => this.router.navigate(['/login']), 2000);
    } else {
      console.log('Token received:', this.token);
    }
  }

  validatePassword() {
    this.errors = {};

    if (!this.newPassword) {
      this.errors['new_password'] = 'Новий пароль є обов’язковим';
    } else if (this.newPassword.length < 8) {
      this.errors['new_password'] = 'Пароль повинен містити щонайменше 8 символів';
    } else if (!/[a-z]/.test(this.newPassword)) {
      this.errors['new_password'] = 'Потрібна хоча б одна мала літера';
    } else if (!/[A-Z]/.test(this.newPassword)) {
      this.errors['new_password'] = 'Потрібна хоча б одна велика літера';
    } else if (!/\d/.test(this.newPassword)) {
      this.errors['new_password'] = 'Потрібна хоча б одна цифра';
    }

    if (!this.confirmPassword) {
      this.errors['confirm_password'] = 'Підтвердження пароля є обов’язковим';
    } else if (this.newPassword !== this.confirmPassword) {
      this.errors['confirm_password'] = 'Паролі не збігаються';
    }
  }

  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0 || !this.newPassword || !this.confirmPassword;
  }

  togglePassword(inputId: string, event: Event) {
    event.preventDefault();
    const input = document.getElementById(inputId) as HTMLInputElement;
    const icon = event.target as HTMLImageElement;

    if (input.type === 'password') {
      input.type = 'text';
      icon.src = 'assets/icons/eye.svg';
    } else {
      input.type = 'password';
      icon.src = 'assets/icons/eye-closed.svg';
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.validatePassword();
    if (this.hasErrors()) {
      this.error = 'Виправте помилки перед продовженням';
      return;
    }
    if (this.token) {
      const resetData = {
        token: this.token,
        new_password: this.newPassword,
        confirm_password: this.confirmPassword
      };
      this.authService.resetPassword(resetData).subscribe({
        next: (response) => {
          this.message = 'Пароль успішно змінено';
          this.error = null;
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err) => {
          this.error = err.message || 'Помилка при зміні пароля';
          this.message = null;
        }
      });
    }
  }
}