import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ApiService } from '../api/api.service';

interface UserNotification {
  notification_id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  reference_id: number | null;
  is_read: number;
  read_at: string | null;
  created_at: string;
  product_name?: string;
  archive_reason?: string;
}

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, FormsModule, SidenavComponent],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css']
})
export class NotificationComponent implements OnInit {
  notifications: UserNotification[] = [];
  filteredNotifications: UserNotification[] = [];
  paginatedNotifications: UserNotification[] = [];
  isLoading = false;
  showDetailModal = false;
  selectedNotification: UserNotification | null = null;
  
  // Pagination settings
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];
  totalPages = 1;
  Math = Math; // Expose Math to template

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.isLoading = true;
    const userId = localStorage.getItem('id');
    
    if (!userId) {
      this.isLoading = false;
      return;
    }

    console.log('📥 Loading notifications for user:', userId);

    this.apiService.getUserNotifications(parseInt(userId)).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.notifications = response.data || [];
          this.filteredNotifications = [...this.notifications];
          this.updatePagination();
          console.log('📥 Loaded', this.notifications.length, 'notifications, unread:', this.getUnreadCount());
          // Emit event to update badge in sidenav
          window.dispatchEvent(new CustomEvent('notificationsUpdated'));
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
        this.isLoading = false;
      }
    });
  }

  viewNotificationDetails(notification: UserNotification) {
    this.selectedNotification = notification;
    this.showDetailModal = true;
    
    // Mark as read when viewing details
    if (notification.is_read === 0) {
      this.markAsRead(notification);
    }
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedNotification = null;
  }

  markAsRead(notification: UserNotification) {
    if (notification.is_read === 1) return;

    this.apiService.markUserNotificationAsRead(notification.notification_id).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          notification.is_read = 1;
          notification.read_at = new Date().toISOString();
          console.log('✅ Notification marked as read, dispatching update event');
          // Trigger badge update in sidenav
          window.dispatchEvent(new CustomEvent('notificationsUpdated'));
        }
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllAsRead() {
    const userId = localStorage.getItem('id');
    if (!userId) return;

    this.apiService.markAllUserNotificationsAsRead(parseInt(userId)).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.notifications.forEach(notif => {
            notif.is_read = 1;
            notif.read_at = new Date().toISOString();
          });
          console.log('✅ All notifications marked as read, dispatching update event');
          // Trigger badge update in sidenav
          window.dispatchEvent(new CustomEvent('notificationsUpdated'));
        }
      },
      error: (error) => {
        console.error('Error marking all as read:', error);
      }
    });
  }

  deleteNotification(notification: UserNotification, event: Event) {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    this.apiService.deleteUserNotification(notification.notification_id).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.notifications = this.notifications.filter(
            n => n.notification_id !== notification.notification_id
          );
        }
      },
      error: (error) => {
        console.error('Error deleting notification:', error);
      }
    });
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => n.is_read === 0).length;
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hour' + (Math.floor(seconds / 3600) > 1 ? 's' : '') + ' ago';
    if (seconds < 2592000) return Math.floor(seconds / 86400) + ' day' + (Math.floor(seconds / 86400) > 1 ? 's' : '') + ' ago';
    return Math.floor(seconds / 2592000) + ' month' + (Math.floor(seconds / 2592000) > 1 ? 's' : '') + ' ago';
  }

  getNotificationIcon(type: string): string {
    switch(type) {
      case 'Product Archived': return '🚫';
      case 'Product Restored': return '✅';
      case 'Message Received': return '💬';
      case 'Product Approved': return '✅';
      case 'Trade Proposal': return '🔄';
      case 'Violation': return '⚠️';
      default: return '🔔';
    }
  }

  // Refresh notifications and badge count
  refreshNotifications() {
    this.loadNotifications();
  }

  // Pagination methods
  updatePagination() {
    this.totalPages = Math.ceil(this.filteredNotifications.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    this.updatePaginatedNotifications();
  }

  updatePaginatedNotifications() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedNotifications = this.filteredNotifications.slice(startIndex, endIndex);
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedNotifications();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedNotifications();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedNotifications();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }
}
