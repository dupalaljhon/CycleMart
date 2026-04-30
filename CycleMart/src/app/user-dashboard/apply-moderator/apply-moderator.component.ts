import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../api/api.service';

@Component({
  selector: 'app-apply-moderator',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatCardModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './apply-moderator.component.html',
  styleUrl: './apply-moderator.component.css'
})
export class ApplyModeratorComponent implements OnInit {
  @Input() embeddedMode: boolean = false;
  @Output() requestClose = new EventEmitter<void>();

  applicationForm!: FormGroup;
  isLoading = false;
  existingApplication: any = null;
  userId: number | null = null;

  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    // Get user ID directly from localStorage (it's stored as 'id', not in a user object)
    const userId = localStorage.getItem('id');
    this.userId = userId ? parseInt(userId) : null;
    

    this.initForm();
    this.checkExistingApplication();
  }

  initForm(): void {
    this.applicationForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      reason: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(1000)]],
      experience: ['', [Validators.maxLength(1000)]],
      agree_terms: [false, Validators.requiredTrue]
    });
  }

  checkExistingApplication(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.apiService.getUserModeratorApplication(this.userId).subscribe({
      next: (response: any) => {
        if (response.data && response.data.length > 0) {
          this.existingApplication = response.data[0];
          // Disable form if there's a pending or approved application
          if (this.existingApplication.status === 'pending' || 
              this.existingApplication.status === 'approved') {
            this.applicationForm.disable();
          }
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
      }
    });
  }

  submitApplication(): void {
    // Debug logging

    if (this.applicationForm.invalid || !this.userId) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.applicationForm.controls).forEach(key => {
        this.applicationForm.get(key)?.markAsTouched();
      });

      // Build specific error message
      const errors: string[] = [];

      if (!this.userId) {
        errors.push('User ID is missing - please log in again');
      }
      
      const fullNameControl = this.applicationForm.get('full_name');
      if (fullNameControl?.invalid) {
        if (fullNameControl.hasError('required')) {
          errors.push('Full name is required');
        } else if (fullNameControl.hasError('minlength')) {
          errors.push('Full name must be at least 3 characters');
        }
      }

      const reasonControl = this.applicationForm.get('reason');
      if (reasonControl?.invalid) {
        const reasonLength = this.getReasonCharacterCount();
        if (reasonControl.hasError('required')) {
          errors.push('Reason is required');
        } else if (reasonControl.hasError('minlength')) {
          errors.push(`Reason needs ${50 - reasonLength} more characters (minimum 50)`);
        }
      }

      const agreeTermsControl = this.applicationForm.get('agree_terms');
      if (agreeTermsControl?.invalid || !agreeTermsControl?.value) {
        errors.push('You must agree to the moderator guidelines');
      }

      const errorMessage = errors.length > 0 
        ? 'Please fix: ' + errors.join('; ') 
        : 'Please fill all required fields correctly';


      this.snackBar.open(errorMessage, 'Close', {
        duration: 6000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isLoading = true;
    const formData = {
      user_id: this.userId,
      ...this.applicationForm.value
    };

    this.apiService.submitModeratorApplication(formData).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.snackBar.open('Application submitted successfully! We will review it shortly.', 'Close', {
            duration: 5000,
            panelClass: ['success-snackbar']
          });
          this.applicationForm.disable();
          this.checkExistingApplication(); // Refresh application status
        } else {
          this.snackBar.open(response.message || 'Failed to submit application', 'Close', {
            duration: 4000,
            panelClass: ['error-snackbar']
          });
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        const errorMessage = error.error?.message || 'An error occurred while submitting your application';
        this.snackBar.open(errorMessage, 'Close', {
          duration: 4000,
          panelClass: ['error-snackbar']
        });
        this.isLoading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Under Review';
      case 'approved': return 'Approved - You are now a moderator!';
      case 'rejected': return 'Not Approved';
      default: return status;
    }
  }

  getReasonCharacterCount(): number {
    return this.applicationForm.get('reason')?.value?.length || 0;
  }

  getExperienceCharacterCount(): number {
    return this.applicationForm.get('experience')?.value?.length || 0;
  }
}
