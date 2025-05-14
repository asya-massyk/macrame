import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  isAuthenticated = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      this.isAuthenticated = isLoggedIn;
      console.log('Navbar auth state updated:', this.isAuthenticated);
    });
  }

  navigateToHome() {
    console.log('Navigating to /home');
    this.router.navigate(['/home']);
  }

  navigateToEditor() {
    if (this.isAuthenticated) {
      console.log('Navigating to /edit-sketcg');
      this.router.navigate(['/edit-sketch']);
    } else {
      console.log('Navigation to /edit-sketch blocked: not authenticated');
      this.router.navigate(['/login']);
    }
  }

  navigateToPixel() {
    if (this.isAuthenticated) {
      console.log('Navigating to /pixel');
      this.router.navigate(['/pixel']);
    } else {
      console.log('Navigation to /pixel blocked: not authenticated');
      this.router.navigate(['/login']);
    }
  }

  navigateToCommunity() {
    if (this.isAuthenticated) {
      console.log('Navigating to /community');
      this.router.navigate(['/community']);
    } else {
      console.log('Navigation to /community blocked: not authenticated');
      this.router.navigate(['/login']);
    }
  }

  navigateToProfile() {
    if (this.isAuthenticated && localStorage.getItem('token')) {
      console.log('Navigating to /profile');
      this.router.navigate(['/profile']);
    } else {
      console.log('Navigation to /profile blocked: not authenticated or no token');
      this.router.navigate(['/login']);
    }
  }

  navigateToLogin() {
    console.log('Navigating to /login');
    this.router.navigate(['/login']);
  }

  logout(): void {
    console.log('Logout triggered, navigating to /login');
    this.authService.logout();
  }
}