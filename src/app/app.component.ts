import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {  RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NotificationService, Toast, ProcessingModal } from './services/notification.service';
import { Observable, Subscription } from 'rxjs';
import { SocketService } from './services/socket.service';
import { PwaPromptComponent } from './shared/pwa-prompt/pwa-prompt.component';

@Component({
  selector: 'app-root',
  // imports: [RouterOutlet],
  imports: [CommonModule, RouterOutlet, HttpClientModule, MatToolbarModule, ReactiveFormsModule,
    FormsModule, PwaPromptComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'CycleMart';
  
  notifications$: Observable<Toast[]>;
  processing$: Observable<ProcessingModal>;
  private subs: Subscription[] = [];

  constructor(private notificationService: NotificationService, private socketService: SocketService) {
    this.notifications$ = this.notificationService.toasts$;
    this.processing$ = this.notificationService.processing$;
  }

  ngOnInit(): void {
    // Establish a global socket connection so messaging is real-time across all pages
    this.socketService.connect();
    const id = localStorage.getItem('id');
    if (id) {
      const username = localStorage.getItem('username') || 'User';
      this.socketService.authenticate(id, username, 'user');
    }

    // Optional: show a lightweight toast for new incoming messages when not on messages page
    // this.subs.push(
    //   this.socketService.onNewMessage().subscribe(msg => {
        // Avoid spamming toasts for own echo or system messages
    //     const currentId = localStorage.getItem('id');
    //     if (msg.is_system_message || msg.is_echo || String(msg.sender_id) === String(currentId)) return;
    //     this.notificationService.showInfo('New Message', msg.message_text?.substring(0, 80) || 'New message received');
    //   })
    // );
  }

  removeNotification(id: string): void {
    this.notificationService.removeToast(id);
  }

  trackByNotificationId(index: number, notification: Toast): string {
    return notification.id || index.toString();
  }
}
