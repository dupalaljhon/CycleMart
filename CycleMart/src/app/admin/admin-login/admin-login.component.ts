import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../api/auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent {
  adminLoginForm: FormGroup;
  isLoading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.adminLoginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  onAdminLogin() {
    if (this.adminLoginForm.valid) {
      this.isLoading = true;
      this.error = '';
      
      const { username, password } = this.adminLoginForm.value;
      
      this.authService.adminLogin(username, password).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.success) {
            // Store admin token and user info
            localStorage.setItem('admin_token', response.token);
            localStorage.setItem('admin_user', JSON.stringify(response.user));

            // Navigate to admin dashboard
            this.router.navigate(['/admin-dashboard']);
          } else {
            this.error = response.message || 'Invalid admin credentials';
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.error = 'Login failed. Please try again.';
          console.error('Admin login error:', error);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  navigateToUserLogin() {
    this.router.navigate(['/login']);
  }

  private markFormGroupTouched() {
    Object.keys(this.adminLoginForm.controls).forEach(key => {
      const control = this.adminLoginForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.adminLoginForm.get(fieldName);
    if (control?.errors && control?.touched) {
      if (control.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
    }
    return '';
  }
}
