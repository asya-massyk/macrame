import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-sketch',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './sketch.component.html',
  styleUrls: ['./sketch.component.scss'],
})
export class AddSketchComponent {
  newSketch = { image: null as File | null, caption: '' };
  imagePreview: string | null = null;
  errorMessage: string | null = null;
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  onPostImageChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.newSketch.image = file;
      this.errorMessage = null;

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  saveSketch() {
    if (!this.isBrowser) return;
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.newSketch.image) {
      this.errorMessage = 'Будь ласка, виберіть зображення';
      return;
    }

    const formData = new FormData();
    formData.append('image', this.newSketch.image);
    formData.append('caption', this.newSketch.caption);

    const url = `${environment.apiUrl}/accounts/sketches/`;
    console.log('Posting to:', url); // Debug URL
    this.http
      .post(url, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response) => {
          console.log('AddSketchComponent: Sketch added successfully:', response);
          this.router.navigate(['/profile'], { queryParams: { refresh: 'true' } });
        },
        error: (err) => {
          console.error('AddSketchComponent: Error adding sketch:', err);
          this.errorMessage = err.error?.error || 'Помилка додавання ескізу';
          if (err.status === 401) {
            localStorage.removeItem('token');
            this.router.navigate(['/login']);
          } else if (err.status === 403) {
            this.router.navigate(['/home']);
          }
        },
      });
  }

  navigateBack() {
    this.router.navigate(['/profile']);
  }
}