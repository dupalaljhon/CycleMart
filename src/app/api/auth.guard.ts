import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): boolean {
    
    const token = this.authService.getToken();
    const userId = localStorage.getItem('id');
    
    if (token && userId) {
      return true;
    } else {
      // Store the attempted URL for redirecting after login
      localStorage.setItem('returnUrl', state.url);
      this.router.navigate(['/login']);
      return false;
    }
  }
}
