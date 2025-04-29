import { provideRouter, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { RegistrationComponent } from './components/registration/registration.component';
import { LoginComponent } from './components/login/login.component';
import { VerifyEmailComponent } from './components/verifyemail/verify-email.component';

//import { ProfileComponent } from './components/profile/profile.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'home', component: HomeComponent }, 
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegistrationComponent },
    { path: 'verify-email', component: VerifyEmailComponent },
    //{ path: 'profile', component: ProfileComponent },
    // { path: 'editor', loadComponent: () => import('./editor/editor.component').then(m => m.EditorComponent) },
    // { path: 'community', loadComponent: () => import('./community/community.component').then(m => m.CommunityComponent) }
];

export const appRouter = provideRouter(routes);
