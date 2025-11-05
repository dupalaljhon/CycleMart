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
import { FormsModule } from '@angular/forms';

import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';
import { ProfileImageService } from '../../services/profile-image.service';
import { UserDetailModalComponent } from './user-detail-modal/user-detail-modal.component';
import { DeleteUserModalComponent } from './delete-user-modal/delete-user-modal.component';

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
    FormsModule
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css'
})
export class UserListComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  users: User[] = [];
  dataSource = new MatTableDataSource<User>([]);
  isLoading = true;
  searchTerm = '';
  
  displayedColumns: string[] = [
    'profile_image',
    'full_name', 
    'email', 
    'phone', 
    'is_verified', 
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
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Custom filter predicate for search functionality
    this.dataSource.filterPredicate = (data: User, filter: string) => {
      const searchString = filter.toLowerCase();
      return data.full_name?.toLowerCase().includes(searchString) ||
             data.email?.toLowerCase().includes(searchString) ||
             data.phone?.toLowerCase().includes(searchString) ||
             data.id.toString().includes(searchString);
    };
  }

  loadUsers() {
    this.isLoading = true;
    this.apiService.getAllUsers().subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          this.users = response.data;
          this.dataSource.data = this.users;
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading users:', error);
      }
    });
  }

  onSearch() {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase();
    
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
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
    console.log('Edit user:', user);
    this.showMessage(`Edit functionality for "${user.full_name}" coming soon!`);
    // Add edit functionality here
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
            this.showMessage(`✅ User "${user.full_name}" deleted successfully`);
            resolve();
          } else {
            this.showError(`Failed to delete user: ${response.message}`);
            reject(new Error(response.message));
          }
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          this.showError('❌ Error deleting user. Please try again.');
          reject(error);
        }
      });
    });
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
