import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Allows access for:
// - Admin sessions (admin_token)
// - Approved moderators logged in as users (authToken + user_role === 'moderator')
export const staffGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Admin login session
  if (localStorage.getItem('admin_token')) return true;

  // Moderator (user login session)
  const isUserLoggedIn = authService.isAuthenticated() && !!localStorage.getItem('id');
  const userRole = (localStorage.getItem('user_role') || '').toLowerCase();

  // Allow moderators who are logged in even if `admin_id` isn't present (some moderator sessions
  // use the normal user login flow and may not set admin_id). Downstream code should resolve
  // admin-related details when necessary.
  if (isUserLoggedIn && userRole === 'moderator') {
    return true;
  }

  // Not authorized: send users to normal login (not admin login)
  if (!isUserLoggedIn) {
    localStorage.setItem('returnUrl', state.url);
    return router.createUrlTree(['/login']);
  }

  // Logged in but not staff
  return router.createUrlTree(['/home']);
};
