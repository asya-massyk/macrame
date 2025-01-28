import { Component } from '@angular/core';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent {
  // Можна додати логіку для обробки форми входу та реєстрації
  onLogin(): void {
    console.log('Користувач увійшов');
  }
}
