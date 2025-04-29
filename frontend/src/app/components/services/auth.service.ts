import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

interface LoginResponse {
    access: string;
    refresh: string;
    token: string;
}

export interface VerifyEmailResponse {
  status: 'success' | 'already_verified' | 'error';
  message?: string;
  access_token?: string;
  refresh_token?: string;
  redirect_url?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'http://127.0.0.1:8000/accounts';
    private isLoggedInSubject = new BehaviorSubject<boolean>(false);
    isLoggedIn$ = this.isLoggedInSubject.asObservable();

    constructor(
        private http: HttpClient,
        private router: Router
    ) {
        this.checkInitialAuthState();
    }

    private isLocalStorageAvailable(): boolean {
        try {
            return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
        } catch (e) {
            return false;
        }
    }

    private getToken(): string | null {
        return this.isLocalStorageAvailable() ? localStorage.getItem('token') : null;
    }

    register(user: any): Observable<any> {
      console.log('Sending register request to:', `${this.apiUrl}/register/`, JSON.stringify(user));
      if (this.isLocalStorageAvailable()) {
          localStorage.setItem('returnUrl', this.router.url); // Зберігаємо поточний URL
      }
      return this.http.post(`${this.apiUrl}/register/`, user);
  }

    showWelcomeMessage = true;

    login(user: { identifier: string; password: string }): Observable<LoginResponse> {
      console.log('Sending login request to:', `${this.apiUrl}/login/`, JSON.stringify(user));
      return this.http.post<LoginResponse>(`${this.apiUrl}/login/`, user, {
          headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json; charset=utf-8'
          }
      }).pipe(
          tap(response => {
              console.log('Login response:', response);
              if (response.token) {
                  if (this.isLocalStorageAvailable()) {
                      localStorage.setItem('token', response.token);
                      localStorage.setItem('refresh', response.refresh);
                      console.log('Tokens saved to localStorage:', {
                          token: response.token,
                          refresh: response.refresh
                      });
                  } else {
                      console.error('localStorage is not available');
                  }
                  this.isLoggedInSubject.next(true);
                  console.log('Login successful, isLoggedIn set to true');
                  this.router.navigate(['/home']);
              }
          }),
          catchError(err => {
              console.error('Login error:', err);
              let errorMessage = 'Невірний email/нікнейм або пароль';
              if (err.error && err.error.error) {
                  errorMessage = String(err.error.error);
              } else if (err.error && err.error.non_field_errors) {
                  errorMessage = String(err.error.non_field_errors[0]);
              }
              this.isLoggedInSubject.next(false);
              return throwError(() => new Error(errorMessage));
          })
      );
  }

  private checkInitialAuthState() {
    const token = this.getToken();
    if (token) {
      // Додатково перевіряємо валідність токена
      this.checkTokenValidity().subscribe(isValid => {
        this.isLoggedInSubject.next(isValid);
        console.log('Initial auth state:', isValid);
      });
    } else {
      this.isLoggedInSubject.next(false);
    }
  }

  verifyEmail(token: string): Observable<VerifyEmailResponse> {
    return this.http.get<VerifyEmailResponse>(`${this.apiUrl}/verify-email?token=${token}`).pipe(
        tap(response => {
            if (response.status === 'success' && response.access_token && response.refresh_token) {
                if (this.isLocalStorageAvailable()) {
                    localStorage.setItem('token', response.access_token);
                    localStorage.setItem('refresh', response.refresh_token);
                }
                this.isLoggedInSubject.next(true);
            }
        }),
        catchError(err => {
            const errorMessage = err.error?.message || err.error?.error || 'Помилка підтвердження email';
            return throwError(() => new Error(errorMessage));
        })
    );
}

    checkTokenValidity(): Observable<boolean> {
        const token = this.getToken();
        if (!token) {
            return of(false);
        }

        return this.http.get<{ valid: boolean }>('/api/validate-token', {
            headers: { Authorization: `Bearer ${token}` }
        }).pipe(
            map(response => response.valid),
            catchError(error => {
                console.error('Token validation error:', error);
                return of(false);
            })
        );
    }

    logout() {
        this.showWelcomeMessage = false;
        if (this.isLocalStorageAvailable()) {
            localStorage.removeItem('token');
            localStorage.removeItem('refresh');
        }
        this.isLoggedInSubject.next(false);
        console.log('Logged out, isLoggedIn set to false');
        this.router.navigate(['/home']);
    }
}