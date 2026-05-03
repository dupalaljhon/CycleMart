import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AccountStatusService } from '../services/account-status.service';

export const JwtInterceptor: HttpInterceptorFn = (req, next) => {
  const userToken = localStorage.getItem('authToken');
  const adminToken = localStorage.getItem('admin_token');

  // Staff-only endpoints must prefer admin token when both tokens exist.
  // Prefer admin token for staff endpoints — include moderator-application review route
  const staffEndpointPattern = /(mark-user-violation|approve-product|reject-product|archiveProduct|update-report-status|update-user-report-status|listing-auto-approval-config|moderator-application|\/admin\/)/i;
  const useAdminFirst = staffEndpointPattern.test(req.url);

  const token = useAdminFirst
    ? (adminToken || userToken)
    : (userToken || adminToken);
  const router = inject(Router);
  const accountStatusService = inject(AccountStatusService);
  
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle account status errors
      if (error.status === 403 && error.error) {
        const errorData = error.error;
        
        // Banned account
        if (errorData.banned === true || errorData.data?.banned === true) {
          const status = {
            account_status: 'banned' as const,
            violation_count: errorData.violation_count || errorData.data?.violation_count || 4
          };
          accountStatusService.updateAccountStatus(status);
          router.navigate(['/banned']);
          return throwError(() => error);
        }
        
        // Suspended account
        if (errorData.suspended === true || errorData.data?.suspended === true) {
          const status = {
            account_status: 'suspended' as const,
            violation_count: errorData.violation_count || errorData.data?.violation_count || 3
          };
          accountStatusService.updateAccountStatus(status);
          router.navigate(['/suspended']);
          return throwError(() => error);
        }
        
        // Restricted account
        if (errorData.restricted === true || errorData.data?.restricted === true) {
          const status = {
            account_status: 'restricted' as const,
            violation_count: errorData.violation_count || errorData.data?.violation_count || 2
          };
          accountStatusService.updateAccountStatus(status);
          // Don't redirect, just update status
        }
      }
      
      return throwError(() => error);
    })
  );
};
