import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidenavComponent } from '../sidenav/sidenav.component';


@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule,  SidenavComponent],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css']
})


export class NotificationComponent {
  notifications = [
    { user: 'John Doe', message: 'New item was posted on the marketplace.' },
    { user: 'John Doe', message: 'New item was posted on the marketplace.' },
    { user: 'John Doe', message: 'New item was posted on the marketplace.' },
    { user: 'John Doe', message: 'New item was posted on the marketplace.' },
    { user: 'John Doe', message: 'New item was posted on the marketplace.' },
    { user: 'John Doe', message: 'New item was posted on the marketplace.' }
  ];

  removeNotification(index: number) {
    this.notifications.splice(index, 1);
  }
}
