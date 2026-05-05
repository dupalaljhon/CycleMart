import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';

interface Admin {
  admin_id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-admin-monitoring',
  imports: [
    CommonModule, 
    AdminSidenavComponent,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatSortModule
  ],
  templateUrl: './admin-monitoring.component.html',
  styleUrls: ['./admin-monitoring.component.css']
})
export class AdminMonitoringComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  // Pagination settings
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];
  
  admins: Admin[] = [];
  dataSource = new MatTableDataSource<Admin>([]);
  isLoading = true;
  isProcessing = false; // Add processing state
  currentUserRole = '';
  
  // Modal properties
  isModalOpen = false;
  isEditMode = false;
  currentEditAdmin: Admin | null = null;
  adminForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  isSubmitting = false;
  autoGeneratePassword = false;
  generatedPassword = '';
  showGeneratedPasswordModal = false;
  
  displayedColumns: string[] = [
    'username',
    'full_name', 
    'email', 
    'role', 
    'status', 
    'created_at',
    'actions'
  ];

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    // Get current admin role for permission checks
    this.currentUserRole = localStorage.getItem('role') || 'moderator';
    // Initialize form
    this.adminForm = this.createForm();
  }

  ngOnInit() {
    this.loadAdmins();
  }

  ngAfterViewInit() {
    // Set up paginator and sort after view initializes
    // Will be reconnected when data loads due to *ngIf condition
    this.connectPaginatorAndSort();
  }

  private connectPaginatorAndSort() {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.pageSize = this.pageSize;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  loadAdmins() {
    this.isLoading = true;
    this.apiService.getAllAdmins().subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.admins = response.data;
          this.dataSource.data = this.admins;
          
          // Reconnect paginator after data loads and view updates
          setTimeout(() => this.connectPaginatorAndSort(), 0);
        } else {
          this.showError('Failed to load administrators');
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.showError('Error loading administrators');
        this.isLoading = false;
      }
    });
  }

  private isSuperAdminRole(role: string): boolean {
    return role === 'super admin' || role === 'super_admin';
  }

  // Statistics methods
  getSuperAdminCount(): number {
    return this.dataSource.data.filter(admin => this.isSuperAdminRole(admin.role)).length;
  }

  getModeratorCount(): number {
    return this.dataSource.data.filter(admin => admin.role === 'moderator').length;
  }

  getSupportCount(): number {
    return this.dataSource.data.filter(admin => admin.role === 'support').length;
  }

  getActiveAdminCount(): number {
    return this.dataSource.data.filter(admin => admin.status === 'active').length;
  }

  // UI Helper Methods
  getRoleIcon(role: string): string {
    switch (role) {
      case 'super admin':
      case 'super_admin':
        return 'admin_panel_settings';
      case 'moderator':
        return 'shield';
      case 'support':
        return 'support_agent';
      default:
        return 'person';
    }
  }

  formatRole(role: string): string {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getRoleColor(role: string): string {
    switch (role) {
      case 'super admin':
      case 'super_admin':
        return 'text-black bg-white border border-gray-300';
      case 'moderator':
        return 'text-black bg-white border border-gray-300';
      default:
        return 'text-black bg-white border border-gray-300';
    }
  }

  getStatusColor(status: string): string {
    return status === 'active' 
      ? 'text-black bg-white border border-gray-300' 
      : 'text-black bg-white border border-gray-300';
  }

  // Role-based access control methods
  canCreateAdmin(): boolean {
    const canCreate = this.isSuperAdminRole(this.currentUserRole);
    return canCreate;
  }

  canEditAdmin(admin: Admin): boolean {
    if (this.isSuperAdminRole(this.currentUserRole)) return true;
    // Moderators can manage support accounts and other moderators (but not super admins)
    if (this.currentUserRole === 'moderator' && (admin.role === 'support' || admin.role === 'moderator')) return true;
    return false;
  }

  canDeleteAdmin(admin: Admin): boolean {
    if (this.isSuperAdminRole(this.currentUserRole) && !this.isSuperAdminRole(admin.role)) return true;
    return false;
  }

  openAddAdminDialog() {
    if (this.isProcessing) return; // Prevent multiple clicks
    
    this.isEditMode = false;
    this.currentEditAdmin = null;
    this.adminForm = this.createForm();
    this.isModalOpen = true;
  }

  editAdmin(admin: Admin) {
    if (this.isProcessing) {
      return; // Prevent multiple clicks
    }
    
    // Check permissions
    if (!this.canEditAdmin(admin)) {
      this.showError('You do not have permission to edit this administrator');
      return;
    }

    this.isEditMode = true;
    this.currentEditAdmin = admin;
    this.adminForm = this.createForm();
    this.populateForm(admin);
    this.isModalOpen = true;
  }

  // Modal methods
  createForm(): FormGroup {
    if (!this.isEditMode) {
      // Create form with password fields for new admin
      const form = this.fb.group({
        username: ['', [Validators.required, Validators.minLength(3)]],
        full_name: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        role: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
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

  /**
   * Password strength validator
   * Requires: 8+ chars, uppercase, lowercase, number, special char
   */
  private passwordStrengthValidator(control: any) {
    const password = control.value;
    if (!password) return null;

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const passwordValid = hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

    if (!passwordValid) {
      return {
        weakPassword: {
          hasUpperCase,
          hasLowerCase,
          hasNumber,
          hasSpecialChar
        }
      };
    }

    return null;
  }

  /**
   * Generate a secure random password
   * 12 characters with uppercase, lowercase, numbers, and special chars
   */
  generateSecurePassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{};\':"|,.<>/?';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';
    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining characters (total 12)
    for (let i = password.length; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Toggle auto-generate password feature
   */
  toggleAutoGeneratePassword(): void {
    // Note: autoGeneratePassword is already toggled by ngModel in the template
    // This method handles the side effects of the toggle
    
    if (this.autoGeneratePassword) {
      // Generate and set password
      const password = this.generateSecurePassword();
      this.adminForm.patchValue({
        password: password,
        confirmPassword: password
      });
      // Disable password fields
      this.adminForm.get('password')?.disable();
      this.adminForm.get('confirmPassword')?.disable();
    } else {
      // Clear and enable password fields
      this.adminForm.patchValue({
        password: '',
        confirmPassword: ''
      });
      this.adminForm.get('password')?.enable();
      this.adminForm.get('confirmPassword')?.enable();
    }
  }

  /**
   * Helper methods for password validation checks in template
   */
  hasMinLength(password: string): boolean {
    return password?.length >= 8;
  }

  hasUpperCase(password: string): boolean {
    return /[A-Z]/.test(password);
  }

  hasLowerCase(password: string): boolean {
    return /[a-z]/.test(password);
  }

  hasNumber(password: string): boolean {
    return /[0-9]/.test(password);
  }

  hasSpecialChar(password: string): boolean {
    return /[!@#$%^&*()_+\-=\[\]{};':\"|,.<>\/?]/.test(password);
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

  onModalSubmit(): void {
    if (this.adminForm.valid) {
      this.isSubmitting = true;
      const formData = this.adminForm.value;
      
      if (this.isEditMode && this.currentEditAdmin) {
        // Update admin
        const updateData = {
          admin_id: this.currentEditAdmin.admin_id,
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          updated_by_role: this.currentUserRole, // Add current user's role for permission check
          updated_by_id: parseInt(localStorage.getItem('admin_id') || '0') // Add current user's ID
        };
        
        this.apiService.updateAdmin(updateData).subscribe({
          next: (response) => {
            this.isSubmitting = false;
            if (response.status === 'success') {
              this.showMessage(`✅ Administrator "${formData.username}" updated successfully`);
              this.closeModal();
              this.loadAdmins(); // Refresh the list
            } else {
              this.showError(response.message || 'Failed to update administrator');
            }
          },
          error: (error) => {
            this.isSubmitting = false;
            this.showError('Failed to update administrator');
          }
        });
      } else {
        // Create new admin
        // Get password from form (works for both manual and auto-generated)
        const password = this.autoGeneratePassword 
          ? this.adminForm.getRawValue().password // getRawValue() gets disabled fields too
          : formData.password;

        const createData = {
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          password: password,
          created_by_role: this.currentUserRole // Add current user's role for permission check
        };
        
        this.apiService.createAdmin(createData).subscribe({
          next: (response) => {
            this.isSubmitting = false;
            if (response.status === 'success') {
              // If password was auto-generated, show it to the admin
              if (this.autoGeneratePassword) {
                this.generatedPassword = password;
                this.showGeneratedPasswordModal = true;
              } else {
                this.showMessage(`✅ Administrator "${formData.username}" created successfully`);
                this.closeModal();
                this.loadAdmins(); // Refresh the list
              }
            } else {
              this.showError(response.message || 'Failed to create administrator');
            }
          },
          error: (error) => {
            this.isSubmitting = false;
            this.showError('Failed to create administrator');
          }
        });
      }
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isEditMode = false;
    this.currentEditAdmin = null;
    this.isSubmitting = false;
    this.hidePassword = true;
    this.hideConfirmPassword = true;
    this.autoGeneratePassword = false;
    this.adminForm.reset();
  }

  closeGeneratedPasswordModal(): void {
    this.showGeneratedPasswordModal = false;
    this.generatedPassword = '';
    this.showMessage(`✅ Administrator "${this.adminForm.value.username}" created successfully`);
    this.closeModal();
    this.loadAdmins(); // Refresh the list
  }

  copyPasswordToClipboard(): void {
    if (this.generatedPassword) {
      navigator.clipboard.writeText(this.generatedPassword).then(() => {
        this.showMessage('✅ Password copied to clipboard!');
      }).catch(() => {
        this.showError('Failed to copy password');
      });
    }
  }

  // Enhanced block access function
  blockAdminAccess(admin: Admin) {
    if (this.isProcessing) return; // Prevent multiple clicks
    
    // Check permissions
    if (!this.canEditAdmin(admin)) {
      this.showError('You do not have permission to block this administrator');
      return;
    }

    // Prevent self-blocking
    if (admin.username === this.getCurrentUsername()) {
      this.showError('You cannot block your own access');
      return;
    }

    const newStatus = admin.status === 'active' ? 'blocked' : 'active';
    const action = newStatus === 'active' ? 'unblock' : 'block';
    const actionIcon = newStatus === 'active' ? '✅' : '❌';
    
    const confirmMessage = `${actionIcon} ${action.charAt(0).toUpperCase() + action.slice(1)} Administrator Access\n\n` +
      `Administrator: ${admin.full_name} (${admin.username})\n` +
      `Email: ${admin.email}\n` +
      `Current Status: ${admin.status}\n` +
      `New Status: ${newStatus}\n\n` +
      `${action === 'block' ? 
        'This will prevent the administrator from logging in and accessing the system.' : 
        'This will restore login access for the administrator.'}\n\n` +
      `Are you sure you want to ${action} access for this administrator?`;

    if (confirm(confirmMessage)) {
      this.isProcessing = true;
      this.showMessage(`${action.charAt(0).toUpperCase() + action.slice(1)}ing administrator access...`);

      this.apiService.updateAdmin({
        admin_id: admin.admin_id,
        username: admin.username,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
        status: newStatus,
        updated_by_role: this.currentUserRole, // Add current user's role for permission check
        updated_by_id: parseInt(localStorage.getItem('admin_id') || '0') // Add current user's ID
      }).subscribe({
        next: (response) => {
          this.isProcessing = false;
          if (response.status === 'success') {
            this.showMessage(`${actionIcon} Administrator "${admin.username}" access ${action}ed successfully`);
            this.loadAdmins(); // Refresh the list
          } else {
            this.showError(response.message || `Failed to ${action} administrator access`);
          }
        },
        error: (error) => {
          this.isProcessing = false;
          this.showError(`❌ Error ${action}ing administrator access. Please try again.`);
        }
      });
    }
  }

  // Helper function to get current username
  getCurrentUsername(): string {
    return localStorage.getItem('username') || '';
  }

  deleteAdmin(admin: Admin) {
    if (this.isProcessing) return; // Prevent multiple clicks
    
    // Check permissions
    if (!this.canDeleteAdmin(admin)) {
      this.showError('You do not have permission to delete this administrator');
      return;
    }

    // Prevent self-deletion
    if (admin.username === this.getCurrentUsername()) {
      this.showError('You cannot delete your own account');
      return;
    }

    const confirmMessage = `âš ï¸ Delete Administrator Confirmation\n\n` +
      `You are about to permanently delete:\n` +
      `â€¢ Username: ${admin.username}\n` +
      `â€¢ Name: ${admin.full_name}\n` +
      `â€¢ Email: ${admin.email}\n` +
      `â€¢ Role: ${this.formatRole(admin.role)}\n\n` +
      `This action cannot be undone. Are you sure?`;

    if (confirm(confirmMessage)) {
      this.isProcessing = true;
      this.showMessage('Deleting administrator...');

      this.apiService.deleteAdmin({ 
        admin_id: admin.admin_id,
        deleted_by_role: this.currentUserRole, // Add current user's role for permission check
        deleted_by_id: parseInt(localStorage.getItem('admin_id') || '0') // Add current user's ID
      }).subscribe({
        next: (response) => {
          this.isProcessing = false;
          if (response.status === 'success') {
            this.showMessage(`❌ Administrator "${admin.username}" deleted successfully`);
            this.loadAdmins(); // Refresh the list
          } else {
            this.showError(response.message || 'Failed to delete administrator');
          }
        },
        error: (error) => {
          this.isProcessing = false;
          this.showError('❌ Error deleting administrator. Please try again.');
        }
      });
    }
  }

  toggleAdminStatus(admin: Admin) {
    if (this.isProcessing) return; // Prevent multiple clicks
    
    // Check permissions
    if (!this.canEditAdmin(admin)) {
      this.showError('You do not have permission to modify this administrator');
      return;
    }

    const newStatus = admin.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    const actionIcon = newStatus === 'active' ? '✅' : '❌';
    
    const confirmMessage = `${actionIcon} ${action.charAt(0).toUpperCase() + action.slice(1)} Administrator\n\n` +
      `Administrator: ${admin.full_name} (${admin.username})\n` +
      `Current Status: ${admin.status}\n` +
      `New Status: ${newStatus}\n\n` +
      `Are you sure you want to ${action} this administrator?`;

    if (confirm(confirmMessage)) {
      this.isProcessing = true;
      this.showMessage(`${action.charAt(0).toUpperCase() + action.slice(1)}ing administrator...`);

      this.apiService.updateAdmin({
        admin_id: admin.admin_id,
        username: admin.username,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
        status: newStatus,
        updated_by_role: this.currentUserRole, // Add current user's role for permission check
        updated_by_id: parseInt(localStorage.getItem('admin_id') || '0') // Add current user's ID
      }).subscribe({
        next: (response) => {
          this.isProcessing = false;
          if (response.status === 'success') {
            this.showMessage(`${actionIcon} Administrator "${admin.username}" ${action}d successfully`);
            this.loadAdmins(); // Refresh the list
          } else {
            this.showError(response.message || `Failed to ${action} administrator`);
          }
        },
        error: (error) => {
          this.isProcessing = false;
          this.showError(`❌ Error ${action}ing administrator. Please try again.`);
        }
      });
    }
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }

  // Temporary method to fix role permissions for testing
  updateRoleToSuperAdmin() {
    if (confirm('This is a temporary fix. Update your role to super admin for testing?')) {
      localStorage.setItem('role', 'super admin');
      this.currentUserRole = 'super admin';
      this.showMessage('âœ… Role updated to super admin. Please refresh the page.');
    }
  }
}
