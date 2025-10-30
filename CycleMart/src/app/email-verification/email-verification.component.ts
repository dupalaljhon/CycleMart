import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../api/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.css']
})
export class EmailVerificationComponent implements OnInit {
  token: string = '';
  isLoading: boolean = true;
  verificationStatus: 'loading' | 'success' | 'error' | 'expired' = 'loading';
  message: string = '';
  userEmail: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    // Get token from query parameters
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.verifyEmail();
      } else {
        this.verificationStatus = 'error';
        this.message = 'Invalid verification link. No token provided.';
        this.isLoading = false;
      }
    });
  }

  verifyEmail(): void {
    this.isLoading = true;
    this.verificationStatus = 'loading';

    this.apiService.verifyEmail(this.token).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.status === 'success') {
          this.verificationStatus = 'success';
          this.message = response.message || 'Email verified successfully!';
          this.userEmail = response.data?.email || '';
          
          // Check if account was already verified
          if (response.message && response.message.includes('already verified')) {
            // Account was already verified - no need to redirect, show login button immediately
            this.message = response.message;
          } else {
            // Fresh verification - redirect to login after 3 seconds
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 3000);
          }
        } else {
          this.verificationStatus = 'error';
          this.message = response.message || 'Verification failed.';
          
          // Check if token expired
          if (response.message?.includes('expired')) {
            this.verificationStatus = 'expired';
          }
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.verificationStatus = 'error';
        console.error('Verification error:', error);
        
        if (error.error?.message?.includes('expired')) {
          this.verificationStatus = 'expired';
          this.message = 'Verification link has expired.';
        } else {
          this.message = error.error?.message || 'An error occurred during verification.';
        }
      }
    });
  }

  resendVerification(): void {
    if (!this.userEmail) {
      // If we don't have the email, redirect to a resend page
      this.router.navigate(['/resend-verification']);
      return;
    }

    this.isLoading = true;
    this.apiService.resendVerificationEmail(this.userEmail).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.status === 'success') {
          this.message = 'Verification email sent! Please check your inbox.';
        } else {
          this.message = response.message || 'Failed to resend verification email.';
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.message = 'Failed to resend verification email. Please try again.';
        console.error('Resend error:', error);
      }
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToResendPage(): void {
    this.router.navigate(['/resend-verification']);
  }
}