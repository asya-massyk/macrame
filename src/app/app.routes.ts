import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AuthComponent } from './auth/auth.component';
import { RegistrationComponent } from './registration/registration.component';
import { LoginComponent } from './login/login.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'auth', component: AuthComponent },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegistrationComponent },
    { path: 'profile', component: ProfileComponent },
    { path: 'auth', component: AuthComponent }
    //{ path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
    //{ path: 'editor', loadComponent: () => import('./editor/editor.component').then(m => m.EditorComponent) },
    //{ path: 'generator', loadComponent: () => import('./generator/generator.component').then(m => m.GeneratorComponent) },
    //{ path: 'library', loadComponent: () => import('./library/library.component').then(m => m.LibraryComponent) },
    //{ path: 'instructions', loadComponent: () => import('./instructions/instructions.component').then(m => m.InstructionsComponent) },
    //{ path: 'community', loadComponent: () => import('./community/community.component').then(m => m.CommunityComponent) }
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
