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
    <div class="suspended-shell min-h-screen flex items-center justify-center p-4 md:p-8">
      <div class="max-w-2xl w-full suspended-card overflow-hidden">
        <!-- Header -->
        <div class="suspended-header p-8 text-white">
          <div class="flex items-center justify-center mb-4">
            <div class="header-icon-wrap">
              <mat-icon class="text-6xl">gpp_bad</mat-icon>
            </div>
          </div>
          <h1 class="text-4xl font-bold text-center mb-2">Account Suspended</h1>
          <p class="text-center header-subtitle text-lg">Your access to CycleMart has been temporarily suspended</p>
        </div>

        <!-- Content -->
        <div class="p-8">
          <div class="status-card p-6 rounded-xl mb-6">
            <div class="flex items-start">
              <mat-icon class="text-amber-700 mr-3 mt-1">warning</mat-icon>
              <div>
                <h3 class="font-semibold text-slate-900 text-lg mb-2">Suspension Details</h3>
                <p class="text-slate-700 mb-2 leading-relaxed">
                  {{ restrictionMessage }}
                </p>
                <p class="text-slate-700 text-sm">
                  You have received <strong>{{ violationCount }}</strong> violation(s).
                </p>
              </div>
            </div>
          </div>

          <!-- What this means -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-slate-900 mb-4">What This Means</h3>
            <div class="space-y-3">
              <div class="flex items-start info-row">
                <mat-icon class="text-red-500 mr-3 mt-1 text-sm">close</mat-icon>
                <p class="text-slate-700">You cannot access any CycleMart features</p>
              </div>
              <div class="flex items-start info-row">
                <mat-icon class="text-red-500 mr-3 mt-1 text-sm">close</mat-icon>
                <p class="text-slate-700">You cannot list products or send messages</p>
              </div>
              <div class="flex items-start info-row">
                <mat-icon class="text-red-500 mr-3 mt-1 text-sm">close</mat-icon>
                <p class="text-slate-700">This is your final warning before permanent ban</p>
              </div>
            </div>
          </div>

          <!-- Next steps -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-slate-900 mb-4">What You Can Do</h3>
            <div class="help-card rounded-xl p-4 space-y-2">
              <div class="flex items-start">
                <mat-icon class="text-green-700 mr-3 mt-1 text-sm">info</mat-icon>
                <p class="text-slate-800 text-sm">Contact our email to appeal this suspension</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-green-700 mr-3 mt-1 text-sm">info</mat-icon>
                <p class="text-slate-800 text-sm">Review our Terms of Service and Community Guidelines</p>
              </div>
              <div class="flex items-start">
                <mat-icon class="text-green-700 mr-3 mt-1 text-sm">info</mat-icon>
                <p class="text-slate-800 text-sm">Wait for admin review of your case</p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-4">
            <button mat-raised-button class="flex-1 logout-btn" (click)="logout()">
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
        <div class="footer-strip px-8 py-4 border-t border-green-100">
          <p class="text-center text-slate-600 text-sm">
            Need help? Email us at <a href="mailto:support@cyclemart.com" class="text-green-700 hover:underline font-semibold">cyclemrt&#64;gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .suspended-shell {
      background: #f4f8f5;
    }

    .suspended-card {
      background: #ffffff;
      border: 1px solid #dcfce7;
      border-radius: 16px;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
    }

    .suspended-header {
      background: #2e7d32;
    }

    .header-subtitle {
      color: #dcfce7;
    }

    .header-icon-wrap {
      width: 5rem;
      height: 5rem;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .status-card {
      background: #fff7ed;
      border: 1px solid #fdba74;
    }

    .help-card {
      background: #f0fdf4;
      border: 1px solid #86efac;
    }

    .info-row {
      min-height: 24px;
    }

    .logout-btn {
      background: #d32f2f !important;
      color: #ffffff !important;
      border-radius: 10px;
      height: 44px;
      box-shadow: none !important;
    }

    .logout-btn:hover {
      background: #b71c1c !important;
    }

    .footer-strip {
      background: #f8fafc;
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
