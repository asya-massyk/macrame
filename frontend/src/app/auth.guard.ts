import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './components/services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> | boolean {
    const token = localStorage.getItem('token');
    console.log('AuthGuard: Token exists:', !!token);

    if (token) {
      return this.authService.isLoggedIn$.pipe(
        map(isLoggedIn => {
          console.log('AuthGuard: isLoggedIn:', isLoggedIn);
          if (!isLoggedIn) {
            localStorage.removeItem('token');
            this.authService.isLoggedInSubject.next(false); // Синхронізуємо стан
            this.router.navigate(['/login']);
            return false;
          }
          return true;
        })
      );
    } else {
      this.authService.isLoggedInSubject.next(false); // Синхронізуємо стан
      this.router.navigate(['/login']);
      return false;
    }
  }
}