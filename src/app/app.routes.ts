import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { AuthComponent } from './auth/auth.component';
import { RegistrationComponent } from './registration/registration.component';
import { LoginComponent } from './login/login.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
    { path: '', component: HomeComponent }, 
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegistrationComponent },
    { path: 'profile', component: ProfileComponent },
    { path: 'auth', component: AuthComponent }
    //{ path: 'editor', loadComponent: () => import('./editor/editor.component').then(m => m.EditorComponent) },
    //{ path: 'community', loadComponent: () => import('./community/community.component').then(m => m.CommunityComponent) }
  ];
  
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
