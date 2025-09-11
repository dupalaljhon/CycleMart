import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl = 'http://localhost/CycleMart/CycleMart/CycleMart-api/api';

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
          this.saveToken(response.data?.token);
          localStorage.setItem('email', email);
          this.router.navigate(['/home']);
        }
        return response;
      }),
      catchError(error => {
        console.error('Login error:', error);
        return of({ success: false, error: error.message || 'Login failed' });
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
    localStorage.removeItem('authToken');
    localStorage.removeItem('userID');
    localStorage.removeItem('email');
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }
}
