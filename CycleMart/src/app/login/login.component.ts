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
  street: string = '';
  barangay: string = '';
  city: string = '';
  province: string = '';
  termsAccepted: boolean = false;
  isLoginMode: boolean = true;
  isLoading: boolean = false;
  showTermsModal: boolean = false;
  
  // UI state properties
  showPassword: boolean = false;
  showEmailError: boolean = false;
  emailError: string = '';
  showEmailRequirements: boolean = false;
  showPasswordRequirementsInfo: boolean = false;
  
  // Password validation properties
  passwordErrors: string[] = [];
  showPasswordRequirements: boolean = false;

  // Modal properties
  showNotificationModal: boolean = false;
  notificationMessage: string = '';
  notificationType: 'success' | 'error' = 'success';
  showActionButton: boolean = false;
  actionButtonText: string = '';
  actionCallback: (() => void) | null = null;

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
      this.showErrorMessage('⚠️ Please ensure your password meets all requirements:\n\n' + this.passwordErrors.join('\n'));
      return;
    }
    
    this.isLoading = true;

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
          } else if (response.status === 'error' && response.data?.requires_verification) {
            // User needs to verify email
            this.showErrorMessage(
              '⚠️ ' + response.message + '\n\nClick below to resend verification email.',
              '📧 Resend Verification',
              () => this.router.navigate(['/resend-verification'])
            );
          } else {
            // Handle various login errors with user-friendly messages
            let errorMessage = response.message || 'Invalid email or password';
            
            // Make error messages more user-friendly
            if (errorMessage.toLowerCase().includes('invalid credentials')) {
              errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            } else if (errorMessage.toLowerCase().includes('user not found')) {
              errorMessage = 'No account found with this email address. Please check your email or create a new account.';
            } else if (errorMessage.toLowerCase().includes('email and password required')) {
              errorMessage = 'Please enter both email and password to sign in.';
            }
            
            this.showErrorMessage('🔒 ' + errorMessage);
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Login error:', error);
          
          // Check if it's a verification error
          if (error.error?.data?.requires_verification) {
            this.showErrorMessage(
              '⚠️ ' + error.error.message + '\n\nClick below to resend verification email.',
              '📧 Resend Verification',
              () => this.router.navigate(['/resend-verification'])
            );
          } else {
            // Handle network or other login errors
            let errorMessage = 'Invalid email or password';
            
            // Check if we have a specific error message from the server
            if (error.error && error.error.message) {
              errorMessage = error.error.message;
              
              // Make error messages more user-friendly
              if (errorMessage.toLowerCase().includes('invalid credentials')) {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.';
              } else if (errorMessage.toLowerCase().includes('user not found')) {
                errorMessage = 'No account found with this email address. Please check your email or create a new account.';
              }
            }
            
            this.showErrorMessage('🔒 ' + errorMessage);
          }
        }
      });
    } else {
      this.authService.register({ 
        full_name: this.full_name,
        email: this.email, 
        password: this.password,
        phone: this.phone,
        street: this.street,
        barangay: this.barangay,
        city: this.city,
        province: this.province,
        terms_accepted: this.termsAccepted ? 1 : 0
      }).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Registration successful:', response);
          
          if (response.status === 'success') {
            if (response.data?.verification_email_sent) {
              this.showSuccessMessage('🎉 Registration successful! Verification email sent to your inbox. Please check your email to verify your account before logging in.');
            } else {
              this.showErrorMessage('⚠️ Registration successful! However, verification email failed to send. Please contact support.');
            }
            this.isLoginMode = true;
            this.resetForm();
          } else if (response.status === 'warning') {
            // Registration successful but email failed
            this.showErrorMessage('⚠️ Registration completed with warnings. Please contact support if you need assistance.');
            this.isLoginMode = true;
            this.resetForm();
          } else {
            this.showErrorMessage(response.message || 'Registration failed. Please try again.');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Registration error:', error);
          this.showErrorMessage('❌ Registration failed. Please try again.');
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
    this.street = '';
    this.barangay = '';
    this.city = '';
    this.province = '';
    this.termsAccepted = false;
    this.passwordErrors = [];
    this.showPasswordRequirements = false;
    this.showEmailError = false;
    this.emailError = '';
    this.showEmailRequirements = false;
    this.showPasswordRequirementsInfo = false;
    this.showPassword = false;
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

  // Email validation methods
  onEmailInput() {
    if (this.email && !this.validateEmail(this.email)) {
      this.showEmailError = true;
      this.emailError = 'Please enter a valid email address';
    } else {
      this.showEmailError = false;
      this.emailError = '';
    }
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  toggleEmailRequirements() {
    this.showEmailRequirements = !this.showEmailRequirements;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  togglePasswordRequirementsInfo() {
    this.showPasswordRequirementsInfo = !this.showPasswordRequirementsInfo;
  }

  // Toast/Alert helper methods
  private showSuccessMessage(message: string) {
    this.notificationMessage = message;
    this.notificationType = 'success';
    this.showNotificationModal = true;
    this.showActionButton = false;
    this.actionCallback = null;
    
    // Auto-close after 4 seconds
    setTimeout(() => {
      this.closeNotificationModal();
    }, 4000);
  }

  private showErrorMessage(message: string, actionText?: string, actionCallback?: () => void) {
    this.notificationMessage = message;
    this.notificationType = 'error';
    this.showNotificationModal = true;
    
    if (actionText && actionCallback) {
      this.showActionButton = true;
      this.actionButtonText = actionText;
      this.actionCallback = actionCallback;
      // Don't auto-close if there's an action button
    } else {
      this.showActionButton = false;
      this.actionCallback = null;
      // Auto-close after 5 seconds (longer for errors)
      setTimeout(() => {
        this.closeNotificationModal();
      }, 5000);
    }
  }

  closeNotificationModal() {
    this.showNotificationModal = false;
    this.notificationMessage = '';
    this.showActionButton = false;
    this.actionCallback = null;
  }

  executeAction() {
    if (this.actionCallback) {
      this.actionCallback();
    }
    this.closeNotificationModal();
  }
}
