import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient, private router: Router) { }

  // Register
//   register(data: any): Observable<any> {
//     return this.http.post<any>(`${this.baseUrl}/register`, data).pipe(
//       map(response => {
//         if (response?.status?.remarks === 'success') {
//           return response;
//         } else {
//           throw new Error(response?.status?.message || 'Registration failed');
//         }
//       }),
//       catchError(error => {
//         return of({ success: false, error: error.message || 'Registration failed' });
//       })
//     );
//   }

//   // Login
// login(email: string, password: string): Observable<any> {
//   return this.http.post<any>(`${this.baseUrl}/login`, { email, password })
//     .pipe(
//       map(response => {
//         if (response.status.remarks === 'success') {
//           this.saveToken(response.payload.token);
//           localStorage.setItem('email', email); // âœ… store email instead of username
//           this.router.navigate(['/home']); // âœ… navigate to sidenav after login
//         }
//         return response;
//       }),
//       catchError(error => {
//         return of({ success: false, error: error.message || 'Login failed' });
//       })
//     );
// }

register(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/register`, data).pipe(
    map(response => {
      // Backend may return 'warning' when account is created but email sending fails.
      if (response?.status === 'success' || response?.status === 'warning') {
        return response;
      } else {
        throw new Error(response?.message || 'Registration failed');
      }
    }),
    catchError(error => {
      return of({ success: false, error: error.message || 'Registration failed' });
    })
  );
}

login(email: string, password: string): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/login`, { email, password })
    .pipe(
      map(response => {
        if (response.status === 'success') {
          // Clear any stale admin JWT session when doing normal user login
          localStorage.removeItem('admin_token');

          // Save authentication data
          if (response.data?.token) {
            this.saveToken(response.data.token);
          }
          if (response.data?.userID) {
            localStorage.setItem('id', response.data.userID);
          }

          // Persist user role (e.g., 'user' or 'moderator')
          if (response.data?.role) {
            localStorage.setItem('user_role', response.data.role);
          } else {
            localStorage.setItem('user_role', 'user');
          }

          // If moderator, also store admin-like session fields for staff tools
          // This avoids forcing moderators to use the separate admin login.
          if ((response.data?.role || '').toLowerCase() === 'moderator') {
            const adminSession = response.data?.admin_session;
            if (adminSession?.admin_id) {
              localStorage.setItem('admin_id', String(adminSession.admin_id));
              localStorage.setItem('role', String(adminSession.role || 'moderator'));
              localStorage.setItem('username', String(adminSession.username || ''));
              localStorage.setItem('admin_user', JSON.stringify({
                id: adminSession.admin_id,
                username: adminSession.username,
                email: adminSession.email || '',
                role: adminSession.role || 'moderator',
                full_name: adminSession.full_name || ''
              }));
            }
          }

          localStorage.setItem('email', email);
            // Persist profile information for avatar usage in messaging
            if (response.data?.full_name) {
              localStorage.setItem('full_name', response.data.full_name);
            }
            if (response.data?.profile_image) {
              localStorage.setItem('profile_image', response.data.profile_image);
            } else {
              // Ensure key exists to avoid repeated null checks
              localStorage.setItem('profile_image', '');
            }
          
          // Save account status information
          if (response.data?.account_status) {
            localStorage.setItem('account_status', response.data.account_status);
          }
          if (response.data?.violation_count !== undefined && response.data?.violation_count !== null) {
            localStorage.setItem('violation_count', response.data.violation_count.toString());
          } else {
            localStorage.setItem('violation_count', '0');
          }
          
          // Check for return URL
          const returnUrl = localStorage.getItem('returnUrl') || '/home';
          localStorage.removeItem('returnUrl');
          this.router.navigate([returnUrl]);
        }
        return response;
      }),
      catchError(error => {
        return of({ success: false, error: error.message || 'Login failed' });
      })
    );
}

// Admin Login
adminLogin(username: string, password: string): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/admin/login`, { username, password })
    .pipe(
      map(response => {
        if (response.status === 'success') {
          return { 
            success: true, 
            token: response.data?.token,
            user: response.data?.user,
            message: response.message 
          };
        } else {
          return { 
            success: false, 
            message: response.message || 'Invalid admin credentials' 
          };
        }
      }),
      catchError(error => {
        return of({ 
          success: false, 
          message: error.message || 'Admin login failed' 
        });
      })
    );
}





  // Token handling
  saveToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return token !== null && token !== undefined;
  }

  logout(): void {
    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('id');
    localStorage.removeItem('userID');
    localStorage.removeItem('email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('returnUrl');
    localStorage.removeItem('account_status');
    localStorage.removeItem('violation_count');

    // Also clear staff/admin-like keys set for moderators
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_id');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    
    this.router.navigate(['/login']);
  }

  // Admin logout
  adminLogout(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('admin_id');
    localStorage.removeItem('full_name');
    localStorage.removeItem('email');
    this.router.navigate(['/admin-login']);
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }
}
