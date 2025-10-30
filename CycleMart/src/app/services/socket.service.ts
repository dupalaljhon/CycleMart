import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  // Default socket server URL - you can change this to match your backend
  private readonly SERVER_URL = 'http://localhost:3000';

  constructor() {
    this.initializeSocket();
  }

  /**
   * Initialize socket connection
   */
  private initializeSocket(): void {
    try {
      this.socket = io(this.SERVER_URL, {
        autoConnect: false, // Don't auto-connect, we'll connect manually
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ['polling', 'websocket'], // Start with polling, then upgrade to websocket
        upgrade: true,
        forceNew: true
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize socket:', error);
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnectedSubject.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnectedSubject.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔥 Socket connection error:', error);
      this.isConnectedSubject.next(false);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      this.isConnectedSubject.next(true);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔥 Socket reconnection error:', error);
    });
  }

  /**
   * Connect to socket server
   */
  connect(): void {
    if (this.socket && !this.socket.connected) {
      console.log('🔄 Attempting to connect to Socket.IO server...');
      this.socket.connect();
    }
  }

  /**
   * Disconnect from socket server
   */
  disconnect(): void {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }
  }

  /**
   * Join a specific room
   */
  joinRoom(roomId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', roomId);
      console.log(`📍 Joined room: ${roomId}`);
    }
  }

  /**
   * Leave a specific room
   */
  leaveRoom(roomId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room', roomId);
      console.log(`🚪 Left room: ${roomId}`);
    }
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, data?: any): boolean {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      return true;
    } else {
      console.warn('⚠️ Socket not connected. Cannot emit event:', event);
      return false;
    }
  }

  /**
   * Listen for events from the server
   */
  on(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(event, (data: any) => {
          observer.next(data);
        });
      }

      // Cleanup function
      return () => {
        if (this.socket) {
          this.socket.off(event);
        }
      };
    });
  }

  /**
   * Listen for events once
   */
  once(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.once(event, (data: any) => {
          observer.next(data);
          observer.complete();
        });
      }

      // Cleanup function
      return () => {
        if (this.socket) {
          this.socket.off(event);
        }
      };
    });
  }

  /**
   * Remove event listener
   */
  off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Send message to specific user
   */
  sendPrivateMessage(userId: string, message: string): void {
    this.emit('private_message', {
      recipientId: userId,
      message: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send notification
   */
  sendNotification(notification: any): void {
    this.emit('notification', notification);
  }

  /**
   * Listen for real-time notifications
   */
  onNotification(): Observable<any> {
    return this.on('notification');
  }

  /**
   * Listen for private messages
   */
  onPrivateMessage(): Observable<any> {
    return this.on('private_message');
  }

  /**
   * Send admin action notification
   */
  sendAdminAction(action: any): void {
    this.emit('admin_action', action);
  }

  /**
   * Listen for admin actions
   */
  onAdminAction(): Observable<any> {
    return this.on('admin_action');
  }

  /**
   * Send product update
   */
  sendProductUpdate(productUpdate: any): void {
    this.emit('product_update', productUpdate);
  }

  /**
   * Listen for product updates
   */
  onProductUpdate(): Observable<any> {
    return this.on('product_update');
  }

  /**
   * Cleanup when service is destroyed
   */
  ngOnDestroy(): void {
    this.disconnect();
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}