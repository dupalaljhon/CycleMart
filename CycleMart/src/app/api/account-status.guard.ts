import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AccountStatusService } from '../services/account-status.service';

/**
 * Guard to check if user's account is in good standing
 * Redirects suspended users to /suspended
 * Redirects banned users to /banned
 */
export const accountStatusGuard: CanActivateFn = (route, state) => {
  const accountStatusService = inject(AccountStatusService);
  const router = inject(Router);

  const status = accountStatusService.getCurrentStatus();

  // Banned users cannot access anything
  if (status.account_status === 'banned') {
    router.navigate(['/banned']);
    return false;
  }

  // Suspended users can only access suspended page
  if (status.account_status === 'suspended') {
    if (state.url !== '/suspended') {
      router.navigate(['/suspended']);
      return false;
    }
  }

  return true;
};
