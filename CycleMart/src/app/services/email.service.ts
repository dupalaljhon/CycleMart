import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/**
 * Email Service
 * 
 * Handles email-related API operations including verification emails,
 * password reset emails, and other email communications.
 */

// Interface for API responses
export interface EmailApiResponse {
  status: 'success' | 'error';
  message: string;
}

// Interface for verification email request
export interface VerificationEmailRequest {
  email: string;
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  
  // API base URL - adjust this based on your environment
  private readonly API_BASE_URL = 'http://localhost/CycleMart/CycleMart/CycleMart-api';
  
  // HTTP headers for JSON requests
  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    })
  };

  constructor(private http: HttpClient) { }

  /**
   * Send verification email to user
   * 
   * @param email - User's email address
   * @param token - Verification token
   * @returns Observable<EmailApiResponse> - API response with status and message
   */
  sendVerificationEmail(email: string, token: string): Observable<EmailApiResponse> {
    // Validate input parameters
    if (!email || !token) {
      return throwError(() => new Error('Email and token are required'));
    }

    // Validate email format
    if (!this.isValidEmail(email)) {
      return throwError(() => new Error('Invalid email format'));
    }

    // Prepare request payload
    const payload: VerificationEmailRequest = {
      email: email.trim(),
      token: token.trim()
    };

    // API endpoint URL
    const url = `${this.API_BASE_URL}/api/sendVerification.php`;

    // Make HTTP POST request
    return this.http.post<EmailApiResponse>(url, payload, this.httpOptions)
      .pipe(
        map(response => {
          // Validate response structure
          if (!response || typeof response.status !== 'string') {
            throw new Error('Invalid response format from server');
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Send password reset email (placeholder for future implementation)
   * 
   * @param email - User's email address
   * @returns Observable<EmailApiResponse>
   */
  sendPasswordResetEmail(email: string): Observable<EmailApiResponse> {
    if (!email || !this.isValidEmail(email)) {
      return throwError(() => new Error('Valid email address is required'));
    }

    const payload = { email: email.trim() };
    const url = `${this.API_BASE_URL}/api/sendPasswordReset.php`;

    return this.http.post<EmailApiResponse>(url, payload, this.httpOptions)
      .pipe(
        map(response => {
          if (!response || typeof response.status !== 'string') {
            throw new Error('Invalid response format from server');
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Resend verification email (convenience method)
   * 
   * @param email - User's email address
   * @param token - New verification token
   * @returns Observable<EmailApiResponse>
   */
  resendVerificationEmail(email: string, token: string): Observable<EmailApiResponse> {
    return this.sendVerificationEmail(email, token);
  }

  /**
   * Validate email format using regex
   * 
   * @param email - Email address to validate
   * @returns boolean - True if valid email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Handle HTTP errors
   * 
   * @param error - HTTP error response
   * @returns Observable<never> - Error observable
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unexpected error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.status >= 400 && error.status < 500) {
        // Client error (4xx)
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else {
          errorMessage = `Client Error: ${error.status} - ${error.statusText}`;
        }
      } else if (error.status >= 500) {
        // Server error (5xx)
        errorMessage = 'Server error occurred. Please try again later.';
      } else {
        errorMessage = `HTTP Error: ${error.status} - ${error.statusText}`;
      }
    }

    console.error('EmailService Error:', {
      status: error.status,
      statusText: error.statusText,
      message: errorMessage,
      error: error.error
    });

    return throwError(() => new Error(errorMessage));
  };

  /**
   * Check if the email service is available
   * 
   * @returns Observable<boolean> - True if service is available
   */
  checkServiceHealth(): Observable<boolean> {
    const url = `${this.API_BASE_URL}/api/health.php`;
    
    return this.http.get(url, { 
      ...this.httpOptions,
      responseType: 'text' as 'json'
    }).pipe(
      map(() => true),
      catchError(() => {
        console.warn('Email service health check failed');
        return throwError(() => new Error('Email service is not available'));
      })
    );
  }
}