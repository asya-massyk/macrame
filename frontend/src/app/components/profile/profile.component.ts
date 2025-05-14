import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

interface Sketch {
  id: number;
  caption: string;
  image: string | null;
  created_at: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  nickname: string = '';
  name: string = '';
  bio: string = '';
  avatarUrl: string | null = null;
  sketches: Sketch[] = [];
  errorMessage: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.loadProfile(params['refresh'] === 'true');
    });
  }

  private loadProfile(refreshSketches: boolean = false) {
    const token = localStorage.getItem('token');
    console.log('ProfileComponent: Token retrieved:', token);

    if (!token) {
      console.log('ProfileComponent: No token, redirecting to /login');
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.http.get<any>(`${environment.apiUrl}/accounts/profile/`, { headers }).subscribe({
      next: (data) => {
        console.log('ProfileComponent: Profile data received:', data);
        this.nickname = data.nickname || '';
        this.name = data.name || '';
        this.bio = data.bio || '';
        this.avatarUrl = data.avatar ? `${environment.apiUrl}${data.avatar}` : 'assets/icons/avatar.svg';
        this.sketches = (data.sketches || []).map((sketch: any) => ({
          id: sketch.id,
          caption: sketch.caption || '',
          image: sketch.image ? `${environment.apiUrl}${sketch.image}` : null,
          created_at: sketch.created_at,
        }));
        console.log('ProfileComponent: Mapped sketches:', this.sketches);
        if (refreshSketches) {
          this.loadSketches();
        }
      },
      error: (err) => {
        console.error('ProfileComponent: Error loading profile:', err);
        this.errorMessage = 'Помилка завантаження профілю';
        if (err.status === 401) {
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
        } else {
          console.error('ProfileComponent: Non-401 error, redirecting to /home');
          this.router.navigate(['/home']);
        }
      },
    });
  }

  private loadSketches() {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.http.get<Sketch[]>(`${environment.apiUrl}/accounts/sketches/`, { headers }).subscribe({
      next: (sketches) => {
        console.log('ProfileComponent: Sketches received:', sketches);
        this.sketches = sketches.map((sketch) => ({
          ...sketch,
          image: sketch.image ? `${environment.apiUrl}${sketch.image}` : null,
        }));
      },
      error: (err) => {
        console.error('ProfileComponent: Error loading sketches:', err);
        this.errorMessage = 'Помилка завантаження ескізів';
      },
    });
  }

  navigateToEditProfile() {
    this.router.navigate(['/edit-profile']);
  }

  navigateToAddSketch() {
    this.router.navigate(['/add-sketch']);
  }

  truncateContent(content: string | null | undefined, maxLength: number = 150): string {
    if (!content) return '';
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  }

  deleteSketch(sketchId: number): void {
    if (confirm('Ви впевнені, що хочете видалити ескіз?')) {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
      });
      this.http
        .delete(`${environment.apiUrl}/accounts/sketches/${sketchId}/`, { headers })
        .subscribe({
          next: () => {
            console.log('ProfileComponent: Sketch deleted, reloading sketches');
            this.loadSketches();
          },
          error: (err) => {
            console.error('ProfileComponent: Error deleting sketch:', err);
            this.errorMessage = 'Помилка видалення ескізу';
          },
        });
    }
  }
}