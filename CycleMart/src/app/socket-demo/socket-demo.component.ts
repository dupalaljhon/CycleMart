import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../services/socket.service';
import { Subscription } from 'rxjs';

interface SocketNotification {
  type: string;
  message: string;
  data?: any;
  timestamp: string;
}

interface PrivateMessage {
  senderId: string;
  message: string;
  timestamp: string;
}

@Component({
  selector: 'app-socket-demo',
  imports: [CommonModule],
  template: `
    <div class="socket-demo-container p-6 max-w-4xl mx-auto">
      <h2 class="text-3xl font-bold mb-6 text-gray-800">Socket.IO Real-time Demo</h2>
      
      <!-- Connection Status -->
      <div class="mb-6 p-4 rounded-lg" [class]="isConnected ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'">
        <div class="flex items-center">
          <div class="w-3 h-3 rounded-full mr-3" [class]="isConnected ? 'bg-green-500' : 'bg-red-500'"></div>
          <span class="font-semibold" [class]="isConnected ? 'text-green-800' : 'text-red-800'">
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </span>
          <span class="ml-2 text-gray-600" *ngIf="socketId">
            (ID: {{ socketId }})
          </span>
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="mb-6 flex flex-wrap gap-3">
        <button 
          (click)="connect()" 
          [disabled]="isConnected"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
          Connect
        </button>
        <button 
          (click)="disconnect()" 
          [disabled]="!isConnected"
          class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
          Disconnect
        </button>
        <button 
          (click)="authenticate()" 
          [disabled]="!isConnected"
          class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
          Authenticate
        </button>
        <button 
          (click)="sendTestNotification()" 
          [disabled]="!isConnected"
          class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
          Send Test Notification
        </button>
        <button 
          (click)="sendAdminAction()" 
          [disabled]="!isConnected"
          class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
          Send Admin Action
        </button>
      </div>

      <!-- Real-time Notifications -->
      <div class="mb-6">
        <h3 class="text-xl font-semibold mb-3 text-gray-700">Real-time Notifications</h3>
        <div class="bg-gray-50 border rounded-lg p-4 h-40 overflow-y-auto">
          <div *ngIf="notifications.length === 0" class="text-gray-500 italic">
            No notifications yet...
          </div>
          <div *ngFor="let notification of notifications; trackBy: trackByIndex" 
               class="mb-2 p-2 bg-white rounded border-l-4 border-blue-400">
            <div class="flex justify-between items-start">
              <div>
                <span class="font-semibold text-blue-600">{{ notification.type }}</span>
                <p class="text-gray-800">{{ notification.message }}</p>
                <pre *ngIf="notification.data" class="text-xs text-gray-600 mt-1">{{ notification.data | json }}</pre>
              </div>
              <span class="text-xs text-gray-500">{{ formatTime(notification.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Private Messages -->
      <div class="mb-6">
        <h3 class="text-xl font-semibold mb-3 text-gray-700">Private Messages</h3>
        <div class="bg-gray-50 border rounded-lg p-4 h-40 overflow-y-auto">
          <div *ngIf="messages.length === 0" class="text-gray-500 italic">
            No messages yet...
          </div>
          <div *ngFor="let message of messages; trackBy: trackByIndex" 
               class="mb-2 p-2 bg-white rounded border-l-4 border-green-400">
            <div class="flex justify-between items-start">
              <div>
                <span class="font-semibold text-green-600">From: {{ message.senderId }}</span>
                <p class="text-gray-800">{{ message.message }}</p>
              </div>
              <span class="text-xs text-gray-500">{{ formatTime(message.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Admin Actions Log -->
      <div class="mb-6">
        <h3 class="text-xl font-semibold mb-3 text-gray-700">Admin Actions</h3>
        <div class="bg-gray-50 border rounded-lg p-4 h-40 overflow-y-auto">
          <div *ngIf="adminActions.length === 0" class="text-gray-500 italic">
            No admin actions yet...
          </div>
          <div *ngFor="let action of adminActions; trackBy: trackByIndex" 
               class="mb-2 p-2 bg-white rounded border-l-4 border-orange-400">
            <div class="flex justify-between items-start">
              <div>
                <span class="font-semibold text-orange-600">{{ action.type }}</span>
                <p class="text-gray-800">Admin: {{ action.adminId }}, Target: {{ action.targetUserId }}</p>
                <pre *ngIf="action.data" class="text-xs text-gray-600 mt-1">{{ action.data | json }}</pre>
              </div>
              <span class="text-xs text-gray-500">{{ formatTime(action.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 class="font-semibold text-blue-800 mb-2">Instructions:</h4>
        <ol class="list-decimal list-inside text-blue-700 space-y-1">
          <li>First, make sure the Socket.IO server is running: <code class="bg-blue-100 px-1 rounded">npm run dev</code> in the socket-server folder</li>
          <li>Click "Connect" to establish socket connection</li>
          <li>Click "Authenticate" to join rooms and identify yourself</li>
          <li>Test real-time features with the action buttons</li>
          <li>Open multiple browser tabs to see real-time communication</li>
        </ol>
      </div>
    </div>
  `,
  styles: [`
    .socket-demo-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    code {
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }
    
    pre {
      white-space: pre-wrap;
      word-break: break-word;
    }
  `]
})
export class SocketDemoComponent implements OnInit, OnDestroy {
  isConnected = false;
  socketId: string | undefined;
  notifications: SocketNotification[] = [];
  messages: PrivateMessage[] = [];
  adminActions: any[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    // Subscribe to connection status
    this.subscriptions.push(
      this.socketService.isConnected$.subscribe(connected => {
        this.isConnected = connected;
        this.socketId = this.socketService.getSocketId();
      })
    );

    // Listen for notifications
    this.subscriptions.push(
      this.socketService.onNotification().subscribe(notification => {
        this.notifications.unshift(notification);
        if (this.notifications.length > 10) {
          this.notifications = this.notifications.slice(0, 10);
        }
      })
    );

    // Listen for private messages
    this.subscriptions.push(
      this.socketService.onPrivateMessage().subscribe(message => {
        this.messages.unshift(message);
        if (this.messages.length > 10) {
          this.messages = this.messages.slice(0, 10);
        }
      })
    );

    // Listen for admin actions
    this.subscriptions.push(
      this.socketService.onAdminAction().subscribe(action => {
        this.adminActions.unshift(action);
        if (this.adminActions.length > 10) {
          this.adminActions = this.adminActions.slice(0, 10);
        }
      })
    );
  }

  ngOnDestroy() {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  connect() {
    this.socketService.connect();
  }

  disconnect() {
    this.socketService.disconnect();
  }

  authenticate() {
    // Get user data from localStorage or use demo data
    const userId = localStorage.getItem('id') || localStorage.getItem('admin_id') || 'demo_user';
    const username = localStorage.getItem('username') || 'demo_user';
    const role = localStorage.getItem('role') || 'user';

    this.socketService.emit('authenticate', {
      userId,
      username,
      role
    });

    console.log('Authenticated with:', { userId, username, role });
  }

  sendTestNotification() {
    this.socketService.sendNotification({
      type: 'test',
      message: 'This is a test notification from the demo!',
      data: {
        demoProperty: 'Demo value',
        timestamp: new Date().toISOString()
      }
    });
  }

  sendAdminAction() {
    const adminId = localStorage.getItem('admin_id') || 'demo_admin';
    
    this.socketService.sendAdminAction({
      type: 'demo_action',
      targetUserId: 'demo_target_user',
      adminId,
      data: {
        reason: 'Demo admin action',
        details: 'This is a demonstration of admin actions'
      }
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }
}