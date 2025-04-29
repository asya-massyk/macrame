import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, VerifyEmailResponse } from '../services/auth.service';

@Component({
    selector: 'app-verify-email',
    templateUrl: './verify-email.component.html',
    styleUrls: ['./verify-email.component.scss'],
    standalone: true
})
export class VerifyEmailComponent implements OnInit {
    message: string | null = null;
    error: string | null = null;
    isVerified: boolean = false;

    constructor(
        private route: ActivatedRoute,
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            const token = params['token'];
            console.log('Received token:', token);
            if (token) {
                this.verifyEmail(token);
            } else {
                this.error = 'Токен підтвердження відсутній';
                this.message = null;
            }
        });
    }

    verifyEmail(token: string) {
        console.log('Attempting to verify email with token:', token);
        this.authService.verifyEmail(token).subscribe({
            next: (response) => {
                console.log('Verify email response:', response);
                this.message = response.message ?? null;
                this.error = null;

                if (response.status === 'success') {
                    this.message = 'Вітаємо, пошту підтверджено!';
                    this.isVerified = true;
                } else if (response.status === 'already_verified') {
                    this.message = 'Email уже підтверджено.';
                    this.isVerified = true;
                } else {
                    this.error = response.message || 'Помилка підтвердження email.';
                    this.message = null;
                    this.isVerified = false;
                }
            },
            error: (err) => {
                console.error('Verify email error:', err);
                this.error = err.message || 'Помилка підтвердження email';
                this.message = null;
                this.isVerified = false;
            }
        });
    }

    goToHome() {
        console.log('Navigating to /home with isVerified:', this.isVerified);
        this.router.navigate(['/home'], {
            queryParams: { verified: this.isVerified ? 'true' : 'false', message: this.message },
            replaceUrl: true
        });
    }
}