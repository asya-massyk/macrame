import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './components/services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  canActivate(): Observable<boolean> | boolean {
    if (!isPlatformBrowser(this.platformId)) {
      this.router.navigate(['/login']);
      return false;
    }

    const token = localStorage.getItem('token');
    console.log('AuthGuard: Token exists:', !!token);

    if (token) {
      return this.authService.isLoggedIn$.pipe(
        map(isLoggedIn => {
          console.log('AuthGuard: isLoggedIn:', isLoggedIn);
          if (!isLoggedIn) {
            localStorage.removeItem('token');
            this.authService.isLoggedInSubject.next(false);
            this.router.navigate(['/login']);
            return false;
          }
          return true;
        })
      );
    } else {
      this.authService.isLoggedInSubject.next(false);
      this.router.navigate(['/login']);
      return false;
    }
  }
}