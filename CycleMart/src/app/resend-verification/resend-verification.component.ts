import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../api/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-resend-verification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resend-verification.component.html',
  styleUrls: ['./resend-verification.component.css']
})
export class ResendVerificationComponent {
  email: string = '';
  isLoading: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.email.trim()) {
      this.showMessage('Please enter your email address.', 'error');
      return;
    }

    if (!this.validateEmail(this.email)) {
      this.showMessage('Please enter a valid email address.', 'error');
      return;
    }

    this.isLoading = true;
    this.message = '';

    this.apiService.resendVerificationEmail(this.email).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.status === 'success') {
          // Check if account is already verified
          if (response.message && response.message.includes('already verified')) {
            this.showMessage(response.message + ' You can login to your account now.', 'success');
          } else {
            this.showMessage('Verification email sent successfully! Please check your inbox.', 'success');
          }
        } else {
          this.showMessage(response.message || 'Failed to send verification email.', 'error');
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('Resend verification error:', error);
        this.showMessage(error.error?.message || 'An error occurred. Please try again.', 'error');
      }
    });
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private showMessage(text: string, type: 'success' | 'error'): void {
    this.message = text;
    this.messageType = type;
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}