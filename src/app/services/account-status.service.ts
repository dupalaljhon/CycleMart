import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

export interface AccountStatus {
  account_status: 'active' | 'restricted' | 'suspended' | 'banned';
  violation_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class AccountStatusService {
  private accountStatusSubject = new BehaviorSubject<AccountStatus>({
    account_status: 'active',
    violation_count: 0
  });
  
  public accountStatus$ = this.accountStatusSubject.asObservable();

  constructor(private router: Router) {
    this.loadAccountStatus();
  }

  /**
   * Load account status from localStorage
   */
  private loadAccountStatus(): void {
    const status = localStorage.getItem('account_status') as AccountStatus['account_status'];
    const violations = parseInt(localStorage.getItem('violation_count') || '0');
    
    if (status) {
      this.accountStatusSubject.next({
        account_status: status,
        violation_count: violations
      });
    }
  }

  /**
   * Update account status
   */
  updateAccountStatus(status: AccountStatus): void {
    localStorage.setItem('account_status', status.account_status);
    localStorage.setItem('violation_count', status.violation_count.toString());
    this.accountStatusSubject.next(status);

    // Handle banned/suspended status
    if (status.account_status === 'banned') {
      this.handleBanned();
    } else if (status.account_status === 'suspended') {
      this.handleSuspended();
    }
  }

  /**
   * Get current account status
   */
  getCurrentStatus(): AccountStatus {
    return this.accountStatusSubject.value;
  }

  /**
   * Check if user is active
   */
  isActive(): boolean {
    return this.accountStatusSubject.value.account_status === 'active';
  }

  /**
   * Check if user is restricted
   */
  isRestricted(): boolean {
    return this.accountStatusSubject.value.account_status === 'restricted';
  }

  /**
   * Check if user is suspended
   */
  isSuspended(): boolean {
    return this.accountStatusSubject.value.account_status === 'suspended';
  }

  /**
   * Check if user is banned
   */
  isBanned(): boolean {
    return this.accountStatusSubject.value.account_status === 'banned';
  }

  /**
   * Check if action is allowed
   */
  canPerformAction(action: 'list_product' | 'send_message' | 'submit_report'): boolean {
    const status = this.accountStatusSubject.value.account_status;
    
    if (status === 'banned' || status === 'suspended') {
      return false;
    }
    
    if (status === 'restricted') {
      return false; // Restricted users cannot perform these actions
    }
    
    return true;
  }

  /**
   * Get restriction message
   */
  getRestrictionMessage(): string {
    const status = this.accountStatusSubject.value;
    
    switch (status.account_status) {
      case 'restricted':
        return `Your account is restricted due to ${status.violation_count} violation(s). Some features are disabled.`;
      case 'suspended':
        return `Your account is suspended due to ${status.violation_count} violation(s). Please contact support.`;
      case 'banned':
        return `Your account has been permanently banned due to multiple violations.`;
      default:
        return '';
    }
  }

  /**
   * Handle banned account
   */
  private handleBanned(): void {
    this.logout();
    this.router.navigate(['/banned']);
  }

  /**
   * Handle suspended account
   */
  private handleSuspended(): void {
    this.router.navigate(['/suspended']);
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.clear();
    this.accountStatusSubject.next({
      account_status: 'active',
      violation_count: 0
    });
  }

  /**
   * Clear account status
   */
  clearAccountStatus(): void {
    localStorage.removeItem('account_status');
    localStorage.removeItem('violation_count');
    this.accountStatusSubject.next({
      account_status: 'active',
      violation_count: 0
    });
  }
}
