import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Allows access only when an admin/moderator session exists (admin login)
export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const adminToken = localStorage.getItem('admin_token');
  if (adminToken) return true;

  // Optional: remember where the user tried to go
  localStorage.setItem('adminReturnUrl', state.url);
  return inject(Router).createUrlTree(['/admin-login']);
};
