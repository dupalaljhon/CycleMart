import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../api/api.service';

export interface AddAdminDialogData {
  admin?: any;
  isEdit?: boolean;
}

@Component({
  selector: 'app-add-admin-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <div class="bg-white rounded-lg">
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">
          {{ data.isEdit ? 'Edit Administrator' : 'Add New Administrator' }}
        </h2>
        <button mat-icon-button (click)="onCancel()" class="text-gray-400 hover:text-gray-600">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="adminForm" (ngSubmit)="onSubmit()" class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <!-- Username -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" placeholder="Enter username">
            <mat-icon matSuffix>account_circle</mat-icon>
            <mat-error *ngIf="adminForm.get('username')?.hasError('required')">
              Username is required
            </mat-error>
            <mat-error *ngIf="adminForm.get('username')?.hasError('minlength')">
              Username must be at least 3 characters
            </mat-error>
          </mat-form-field>

          <!-- Full Name -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Full Name</mat-label>
            <input matInput formControlName="full_name" placeholder="Enter full name">
            <mat-icon matSuffix>person</mat-icon>
            <mat-error *ngIf="adminForm.get('full_name')?.hasError('required')">
              Full name is required
            </mat-error>
          </mat-form-field>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <!-- Email -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" placeholder="Enter email">
            <mat-icon matSuffix>email</mat-icon>
            <mat-error *ngIf="adminForm.get('email')?.hasError('required')">
              Email is required
            </mat-error>
            <mat-error *ngIf="adminForm.get('email')?.hasError('email')">
              Please enter a valid email
            </mat-error>
          </mat-form-field>

          <!-- Role -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Role</mat-label>
            <mat-select formControlName="role">
              <mat-option value="super_admin">Super Administrator</mat-option>
              <mat-option value="moderator">Moderator</mat-option>
              <mat-option value="support">Support Staff</mat-option>
            </mat-select>
            <mat-icon matSuffix>shield</mat-icon>
            <mat-error *ngIf="adminForm.get('role')?.hasError('required')">
              Role is required
            </mat-error>
          </mat-form-field>
        </div>

        <!-- Password (only for new admins) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" *ngIf="!data.isEdit">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Password</mat-label>
            <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password" placeholder="Enter password">
            <button mat-icon-button matSuffix (click)="hidePassword = !hidePassword" type="button">
              <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
            </button>
            <mat-error *ngIf="adminForm.get('password')?.hasError('required')">
              Password is required
            </mat-error>
            <mat-error *ngIf="adminForm.get('password')?.hasError('minlength')">
              Password must be at least 6 characters
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Confirm Password</mat-label>
            <input matInput [type]="hideConfirmPassword ? 'password' : 'text'" formControlName="confirmPassword" placeholder="Confirm password">
            <button mat-icon-button matSuffix (click)="hideConfirmPassword = !hideConfirmPassword" type="button">
              <mat-icon>{{hideConfirmPassword ? 'visibility_off' : 'visibility'}}</mat-icon>
            </button>
            <mat-error *ngIf="adminForm.get('confirmPassword')?.hasError('required')">
              Please confirm your password
            </mat-error>
            <mat-error *ngIf="adminForm.get('confirmPassword')?.hasError('passwordMismatch')">
              Passwords do not match
            </mat-error>
          </mat-form-field>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button mat-button type="button" (click)="onCancel()" class="text-gray-600">
            Cancel
          </button>
          <button mat-raised-button 
                  color="primary" 
                  type="submit" 
                  [disabled]="adminForm.invalid || isSubmitting"
                  class="min-w-[120px]">
            <mat-icon *ngIf="isSubmitting" class="animate-spin mr-2">refresh</mat-icon>
            {{ isSubmitting ? 'Saving...' : (data.isEdit ? 'Update' : 'Create') }}
          </button>
        </div>
      </form>
    </div>
  `
})
export class AddAdminDialogComponent {
  adminForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    public dialogRef: MatDialogRef<AddAdminDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddAdminDialogData
  ) {
    this.adminForm = this.createForm();
    
    if (data.isEdit && data.admin) {
      this.populateForm(data.admin);
    }
  }

  private createForm(): FormGroup {
    if (!this.data.isEdit) {
      // Create form with password fields for new admin
      const form = this.fb.group({
        username: ['', [Validators.required, Validators.minLength(3)]],
        full_name: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        role: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]]
      }, {
        validators: this.passwordMatchValidator
      });
      return form;
    } else {
      // Create form without password fields for editing
      return this.fb.group({
        username: ['', [Validators.required, Validators.minLength(3)]],
        full_name: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        role: ['', [Validators.required]]
      });
    }
  }

  private passwordMatchValidator(control: any) {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    if (confirmPassword?.hasError('passwordMismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['passwordMismatch'];
      if (Object.keys(errors).length === 0) {
        confirmPassword.setErrors(null);
      } else {
        confirmPassword.setErrors(errors);
      }
    }
    
    return null;
  }

  private populateForm(admin: any): void {
    this.adminForm.patchValue({
      username: admin.username,
      full_name: admin.full_name,
      email: admin.email,
      role: admin.role
    });
  }

  onSubmit(): void {
    if (this.adminForm.valid) {
      this.isSubmitting = true;
      const formData = this.adminForm.value;
      
      if (this.data.isEdit) {
        // Update admin
        const updateData = {
          admin_id: this.data.admin.admin_id,
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role
        };
        
        this.apiService.updateAdmin(updateData).subscribe({
          next: (response) => {
            this.isSubmitting = false;
            if (response.status === 'success') {
              this.dialogRef.close({ success: true, action: 'update', data: response.data });
            } else {
              this.dialogRef.close({ success: false, message: response.message });
            }
          },
          error: (error) => {
            this.isSubmitting = false;
            this.dialogRef.close({ success: false, message: 'Failed to update administrator' });
          }
        });
      } else {
        // Create new admin
        const createData = {
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          password: formData.password
        };
        
        this.apiService.createAdmin(createData).subscribe({
          next: (response) => {
            this.isSubmitting = false;
            if (response.status === 'success') {
              this.dialogRef.close({ success: true, action: 'create', data: response.data });
            } else {
              this.dialogRef.close({ success: false, message: response.message });
            }
          },
          error: (error) => {
            this.isSubmitting = false;
            this.dialogRef.close({ success: false, message: 'Failed to create administrator' });
          }
        });
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }
}