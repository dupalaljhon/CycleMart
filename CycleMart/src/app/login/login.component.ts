import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../api/auth.service';
import { ApiService } from '../api/api.service';
import { ThemeService } from '../services/theme.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, MatInputModule, MatButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  full_name: string = '';
  email: string = '';
  password: string = '';
  phone: string = '';
  address: string = '';
  termsAccepted: boolean = false;
  isLoginMode: boolean = true;
  isLoading: boolean = false;
  showResendVerification: boolean = false;
  verificationEmail: string = '';
  showTermsModal: boolean = false;
  
  // Password validation properties
  passwordErrors: string[] = [];
  showPasswordRequirements: boolean = false;

  constructor(
    private authService: AuthService, 
    private apiService: ApiService, 
    private router: Router,
    private themeService: ThemeService
  ) {}

  onSubmit() {
    if (this.isLoading) return;
    
    // Validate password for registration mode
    if (!this.isLoginMode && !this.validatePassword(this.password)) {
      alert('Please ensure your password meets all requirements:\n' + this.passwordErrors.join('\n'));
      return;
    }
    
    this.isLoading = true;
    this.showResendVerification = false;

    if (this.isLoginMode) {
      this.authService.login(this.email, this.password).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.status === 'success') {
            // Save userID to localStorage for profile use
            if (response.data?.userID) {
              localStorage.setItem('id', response.data.userID);
            }
            console.log('Login successful:', response);
            this.router.navigate(['/home']);
          } else {
            alert(response.message || 'Invalid email or password');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Login error:', error);
          alert('Invalid email or password');
        }
      });
    } else {
      this.authService.register({ 
        full_name: this.full_name,
        email: this.email, 
        password: this.password,
        phone: this.phone,
        address: this.address,
        terms_accepted: this.termsAccepted ? 1 : 0
      }).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Registration successful:', response);
          
          if (response.status === 'success') {
            if (response.data?.email_sent) {
              alert('Registration successful! Please check your email to verify your account.');
            } else {
              alert('Registration successful! However, there was an issue sending the verification email. You can request a new one below.');
              this.verificationEmail = this.email;
              this.showResendVerification = true;
            }
            this.isLoginMode = true;
            this.resetForm();
          } else {
            alert(response.message || 'Registration failed. Please try again.');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Registration error:', error);
          alert('Registration failed. Please try again.');
        }
      });
    }
  }

  toggleMode(event: Event) {
    event.preventDefault(); 
    this.isLoginMode = !this.isLoginMode;
    this.resetForm();
  }

  resetForm() {
    this.full_name = '';
    this.email = '';
    this.password = '';
    this.phone = '';
    this.address = '';
    this.termsAccepted = false;
    this.showResendVerification = false;
    this.verificationEmail = '';
    this.passwordErrors = [];
    this.showPasswordRequirements = false;
  }

  resendVerificationEmail() {
    if (!this.verificationEmail) {
      alert('Please enter your email address');
      return;
    }

    this.apiService.resendVerificationEmail(this.verificationEmail).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          alert('Verification email sent! Please check your inbox.');
          this.showResendVerification = false;
        } else {
          alert(response.message || 'Failed to send verification email');
        }
      },
      error: (error) => {
        console.error('Resend verification error:', error);
        alert('Failed to send verification email. Please try again.');
      }
    });
  }

  // Terms & Conditions Modal Methods
  openTermsModal() {
    this.showTermsModal = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeTermsModal() {
    this.showTermsModal = false;
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  acceptTermsAndClose() {
    this.termsAccepted = true;
    this.closeTermsModal();
  }

  // Password validation methods
  validatePassword(password: string): boolean {
    this.passwordErrors = [];
    
    if (password.length < 8) {
      this.passwordErrors.push('• At least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      this.passwordErrors.push('• Contains uppercase letters (A–Z)');
    }
    
    if (!/[a-z]/.test(password)) {
      this.passwordErrors.push('• Contains lowercase letters (a–z)');
    }
    
    if (!/[0-9]/.test(password)) {
      this.passwordErrors.push('• Contains numbers (0–9)');
    }
    
    return this.passwordErrors.length === 0;
  }

  onPasswordInput() {
    if (!this.isLoginMode && this.password.length > 0) {
      this.validatePassword(this.password);
      this.showPasswordRequirements = this.passwordErrors.length > 0;
    } else {
      this.showPasswordRequirements = false;
    }
  }

  getPasswordStrength(): string {
    if (this.password.length === 0) return '';
    
    let strength = 0;
    if (this.password.length >= 8) strength++;
    if (/[A-Z]/.test(this.password)) strength++;
    if (/[a-z]/.test(this.password)) strength++;
    if (/[0-9]/.test(this.password)) strength++;
    
    switch (strength) {
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      default: return '';
    }
  }

  getPasswordStrengthColor(): string {
    const strength = this.getPasswordStrength();
    switch (strength) {
      case 'Weak': return 'text-red-500';
      case 'Fair': return 'text-orange-500';
      case 'Good': return 'text-yellow-500';
      case 'Strong': return 'text-green-500';
      default: return '';
    }
  }

  getPasswordStrengthWidth(): string {
    const strength = this.getPasswordStrength();
    switch (strength) {
      case 'Weak': return 'w-1/4';
      case 'Fair': return 'w-2/4';
      case 'Good': return 'w-3/4';
      case 'Strong': return 'w-full';
      default: return 'w-0';
    }
  }

  // Navigation method for admin login
  navigateToAdminLogin() {
    this.router.navigate(['/admin-login']);
  }
}
