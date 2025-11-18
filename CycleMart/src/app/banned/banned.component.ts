import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccountStatusService } from '../services/account-status.service';

@Component({
  selector: 'app-banned',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-gray-900 flex items-center justify-center p-4">
      <div class="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-red-700 to-red-900 p-8 text-white">
          <div class="flex items-center justify-center mb-4">
            <mat-icon class="text-9xl">cancel</mat-icon>
          </div>
          <h1 class="text-4xl font-bold text-center mb-2">Account Permanently Banned</h1>
          <p class="text-center text-red-100 text-lg">Your access to CycleMart has been permanently revoked</p>
        </div>

        <!-- Content -->
        <div class="p-8">
          <div class="bg-red-50 border-l-4 border-red-600 p-6 rounded-lg mb-6">
            <div class="flex items-start">
              <mat-icon class="text-red-600 mr-3 mt-1">dangerous</mat-icon>
              <div>
                <h3 class="font-semibold text-red-900 text-lg mb-2">Ban Details</h3>
                <p class="text-red-800 mb-2">
                  {{ restrictionMessage }}
                </p>
                <p class="text-red-700 text-sm">
                  Total violations: <strong>{{ violationCount }}</strong>
                </p>
              </div>
            </div>
          </div>

          <!-- What this means -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">Permanent Restrictions</h3>
            <div class="space-y-3">
              <div class="flex items-start">
                <mat-icon class="text-red-600 mr-3 mt-1">block</mat-icon>
                <p class="text-gray-700">You can no longer access CycleMart</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-red-600 mr-3 mt-1">block</mat-icon>
                <p class="text-gray-700">All your listings have been removed</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-red-600 mr-3 mt-1">block</mat-icon>
                <p class="text-gray-700">Your account cannot be recovered</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-red-600 mr-3 mt-1">block</mat-icon>
                <p class="text-gray-700">This decision is final</p>
              </div>
            </div>
          </div>

          <!-- Reason -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">Why This Happened</h3>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p class="text-gray-700 mb-3">
                Your account was banned due to repeated violations of CycleMart's Terms of Service and Community Guidelines.
              </p>
              <p class="text-gray-600 text-sm">
                Multiple warnings and restrictions were issued before this permanent ban was applied.
              </p>
            </div>
          </div>

          <!-- Contact info -->
          <div class="mb-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-start">
                <mat-icon class="text-blue-600 mr-3 mt-1">info</mat-icon>
                <div>
                  <p class="text-blue-900 text-sm mb-2">
                    If you believe this ban was issued in error, you may contact our appeals team.
                  </p>
                  <p class="text-blue-800 text-xs">
                    Note: Appeals are rarely successful and may take 7-14 business days to review.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-4">
            <button mat-raised-button color="warn" class="flex-1" (click)="logout()">
              <mat-icon>logout</mat-icon>
              Close Account
            </button>
            <button mat-stroked-button color="primary" class="flex-1" (click)="contactAppeals()">
              <mat-icon>email</mat-icon>
              Contact Appeals
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <p class="text-center text-gray-600 text-sm">
            Appeals: <a href="mailto:appeals@cyclemart.com" class="text-blue-600 hover:underline">appeals&#64;cyclemart.com</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class BannedComponent implements OnInit {
  restrictionMessage = '';
  violationCount = 0;

  constructor(
    private accountStatusService: AccountStatusService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const status = this.accountStatusService.getCurrentStatus();
    this.restrictionMessage = this.accountStatusService.getRestrictionMessage();
    this.violationCount = status.violation_count;

    // Force logout for banned users
    if (this.accountStatusService.isBanned()) {
      // Clear everything except ban info
      const account_status = localStorage.getItem('account_status');
      const violation_count = localStorage.getItem('violation_count');
      localStorage.clear();
      localStorage.setItem('account_status', account_status || 'banned');
      localStorage.setItem('violation_count', violation_count || '4');
    }
  }

  logout(): void {
    this.accountStatusService.logout();
    this.router.navigate(['/login']);
  }

  contactAppeals(): void {
    window.location.href = 'mailto:appeals@cyclemart.com?subject=Account Ban Appeal - User ID: ' + (localStorage.getItem('id') || 'Unknown');
  }
}
