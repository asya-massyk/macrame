import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
    user = { identifier: '', password: '' };
    forgotPasswordEmail: string = '';
    error: string | null = null;
    message: string | null = null;
    showForgotPassword: boolean = false;

    constructor(
        private router: Router,
        private authService: AuthService,
        private cdr: ChangeDetectorRef
    ) { }

    onSubmit(event: Event) {
        event.preventDefault();
        if (!this.user.identifier || !this.user.password) {
            this.error = 'Заповніть усі поля';
            this.cdr.detectChanges();
            return;
        }
        console.log('Attempting login with identifier:', this.user.identifier);
        this.authService.login(this.user).subscribe({
            next: (response) => {
                console.log('Login response in LoginComponent:', response);
                this.message = 'Успішний вхід!';
                this.error = null;
                setTimeout(() => {
                    console.log('Navigating to /home');
                    this.router.navigate(['/home']);
                    this.cdr.detectChanges();
                }, 100);
            },
            error: (err) => {
                console.log('Login error in LoginComponent:', err);
                this.error = err.message || 'Невірний email/нікнейм або пароль';
                if (this.error && this.error.includes('підтвердьте')) {
                    this.message = 'Перевірте вашу пошту для підтвердження';
                } else {
                    this.message = null;
                }
                this.cdr.detectChanges();
            }
        });
    }

    showForgotPasswordForm(event: Event) {
        event.preventDefault();
        this.showForgotPassword = !this.showForgotPassword;
        this.error = null;
        this.message = null;
        this.forgotPasswordEmail = '';
        this.cdr.detectChanges();
    }

    onForgotPasswordSubmit(event: Event) {
        event.preventDefault();
        if (!this.forgotPasswordEmail) {
            this.error = 'Введіть ваш email';
            this.cdr.detectChanges();
            return;
        }
        console.log('Forgot password email before sending:', this.forgotPasswordEmail);
        const normalizedEmail = this.forgotPasswordEmail.trim().toLowerCase();
        console.log('Normalized email:', normalizedEmail);
        this.authService.requestPasswordReset(normalizedEmail).subscribe({
            next: (response) => {
                this.message = 'Посилання для відновлення пароля надіслано на ваш email';
                this.error = null;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.error = err.message || 'Помилка: email не знайдено';
                this.message = null;
                this.cdr.detectChanges();
            }
        });
    }

    togglePassword(inputId: string, event: Event) {
        event.preventDefault();
        const input = document.getElementById(inputId);
        if (!input) {
            console.error(`Element with ID ${inputId} not found`);
            return;
        }
        const typedInput = input as HTMLInputElement;
        const icon = event.target;
        if (!(icon instanceof HTMLImageElement)) {
            console.error(`Event target is not an HTMLImageElement:`, icon);
            return;
        }
        if (typedInput.type === 'password') {
            typedInput.type = 'text';
            icon.src = '../../../assets/icons/eye.svg';
        } else {
            typedInput.type = 'password';
            icon.src = '../../../assets/icons/eye-closed.svg';
        }
    }
}