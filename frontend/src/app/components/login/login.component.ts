import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  constructor(private router: Router) {}

  registerUser(event: Event) {
    event.preventDefault(); 
    console.log("Користувач зареєстрований!");
    this.router.navigate(['/home']); 
  }

  togglePassword(inputId: string, event: Event) {
    event.preventDefault(); 
    const input = document.getElementById(inputId) as HTMLInputElement;
    const icon = event.target as HTMLImageElement;

    if (input.type === "password") {
      input.type = "text";
      icon.src = "../../../assets/icons/eye.svg"; 
    } else {
      input.type = "password";
      icon.src = "../../../assets/icons/eye-closed.svg"; 
    }
  }
}
