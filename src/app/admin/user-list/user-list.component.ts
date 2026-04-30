import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';
import { ProfileImageService } from '../../services/profile-image.service';
import { UserDetailModalComponent } from './user-detail-modal/user-detail-modal.component';
import { DeleteUserModalComponent } from './delete-user-modal/delete-user-modal.component';
import { MarkViolationModalComponent } from './mark-violation-modal/mark-violation-modal.component';
import { UnrestrictUserModalComponent } from './unrestrict-user-modal/unrestrict-user-modal.component';

interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  address?: string;
  profile_image?: string;
  terms_accepted: boolean;
  is_verified: boolean;
  created_at: string;
  violation_count: number;
  account_status: string;
}

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule,
    AdminSidenavComponent,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css'
})
export class UserListComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  // Pagination settings
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];
  
  users: User[] = [];
  dataSource = new MatTableDataSource<User>([]);
  isLoading = true;
  searchTerm = '';
  sortQuery = 'violation_high';
  
  displayedColumns: string[] = [
    'profile_image',
    'full_name', 
    'email', 
    'phone', 
    'is_verified',
    'account_status',
    'violation_count',
    'created_at', 
    'actions'
  ];

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private profileImageService: ProfileImageService
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  ngAfterViewInit() {
    // Set up paginator and sort after view initializes
    // Will be reconnected when data loads due to *ngIf condition
    this.connectPaginatorAndSort();
    
    // Custom filter predicate for search functionality
    this.dataSource.filterPredicate = (data: User, filter: string) => {
      const searchString = filter.toLowerCase();
      return data.full_name?.toLowerCase().includes(searchString) ||
             data.email?.toLowerCase().includes(searchString) ||
             data.phone?.toLowerCase().includes(searchString) ||
             data.id.toString().includes(searchString);
    };
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

  loadUsers() {
    this.isLoading = true;
    this.apiService.getAllUsers().subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          this.users = (response.data || []).map((user: any) => ({
            ...user,
            account_status: (user.account_status || 'active').toString().trim(),
            violation_count: Number(user.violation_count ?? 0)
          }));
          this.applySortQuery();
          
          // Reconnect paginator after data loads and view updates
          setTimeout(() => this.connectPaginatorAndSort(), 0);
        }
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase();
    
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onSortQueryChange() {
    this.applySortQuery();
    this.onSearch();
  }

  private applySortQuery() {
    const sortedUsers = [...this.users];

    switch (this.sortQuery) {
      case 'name_az':
        sortedUsers.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        break;
      case 'name_za':
        sortedUsers.sort((a, b) => (b.full_name || '').localeCompare(a.full_name || ''));
        break;
      case 'violation_high':
        sortedUsers.sort((a, b) => (b.violation_count || 0) - (a.violation_count || 0));
        break;
      case 'violation_low':
        sortedUsers.sort((a, b) => (a.violation_count || 0) - (b.violation_count || 0));
        break;
      default:
        sortedUsers.sort((a, b) => (b.violation_count || 0) - (a.violation_count || 0));
        break;
    }

    this.dataSource.data = sortedUsers;
  }

  getProfileImageUrl(imagePath?: string): string {
    return this.profileImageService.getUserProfileImageUrl(imagePath, 'U');
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  viewUser(user: User) {
    const dialogRef = this.dialog.open(UserDetailModalComponent, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: user,
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.action === 'edit') {
        this.editUser(result.user);
      }
    });
  }

  editUser(user: User) {
    this.showMessage(`Edit functionality for "${user.full_name}" coming soon!`);
    // Add edit functionality here
  }

  markViolation(user: User) {
    const dialogRef = this.dialog.open(MarkViolationModalComponent, {
      width: '650px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { user: user },
      disableClose: false,
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        const data = result.data;
        this.showMessage(
          `âœ… Violation marked! User "${data.user_name}" now has ${data.violation_count} violation(s). Status: ${data.account_status.toUpperCase()}.`,
          6000
        );
        // Refresh user list to show updated violation count and status
        this.loadUsers();
      }
    });
  }

  unrestrictUser(user: User) {
    if (!this.canUnrestrictUser(user)) {
      this.showError('Only restricted or suspended users can be unrestricted.');
      return;
    }

    const dialogRef = this.dialog.open(UnrestrictUserModalComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { userName: user.full_name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.reason) {
        return;
      }

      this.apiService.markUserViolation({
        user_id: user.id,
        action: 'unrestrict',
        reason: result.reason
      }).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.showMessage(`âœ… User "${user.full_name}" unrestricted. Notification sent to the user.`);
            this.loadUsers();
          } else {
            this.showError(response.message || 'Failed to unrestrict user.');
          }
        },
        error: (error) => {
          this.showError(error.error?.message || 'Error unrestricting user.');
        }
      });
    });
  }

  canUnrestrictUser(user: User): boolean {
    const status = this.normalizeAccountStatus(user.account_status);
    return status.includes('restrict') || status.includes('suspend');
  }

  private normalizeAccountStatus(status?: string): string {
    return (status || '').toLowerCase().trim().replace(/\s+/g, '_');
  }

  deleteUser(user: User) {
    const dialogRef = this.dialog.open(DeleteUserModalComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: {
        user: user,
        onConfirm: (userToDelete: User) => this.performDeleteUser(userToDelete),
        apiService: this.apiService
      },
      disableClose: true, // Prevent closing while deleting
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.deleted) {
        // User was successfully deleted, refresh the list
        this.loadUsers();
      }
    });
  }

  private async performDeleteUser(user: User): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get current admin info
      const adminId = localStorage.getItem('admin_id') || localStorage.getItem('id');
      const adminRole = localStorage.getItem('role') || 'moderator';

      if (!adminId) {
        this.showError('Admin authentication required');
        reject(new Error('Admin authentication required'));
        return;
      }

      const deleteData = {
        user_id: user.id,
        admin_id: parseInt(adminId),
        admin_role: adminRole
      };

      this.apiService.deleteUser(deleteData).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.showMessage(`âœ… User "${user.full_name}" deleted successfully`);
            resolve();
          } else {
            this.showError(`Failed to delete user: ${response.message}`);
            reject(new Error(response.message));
          }
        },
        error: (error) => {
          this.showError('âŒ Error deleting user. Please try again.');
          reject(error);
        }
      });
    });
  }

  private showMessage(message: string, duration: number = 3000) {
    this.snackBar.open(message, 'Close', {
      duration: duration,
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

  getVerifiedUsersCount(): number {
    return this.users.filter(user => user.is_verified).length;
  }

  getUnverifiedUsersCount(): number {
    return this.users.filter(user => !user.is_verified).length;
  }

  get filteredUsers(): User[] {
    return this.dataSource.filteredData;
  }
}
