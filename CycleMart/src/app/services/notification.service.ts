import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  showCloseButton?: boolean;
}

export interface ProcessingModal {
  isVisible: boolean;
  title?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  private processingSubject = new BehaviorSubject<ProcessingModal>({ isVisible: false });
  public processing$ = this.processingSubject.asObservable();

  constructor() {}

  /**
   * Show a success toast notification
   */
  showSuccess(title: string, message?: string, duration: number = 4000): void {
    this.addToast({
      type: 'success',
      title,
      message,
      duration,
      showCloseButton: true
    });
  }

  /**
   * Show an error toast notification
   */
  showError(title: string, message?: string, persistent: boolean = false): void {
    this.addToast({
      type: 'error',
      title,
      message,
      duration: persistent ? 0 : 6000,
      persistent,
      showCloseButton: true
    });
  }

  /**
   * Show a warning toast notification
   */
  showWarning(title: string, message?: string, duration: number = 5000): void {
    this.addToast({
      type: 'warning',
      title,
      message,
      duration,
      showCloseButton: true
    });
  }

  /**
   * Show an info toast notification
   */
  showInfo(title: string, message?: string, duration: number = 4000): void {
    this.addToast({
      type: 'info',
      title,
      message,
      duration,
      showCloseButton: true
    });
  }

  /**
   * Show processing modal
   */
  showProcessing(title: string, message?: string): void {
    this.processingSubject.next({
      isVisible: true,
      title,
      message
    });
  }

  /**
   * Hide processing modal
   */
  hideProcessing(): void {
    this.processingSubject.next({ isVisible: false });
  }

  /**
   * Add a toast to the queue
   */
  private addToast(toast: Toast): void {
    const id = this.generateId();
    const newToast: Toast = { ...toast, id };
    
    const currentToasts = this.toastsSubject.value;
    
    // Limit to maximum 3 notifications at once
    const updatedToasts = [...currentToasts, newToast].slice(-3);
    this.toastsSubject.next(updatedToasts);

    // Auto-remove after duration (if not persistent)
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, toast.duration);
    }
  }

  /**
   * Remove a toast by ID
   */
  removeToast(id: string): void {
    const currentToasts = this.toastsSubject.value;
    const filteredToasts = currentToasts.filter(toast => toast.id !== id);
    this.toastsSubject.next(filteredToasts);
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    this.toastsSubject.next([]);
  }

  /**
   * Generate a unique ID for toasts
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}