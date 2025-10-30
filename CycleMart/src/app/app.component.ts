import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {  RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NotificationService, Toast, ProcessingModal } from './services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  // imports: [RouterOutlet],
  imports: [CommonModule, RouterOutlet, HttpClientModule, MatToolbarModule, ReactiveFormsModule,
    FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'CycleMart';
  
  notifications$: Observable<Toast[]>;
  processing$: Observable<ProcessingModal>;

  constructor(private notificationService: NotificationService) {
    this.notifications$ = this.notificationService.toasts$;
    this.processing$ = this.notificationService.processing$;
  }

  removeNotification(id: string): void {
    this.notificationService.removeToast(id);
  }

  trackByNotificationId(index: number, notification: Toast): string {
    return notification.id || index.toString();
  }
}
