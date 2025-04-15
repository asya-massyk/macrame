import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true
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

      if (token) {
        this.authService.verifyEmail(token).subscribe({
          next: (response) => {
            if (verified) {
              this.welcomeMessage = 'Вітаю, ви успішно зареєструвалися!';
              this.errorMessage = null;
              this.router.navigate(['/home'], { queryParams: {} }); // Очищаємо query-параметри
            } else {
              this.errorMessage = 'Недійсне посилання для підтвердження';
              this.welcomeMessage = null;
            }
          },
          error: (err) => {
            this.errorMessage = err.error?.error || 'Помилка при підтвердженні email';
            this.welcomeMessage = null;
          }
        });
      } else if (verified) {
        this.welcomeMessage = 'Вітаю, ви успішно зареєструвалися!';
        this.errorMessage = null;
      }
    });
  }
}