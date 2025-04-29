import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    standalone: true
})
export class HomeComponent implements OnInit {
    isLoggedIn = false;
    loginStatusMessage: string | null = null;

    constructor(
        private authService: AuthService,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit() {
        this.authService.isLoggedIn$.subscribe(isLoggedIn => {
            console.log('HomeComponent: isLoggedIn changed to', isLoggedIn);
            this.isLoggedIn = isLoggedIn;
            if (isLoggedIn && this.loginStatusMessage === null) {
                this.loginStatusMessage = 'Вітаємо, ви увійшли в систему!';
                setTimeout(() => {
                    this.loginStatusMessage = null;
                    this.router.navigate(['/home'], { replaceUrl: true });
                }, 5000);
            }
        });

        this.route.queryParams.subscribe(params => {
            const verified = params['verified'] === 'true';
            const message = params['message'];
            if (verified && this.isLoggedIn) {
                this.loginStatusMessage = message || 'Вітаємо, ви увійшли в систему!';
                setTimeout(() => {
                    this.loginStatusMessage = null;
                    this.router.navigate(['/home'], { replaceUrl: true });
                }, 5000);
            }
        });
    }
}