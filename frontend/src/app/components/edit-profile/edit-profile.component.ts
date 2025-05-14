import { Component, OnInit, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss']
})
export class EditProfileComponent implements OnInit, OnDestroy {
  editForm: { name: string; bio: string; password: string; avatar?: File } = { name: '', bio: '', password: '' };
  errorMessage: string | null = null;
  selectedAvatarName: string | null = null;
  avatarPreview: string | null = null;
  imageTransform: string = 'translate(0px, 0px) scale(1)';
  private isBrowser: boolean;
  private isDragging: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private translateX: number = 0;
  private translateY: number = 0;
  private scale: number = 1;
  private minScale: number = 1;
  private maxScale: number = 3;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    this.loadProfileData();
    if (this.isBrowser) {
      document.addEventListener('mousemove', this.onMouseMove.bind(this));
      document.addEventListener('mouseup', this.stopDragging.bind(this));
      document.addEventListener('touchmove', this.onTouchMove.bind(this));
      document.addEventListener('touchend', this.stopDragging.bind(this));
    }
  }

  ngOnDestroy() {
    if (this.isBrowser) {
      document.removeEventListener('mousemove', this.onMouseMove.bind(this));
      document.removeEventListener('mouseup', this.stopDragging.bind(this));
      document.removeEventListener('touchmove', this.onTouchMove.bind(this));
      document.removeEventListener('touchend', this.stopDragging.bind(this));
    }
  }

  loadProfileData() {
    if (!this.isBrowser) return;
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.http.get<any>(`${environment.apiUrl}/accounts/profile/`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => {
        console.log('EditProfileComponent: Profile data loaded:', data);
        this.editForm.name = data.name || '';
        this.editForm.bio = data.bio || '';
        this.avatarPreview = data.avatar ? `${environment.apiUrl}${data.avatar}` : null;
      },
      error: (err) => {
        console.error('EditProfileComponent: Error loading profile data:', err);
        this.errorMessage = 'Помилка завантаження даних профілю';
        if (err.status === 401) {
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
        }
      }
    });
  }

  onAvatarChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      console.log('EditProfileComponent: File selected:', file.name, 'Size:', file.size);
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'Зображення занадто велике (макс. 5 МБ)';
        this.resetImageState();
      } else if (!['image/jpeg', 'image/png'].includes(file.type)) {
        this.errorMessage = 'Дозволені формати: JPEG, PNG';
        this.resetImageState();
      } else {
        this.editForm.avatar = file;
        this.selectedAvatarName = file.name;
        this.errorMessage = null;

        const reader = new FileReader();
        reader.onload = () => {
          this.avatarPreview = reader.result as string;
          this.resetImageState();
          console.log('EditProfileComponent: Avatar preview generated');
        };
        reader.readAsDataURL(file);
      }
    } else {
      console.log('EditProfileComponent: No file selected');
      this.resetImageState();
      this.errorMessage = null;
    }
  }

  private resetImageState() {
    this.editForm.avatar = undefined;
    this.selectedAvatarName = null;
    this.avatarPreview = null;
    this.translateX = 0;
    this.translateY = 0;
    this.scale = 1;
    this.imageTransform = 'translate(0px, 0px) scale(1)';
  }

  startDragging(event: MouseEvent | TouchEvent) {
    if (!this.isBrowser || !this.avatarPreview) return;
    event.preventDefault();
    this.isDragging = true;
    if (event instanceof MouseEvent) {
      this.startX = event.clientX - this.translateX;
      this.startY = event.clientY - this.translateY;
    } else {
      const touch = event.touches[0];
      this.startX = touch.clientX - this.translateX;
      this.startY = touch.clientY - this.translateY;
    }
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    this.translateImage(event.clientX, event.clientY);
  }

  onTouchMove(event: TouchEvent) {
    if (!this.isDragging) return;
    const touch = event.touches[0];
    this.translateImage(touch.clientX, touch.clientY);
  }

  private translateImage(clientX: number, clientY: number) {
    this.translateX = clientX - this.startX;
    this.translateY = clientY - this.startY;
    const maxTranslate = 100 * this.scale; // Adjust based on scale
    this.translateX = Math.max(-maxTranslate, Math.min(maxTranslate, this.translateX));
    this.translateY = Math.max(-maxTranslate, Math.min(maxTranslate, this.translateY));
    this.updateTransform();
  }

  stopDragging() {
    this.isDragging = false;
  }

  zoom(event: WheelEvent) {
    if (!this.isBrowser || !this.avatarPreview) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1; // Scroll down: zoom out, up: zoom in
    this.adjustScale(delta);
  }

  zoomIn() {
    this.adjustScale(0.1);
  }

  zoomOut() {
    this.adjustScale(-0.1);
  }

  private adjustScale(delta: number) {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta));
    // Adjust translation to keep image centered
    const maxTranslate = 100 * this.scale;
    this.translateX = Math.max(-maxTranslate, Math.min(maxTranslate, this.translateX));
    this.translateY = Math.max(-maxTranslate, Math.min(maxTranslate, this.translateY));
    this.updateTransform();
  }

  private updateTransform() {
    this.imageTransform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
  }

  saveProfile() {
    if (!this.isBrowser) return;
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const formData = new FormData();
    formData.append('name', this.editForm.name);
    formData.append('bio', this.editForm.bio);
    if (this.editForm.avatar) formData.append('avatar', this.editForm.avatar);
    if (this.editForm.password) formData.append('password', this.editForm.password);

    this.http.post(`${environment.apiUrl}/accounts/edit-profile/`, formData, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        console.log('EditProfileComponent: Profile saved successfully:', response);
        this.errorMessage = null;
        this.router.navigate(['/profile']);
      },
      error: (err) => {
        console.error('EditProfileComponent: Error saving profile:', err);
        this.errorMessage = err.error?.error || 'Помилка збереження профілю';
        if (err.status === 401) {
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
        }
      }
    });
  }

  navigateBack() {
    this.router.navigate(['/profile']);
  }
}