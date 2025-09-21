import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidenavComponent } from '../sidenav/sidenav.component';

interface UserNotification {
  id: number;
  title: string;
  message: string;
  user: string;
  time: string;
  isRead: boolean;
}

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, SidenavComponent],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css']
})
export class NotificationComponent implements OnInit {
  notifications: UserNotification[] = [];
  isLoading = false;

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.isLoading = true;
    
    // Simple sample data
    setTimeout(() => {
      this.notifications = [
        {
          id: 1,
          title: 'New Message',
          message: 'sent you a message about your bike listing',
          user: 'Sarah Johnson',
          time: '2 min ago',
          isRead: false
        },
        {
          id: 2,
          title: 'Listing Interest',
          message: 'is interested in your Road Bike',
          user: 'Mike Chen',
          time: '15 min ago',
          isRead: false
        },
        {
          id: 3,
          title: 'Trade Proposal',
          message: 'wants to trade their BMX for your Mountain Bike',
          user: 'Alex Rodriguez',
          time: '1 hour ago',
          isRead: true
        },
        {
          id: 4,
          title: 'Listing Approved',
          message: 'Your listing has been approved',
          user: 'CycleMart Team',
          time: '2 hours ago',
          isRead: true
        }
      ];
      
      this.isLoading = false;
    }, 500);
  }

  removeNotification(index: number) {
    this.notifications.splice(index, 1);
  }

  markAsRead(index: number) {
    this.notifications[index].isRead = true;
  }

  markAllAsRead() {
    this.notifications.forEach(notif => notif.isRead = true);
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }
}
