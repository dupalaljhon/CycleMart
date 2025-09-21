import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';

interface Notification {
  notification_id: number;
  type: string;
  title: string;
  message: string;
  reference_id?: number;
  created_at: string;
  created_by?: number;
  created_by_name?: string;
  is_read: boolean;
  read_at?: string;
}

interface DashboardStats {
  total_users: number;
  total_listings: number;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, AdminSidenavComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  dashboardStats: DashboardStats = {
    total_users: 0,
    total_listings: 0
  };
  
  recentNotifications: Notification[] = [];
  isLoading = true;
  adminId: number = 0;

  constructor(private apiService: ApiService) {
    // Get admin ID from localStorage
    const storedId = localStorage.getItem('id');
    const adminUserData = localStorage.getItem('admin_user');
    
    if (storedId) {
      this.adminId = parseInt(storedId);
    } else if (adminUserData) {
      const adminUser = JSON.parse(adminUserData);
      this.adminId = adminUser.id || 0;
    } else {
      this.adminId = 0;
    }
  }

  ngOnInit() {
    this.loadDashboardData();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  }

  loadDashboardData() {
    this.isLoading = true;
    
    // Load dashboard statistics
    this.apiService.getDashboardStats().subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.dashboardStats = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
      }
    });

    // Load recent notifications
    if (this.adminId) {
      this.apiService.getAdminNotifications(this.adminId).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.status === 'success') {
            // Load all notifications for scrollable view
            this.recentNotifications = response.data;
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error loading notifications:', error);
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'new_user': return 'U';
      case 'new_listing': return 'L';
      case 'system': return 'S';
      default: return 'N';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'new_user': return 'bg-blue-500';
      case 'new_listing': return 'bg-green-500';
      case 'system': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  }

  getTimeAgo(dateString: string): string {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

}
