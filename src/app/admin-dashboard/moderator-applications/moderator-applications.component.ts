import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
    if (!confirm(`Are you sure you want to approve ${application.full_name} as a moderator?`)) {
      return;
    }

    this.reviewApplication(application.application_id, 'approve', application.full_name);
  }

  rejectApplication(application: any): void {
    if (!confirm(`Are you sure you want to reject ${application.full_name}'s application?`)) {
      return;
    }

    this.reviewApplication(application.application_id, 'reject', application.full_name);
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
    // Open dialog with full application details
    alert(`
Applicant: ${application.full_name}
Email: ${application.email}
Reason: ${application.reason}
Experience: ${application.experience || 'Not provided'}
Status: ${application.status}
Submitted: ${new Date(application.created_at).toLocaleString()}
    `);
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

  private generateAvatarUrl(name: string): string {
    const colors = ['6BA3BE', '34D399', 'F59E0B', '8B5CF6', 'EF4444', '10B981'];
    const color = colors[name.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff`;
  }
}
