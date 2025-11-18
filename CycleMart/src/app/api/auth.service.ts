import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // private baseUrl = 'http://api.cyclemart.shop/CycleMart-api/api';
  public baseUrl = 'http://api.cyclemart.shop/CycleMart-api/api';

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
//         console.error('Registration error:', error);
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
//           localStorage.setItem('email', email); // ✅ store email instead of username
//           this.router.navigate(['/home']); // ✅ navigate to sidenav after login
//         }
//         return response;
//       }),
//       catchError(error => {
//         console.error('Login error:', error);
//         return of({ success: false, error: error.message || 'Login failed' });
//       })
//     );
// }

register(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/register`, data).pipe(
    map(response => {
      if (response?.status === 'success') {
        return response;
      } else {
        throw new Error(response?.message || 'Registration failed');
      }
    }),
    catchError(error => {
      console.error('Registration error:', error);
      return of({ success: false, error: error.message || 'Registration failed' });
    })
  );
}

login(email: string, password: string): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/login`, { email, password })
    .pipe(
      map(response => {
        if (response.status === 'success') {
          // Save authentication data
          if (response.data?.token) {
            this.saveToken(response.data.token);
          }
          if (response.data?.userID) {
            localStorage.setItem('id', response.data.userID);
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
        console.error('Login error:', error);
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
        console.error('Admin login error:', error);
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
    localStorage.removeItem('returnUrl');
    localStorage.removeItem('account_status');
    localStorage.removeItem('violation_count');
    
    console.log('User logged out successfully');
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
