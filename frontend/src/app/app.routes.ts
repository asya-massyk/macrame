import { Routes, provideRouter } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { RegistrationComponent } from './components/registration/registration.component';
import { LoginComponent } from './components/login/login.component';
import { VerifyEmailComponent } from './components/verifyemail/verify-email.component';
import { PixelationComponent } from './components/pixel/pixelation.component';
import { ProfileComponent } from './components/profile/profile.component';
import { EditProfileComponent } from './components/edit-profile/edit-profile.component';
import { AddSketchComponent } from './components/sketch/sketch.component';
import { AuthGuard } from './auth.guard';
import { EditSketchComponent } from './components/edit-sketch/edit-sketch.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegistrationComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'pixel', component: PixelationComponent, canActivate: [AuthGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'edit-profile', component: EditProfileComponent, canActivate: [AuthGuard] },
  { path: 'add-sketch', component: AddSketchComponent, canActivate: [AuthGuard] }, 
  { path: 'edit-sketch', component: EditSketchComponent, canActivate: [AuthGuard] }, 
  { path: '**', redirectTo: '/home' }
];

export const appRouter = provideRouter(routes);