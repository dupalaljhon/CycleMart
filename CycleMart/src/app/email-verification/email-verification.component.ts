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
  isLoading = true;
  isSuccess = false;
  isError = false;
  message = '';
  token = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    // Get token from URL parameters
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.verifyEmail();
      } else {
        this.showError('Invalid verification link');
      }
    });
  }

  verifyEmail(): void {
    this.apiService.verifyEmail(this.token).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          this.isSuccess = true;
          this.message = response.data?.message || 'Email verified successfully!';
          // Redirect to login after 3 seconds
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        } else {
          this.showError(response.message || 'Verification failed');
        }
      },
      error: (error) => {
        console.error('Verification error:', error);
        this.showError('Verification failed. Please try again or contact support.');
      }
    });
  }

  private showError(message: string): void {
    this.isLoading = false;
    this.isError = true;
    this.message = message;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  resendVerification(): void {
    // For now, just redirect to login where user can request new verification
    this.router.navigate(['/login']);
  }
}
