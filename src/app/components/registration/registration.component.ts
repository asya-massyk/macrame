import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss']
})
export class RegistrationComponent {
  constructor(private router: Router) {}

  registerUser(event: Event) {
    event.preventDefault(); // Запобігає перезавантаженню сторінки
    console.log("Користувач зареєстрований!");
    this.router.navigate(['/home']); // Перенаправлення на сторінку профілю
  }

  togglePassword(inputId: string, event: Event) {
    event.preventDefault(); // Запобігає небажаному спрацюванню форми
    const input = document.getElementById(inputId) as HTMLInputElement;
    const icon = event.target as HTMLImageElement;

    if (input.type === "password") {
      input.type = "text";
      icon.src = "../../../assets/icons/eye.svg"; // Іконка відкритого ока
    } else {
      input.type = "password";
      icon.src = "../../../assets/icons/eye-closed.svg"; // Іконка закритого ока
    }
  }
}
