import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-verify-email',
  template: `
    <div class="form-container">
      <div class="form-content">
        <h1>Підтвердження Email</h1>
        @if (message) {
          <div style="color: green;">{{ message }}</div>
        }
        @if (error) {
          <div style="color: red;">{{ error }}</div>
        }
        <p>Повернутися на <a href="/login">сторінку входу</a></p>
      </div>
    </div>
  `,
  styleUrls: ['./verify-email.component.scss'],
  standalone: true
})
export class VerifyEmailComponent implements OnInit {
  message: string | null = null;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private authService: AuthService, private router: Router) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (token) {
      this.authService.verifyEmail(token).subscribe({
        next: (response) => {
          this.message = response.message;
          this.error = null;
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err) => {
          this.error = err.error.error;
          this.message = null;
        }
      });
    }
  }
}