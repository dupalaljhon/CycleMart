import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccountStatusService } from '../services/account-status.service';

@Component({
  selector: 'app-suspended',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center p-4">
      <div class="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="bg-gray-500 p-8 text-white">
          <div class="flex items-center justify-center mb-4">
            <mat-icon class="text-8xl">block</mat-icon>
          </div>
          <h1 class="text-4xl font-bold text-center mb-2">Account Suspended</h1>
          <p class="text-center text-orange-100 text-lg">Your access to CycleMart has been temporarily suspended</p>
        </div>

        <!-- Content -->
        <div class="p-8">
          <div class="bg-gray-200 p-6 rounded-lg mb-6">
            <div class="flex items-start">
              <mat-icon class="text-black mr-3 mt-1">warning</mat-icon>
              <div>
                <h3 class="font-semibold text-black text-lg mb-2">Suspension Details</h3>
                <p class="text-black mb-2">
                  {{ restrictionMessage }}
                </p>
                <p class="text-black text-sm">
                  You have received <strong>{{ violationCount }}</strong> violation(s).
                </p>
              </div>
            </div>
          </div>

          <!-- What this means -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">What This Means</h3>
            <div class="space-y-3">
              <div class="flex items-start">
                <mat-icon class="text-red-500 mr-3 mt-1">close</mat-icon>
                <p class="text-gray-700">You cannot access any CycleMart features</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-red-500 mr-3 mt-1">close</mat-icon>
                <p class="text-gray-700">You cannot list products or send messages</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-red-500 mr-3 mt-1">close</mat-icon>
                <p class="text-gray-700">This is your final warning before permanent ban</p>
              </div>
            </div>
          </div>

          <!-- Next steps -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">What You Can Do</h3>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div class="flex items-start">
                <mat-icon class="text-blue-600 mr-3 mt-1 text-sm">info</mat-icon>
                <p class="text-blue-900 text-sm">Contact our email to appeal this suspension</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-blue-600 mr-3 mt-1 text-sm">info</mat-icon>
                <p class="text-blue-900 text-sm">Review our Terms of Service and Community Guidelines</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-blue-600 mr-3 mt-1 text-sm">info</mat-icon>
                <p class="text-blue-900 text-sm">Wait for admin review of your case</p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-4">
            <button mat-raised-button color="warn" class="flex-1" (click)="logout()">
              <mat-icon>logout</mat-icon>
              Logout
            </button>
            <!-- <button mat-raised-button color="primary" class="flex-1" (click)="contactSupport()">
              <mat-icon>support_agent</mat-icon>
              Contact Support
            </button> -->
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <p class="text-center text-gray-600 text-sm">
            Need help? Email us at <a href="mailto:support@cyclemart.com" class="text-blue-600 hover:underline">cyclemrt&#64;gmail.com</a>
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
export class SuspendedComponent implements OnInit {
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

    // If not actually suspended, redirect to home
    if (!this.accountStatusService.isSuspended()) {
      this.router.navigate(['/home']);
    }
  }

  logout(): void {
    this.accountStatusService.logout();
    this.router.navigate(['/login']);
  }

//   contactSupport(): void {
//     window.location.href = 'mailto:support@cyclemart.com?subject=Account Suspension Appeal';
//   }
}
