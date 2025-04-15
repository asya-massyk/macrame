import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/accounts/';

  constructor(private http: HttpClient) {}

  register(user: any): Observable<any> {
    console.log('Sending register request to:', `${this.apiUrl}register/`, JSON.stringify(user));  // Додаємо JSON.stringify для деталізації
    return this.http.post(`${this.apiUrl}register/`, user);
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}verify-email/${token}/`);
  }
}