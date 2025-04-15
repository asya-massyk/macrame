import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  welcomeMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const verified = params['verified'] === 'true';
      console.log('Query params:', params);
      console.log('Token:', token, 'Verified:', verified);

      if (token) {
        this.authService.verifyEmail(token).subscribe({
          next: (response) => {
            console.log('Verify email response:', response);
            if (response.status === 'success' && response.verified) {
              this.welcomeMessage = 'Вітаю, ви успішно зареєструвалися!';
              this.errorMessage = null;
              this.router.navigateByUrl('/home?verified=true');
            } else {
              this.errorMessage = 'Недійсне посилання для підтвердження';
              this.welcomeMessage = null;
              this.router.navigateByUrl('/home?verified=false');
            }
          },
          error: (err) => {
            console.error('Verify email error:', err);
            this.errorMessage = err.error?.error || 'Помилка при підтвердженні email';
            this.welcomeMessage = null;
            this.router.navigateByUrl('/home?verified=false');
          }
        });
      } else if (verified) {
        this.welcomeMessage = 'Вітаю, ви успішно зареєструвалися!';
        this.errorMessage = null;
      } else {
        console.log('No token or verified param found');
      }
    });
  }
}