import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ModeratorApplicationDetailsDialogComponent } from './moderator-application-details-dialog.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';
import { AdminSidenavComponent } from "../../admin/admin-sidenav/admin-sidenav.component";
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-moderator-applications',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    AdminSidenavComponent
],
  providers: [],
  templateUrl: './moderator-applications.component.html',
  styleUrls: ['./moderator-applications.component.css']
})
export class ModeratorApplicationsComponent implements OnInit {
  applications: any[] = [];
  filteredApplications: any[] = [];
  isLoading = false;
  selectedFilter: string = 'pending';
  searchQuery: string = '';
  adminId: number | null = null;

  displayedColumns: string[] = ['applicant', 'reason', 'status', 'date', 'actions'];

  private apiService = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  ngOnInit(): void {
    // Get admin ID directly from localStorage (it's stored as 'admin_id', not in an admin object)
    const adminId = localStorage.getItem('admin_id');
    this.adminId = adminId ? parseInt(adminId) : null;

    this.loadApplications();
  }

  loadApplications(status?: string): void {
    this.isLoading = true;
    
    this.apiService.getAllModeratorApplications(status).subscribe({
      next: (response: any) => {
        this.applications = response.data || [];
        this.applyClientFilter();
        this.isLoading = false;
      },
      error: (error: any) => {
        this.snackBar.open('Failed to load applications', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.isLoading = false;
      }
    });
  }

  onTabChange(event: any): void {
    const filters = ['pending', 'approved', 'rejected', 'all'];
    this.selectedFilter = filters[event.index];
    
    if (this.selectedFilter === 'all') {
      this.loadApplications();
    } else {
      this.loadApplications(this.selectedFilter);
    }
  }

  applyClientFilter(): void {
    const query = this.searchQuery.trim().toLowerCase();

    if (!query) {
      this.filteredApplications = [...this.applications];
      return;
    }

    this.filteredApplications = this.applications.filter((app) => {
      const fullName = (app.full_name || '').toLowerCase();
      const email = (app.email || '').toLowerCase();
      const reason = (app.reason || '').toLowerCase();
      const status = (app.status || '').toLowerCase();

      return (
        fullName.includes(query) ||
        email.includes(query) ||
        reason.includes(query) ||
        status.includes(query)
      );
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyClientFilter();
  }

  approveApplication(application: any): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Approve Moderator',
        message: `Are you sure you want to approve ${application.full_name} as a moderator?`,
        confirmText: 'Approve',
        cancelText: 'Cancel',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.reviewApplication(application.application_id, 'approve', application.full_name);
      }
    });
  }

  rejectApplication(application: any): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Reject Moderator',
        message: `Are you sure you want to reject ${application.full_name}'s application?`,
        confirmText: 'Reject',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.reviewApplication(application.application_id, 'reject', application.full_name);
      }
    });
  }

  private reviewApplication(applicationId: number, action: string, fullName: string): void {
    if (!this.adminId) {
      this.snackBar.open('Admin ID not found', 'Close', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    const data = {
      application_id: applicationId,
      action: action,
      reviewed_by: this.adminId
    };

    this.apiService.reviewModeratorApplication(data).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.snackBar.open(
            action === 'approve' 
              ? `${fullName} approved as moderator successfully!` 
              : `${fullName}'s application has been rejected`,
            'Close',
            { duration: 4000, panelClass: ['success-snackbar'] }
          );
          
          // Reload applications
          if (this.selectedFilter === 'all') {
            this.loadApplications();
          } else {
            this.loadApplications(this.selectedFilter);
          }
        } else {
          this.snackBar.open(response.message || 'Failed to review application', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        const errorMessage = error.error?.message || 'An error occurred while reviewing the application';
        this.snackBar.open(errorMessage, 'Close', {
          duration: 4000,
          panelClass: ['error-snackbar']
        });
        this.isLoading = false;
      }
    });
  }

  viewDetails(application: any): void {
    // Resolve profile image URL and open Material dialog with full application details
    const profileImageUrl = this.getProfileImageUrl(application.profile_image || application.profile_picture, application.full_name);
    const dialogRef = this.dialog.open(ModeratorApplicationDetailsDialogComponent, {
      width: '680px',
      data: { ...application, profileImageUrl },
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result || !result.action) return;

      if (result.action === 'approve') {
        // Use existing action which includes confirmation
        this.approveApplication(application);
      } else if (result.action === 'reject') {
        this.rejectApplication(application);
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warn';
      case 'approved': return 'accent';
      case 'rejected': return '';
      default: return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'schedule';
      case 'approved': return 'check_circle';
      case 'rejected': return 'cancel';
      default: return 'help';
    }
  }

  getPendingCount(): number {
    return this.applications.filter(app => app.status === 'pending').length;
  }

  getApprovedCount(): number {
    return this.applications.filter(app => app.status === 'approved').length;
  }

  getRejectedCount(): number {
    return this.applications.filter(app => app.status === 'rejected').length;
  }

  truncateText(text: string, maxLength: number = 100): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  getProfileImageUrl(imagePath: string | null | undefined, name: string | null | undefined): string {
    const safeName = name || 'User';
    if (!imagePath || !imagePath.trim()) {
      return this.generateAvatarUrl(safeName);
    }

    if (imagePath.startsWith('data:')) {
      return imagePath;
    }

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    const cleanPath = imagePath
      .replace(/^\/?api\/uploads[\/\\]/, '')
      .replace(/^\/?uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  // Navigation: open admin monitoring list
  openAdminMonitoring(application: any): void {
    // Navigate to admin monitoring page
    this.router.navigate(['/admin-monitoring']);
  }

  // Try to navigate or surface admin account details
  viewAdminAccount(application: any): void {
    // If admin id exists in application, navigate and include query param for easier lookup
    if (application.admin_id) {
      this.router.navigate(['/admin-monitoring'], { queryParams: { highlight: application.admin_id } });
      return;
    }

    // Fallback: notify admin to use Admin Monitor to find the account
    this.snackBar.open('Admin account not directly available. Open Admin Monitor to find the account.', 'Close', { duration: 3500 });
  }

  // Revoke moderator by deleting admin account (attempt to resolve admin id by email if missing)
  revokeModerator(application: any): void {
    if (!confirm(`Revoke moderator privileges for ${application.full_name}? This will remove their admin account.`)) return;

    this.isLoading = true;

    const performDelete = (adminId: number) => {
      const payload = {
        admin_id: adminId,
        deleted_by_role: localStorage.getItem('role') || 'admin',
        deleted_by_id: parseInt(localStorage.getItem('admin_id') || '0')
      };

      this.apiService.deleteAdmin(payload).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          if (res.status === 'success') {
            this.snackBar.open('Moderator revoked and admin account removed.', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
            this.loadApplications(this.selectedFilter === 'all' ? undefined : this.selectedFilter);
          } else {
            this.snackBar.open(res.message || 'Failed to revoke moderator', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
          }
        },
        error: (err: any) => {
          this.isLoading = false;
          this.snackBar.open('Error revoking moderator. Please try again.', 'Close', { duration: 3500, panelClass: ['error-snackbar'] });
        }
      });
    };

    // If admin_id present, use it
    if (application.admin_id) {
      performDelete(application.admin_id);
      return;
    }

    // Otherwise, attempt to locate admin by email
    this.apiService.getAllAdmins().subscribe({
      next: (resp: any) => {
        const admins = resp.data || [];
        const match = admins.find((a: any) => (a.email || '').toLowerCase() === (application.email || '').toLowerCase());
        if (match && match.admin_id) {
          performDelete(match.admin_id);
        } else {
          this.isLoading = false;
          this.snackBar.open('Could not find associated admin account. Please remove manually in Admin Monitor.', 'Close', { duration: 4000, panelClass: ['error-snackbar'] });
        }
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to fetch admin list. Try again later.', 'Close', { duration: 3500, panelClass: ['error-snackbar'] });
      }
    });
  }

  private generateAvatarUrl(name: string): string {
    const colors = ['6BA3BE', '34D399', 'F59E0B', '8B5CF6', 'EF4444', '10B981'];
    const color = colors[name.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff`;
  }
}
