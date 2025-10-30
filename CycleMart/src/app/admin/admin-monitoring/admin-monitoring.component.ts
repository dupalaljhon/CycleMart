import { Component, OnInit } from '@angular/core';
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
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './admin-monitoring.component.html',
  styleUrl: './admin-monitoring.component.css'
})
export class AdminMonitoringComponent implements OnInit {
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
    console.log('Current user role:', this.currentUserRole);
    console.log('Current username:', this.getCurrentUsername());
    console.log('All localStorage items:', {
      role: localStorage.getItem('role'),
      username: localStorage.getItem('username'),
      admin_id: localStorage.getItem('admin_id'),
      admin_user: localStorage.getItem('admin_user')
    });
    
    // Initialize form
    this.adminForm = this.createForm();
  }

  ngOnInit() {
    this.loadAdmins();
  }

  loadAdmins() {
    this.isLoading = true;
    this.apiService.getAllAdmins().subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.admins = response.data;
          this.dataSource.data = this.admins;
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

  // Statistics methods
  getSuperAdminCount(): number {
    return this.dataSource.data.filter(admin => admin.role === 'super_admin').length;
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
      case 'super_admin':
        return 'text-black bg-white border border-gray-300';
      case 'moderator':
        return 'text-black bg-white border border-gray-300';
      case 'support':
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
    const canCreate = this.currentUserRole === 'super_admin';
    console.log('canCreateAdmin:', canCreate, 'current role:', this.currentUserRole);
    return canCreate;
  }

  canEditAdmin(admin: Admin): boolean {
    if (this.currentUserRole === 'super_admin') return true;
    if (this.currentUserRole === 'moderator' && admin.role === 'support') return true;
    console.log('canEditAdmin for', admin.username, ':', false, 'current role:', this.currentUserRole, 'admin role:', admin.role);
    return false;
  }

  canDeleteAdmin(admin: Admin): boolean {
    if (this.currentUserRole === 'super_admin' && admin.role !== 'super_admin') return true;
    console.log('canDeleteAdmin for', admin.username, ':', false, 'current role:', this.currentUserRole, 'admin role:', admin.role);
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
    console.log('editAdmin called for:', admin.username);
    console.log('isProcessing:', this.isProcessing);
    console.log('canEditAdmin:', this.canEditAdmin(admin));
    
    if (this.isProcessing) {
      console.log('Cannot edit - processing another action');
      return; // Prevent multiple clicks
    }
    
    // Check permissions
    if (!this.canEditAdmin(admin)) {
      this.showError('You do not have permission to edit this administrator');
      return;
    }

    console.log('Opening edit modal for:', admin.username);
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
        const createData = {
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
          created_by_role: this.currentUserRole // Add current user's role for permission check
        };
        
        this.apiService.createAdmin(createData).subscribe({
          next: (response) => {
            this.isSubmitting = false;
            if (response.status === 'success') {
              this.showMessage(`✅ Administrator "${formData.username}" created successfully`);
              this.closeModal();
              this.loadAdmins(); // Refresh the list
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
    this.adminForm.reset();
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
    const actionIcon = newStatus === 'active' ? '🔓' : '🔒';
    
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
          console.error(`${action} admin access error:`, error);
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

    const confirmMessage = `⚠️ Delete Administrator Confirmation\n\n` +
      `You are about to permanently delete:\n` +
      `• Username: ${admin.username}\n` +
      `• Name: ${admin.full_name}\n` +
      `• Email: ${admin.email}\n` +
      `• Role: ${this.formatRole(admin.role)}\n\n` +
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
            this.showMessage(`🗑️ Administrator "${admin.username}" deleted successfully`);
            this.loadAdmins(); // Refresh the list
          } else {
            this.showError(response.message || 'Failed to delete administrator');
          }
        },
        error: (error) => {
          this.isProcessing = false;
          this.showError('❌ Error deleting administrator. Please try again.');
          console.error('Delete admin error:', error);
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
    const actionIcon = newStatus === 'active' ? '✅' : '⏸️';
    
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
          console.error(`${action} admin error:`, error);
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
    if (confirm('This is a temporary fix. Update your role to super_admin for testing?')) {
      localStorage.setItem('role', 'super_admin');
      this.currentUserRole = 'super_admin';
      this.showMessage('✅ Role updated to super_admin. Please refresh the page.');
      console.log('Role updated to:', this.currentUserRole);
    }
  }
}
