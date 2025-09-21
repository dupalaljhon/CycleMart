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
import { FormsModule } from '@angular/forms';

import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';

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

  constructor(private apiService: ApiService) {}

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
    if (!imagePath) {
      return 'https://via.placeholder.com/40x40/6366f1/white?text=U';
    }
    return `${this.apiService.baseUrl}${imagePath}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  viewUser(user: User) {
    console.log('View user:', user);
    // Add navigation to user details page
  }

  editUser(user: User) {
    console.log('Edit user:', user);
    // Add edit functionality
  }

  deleteUser(user: User) {
    if (confirm(`Are you sure you want to delete user "${user.full_name}"?`)) {
      console.log('Delete user:', user);
      // Add delete functionality
    }
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
