import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../api/api.service';
import { environment } from '../../../../environments/environment';

interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  address?: string;
  profile_image?: string;
  terms_accepted: boolean;
  is_verified: boolean;
  created_at: string;
  account_status?: string;
  violation_count?: number;
}

interface ViolationTimelineItem {
  source: 'report' | 'admin_violation';
  id: number;
  title: string;
  reason: string;
  reason_type?: string;
  status?: string;
  reporter_name?: string;
  created_at: string;
}

@Component({
  selector: 'app-user-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule
  ],
  template: `
    <div class="user-detail-modal">
      <!-- Modal Header -->
      <div mat-dialog-title class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <mat-icon class="text-blue-600 text-2xl">person</mat-icon>
          <h2 class="text-xl font-semibold text-gray-800">User Details</h2>
        </div>
        
      </div>

      <!-- Modal Content -->
      <div mat-dialog-content class="p-6 max-w-2xl">
        <!-- Profile Section -->
        <div class="flex items-start space-x-6 mb-6">
          <!-- Profile Image -->
          <div class="flex-shrink-0">
            <div class="relative">
              <img [src]="getProfileImageUrl(data.profile_image)" 
                   [alt]="data.full_name"
                   (error)="onImageError($event)"
                   class="w-24 h-24 rounded-full border-4 border-gray-200 object-cover shadow-lg">
              <div *ngIf="data.is_verified" 
                   class="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                <mat-icon class="text-white text-sm">verified</mat-icon>
              </div>
            </div>
          </div>

          <!-- Basic Info -->
          <div class="flex-1">
            <h3 class="text-2xl font-bold text-gray-900 mb-2">
              {{ data.full_name || 'No Name Provided' }}
            </h3>
            
            <!-- Verification Status -->
            <div class="mb-4">
              <mat-chip-set>
                <mat-chip 
                  [class]="data.is_verified ? 
                    'bg-green-100 text-green-800 border border-green-200' : 
                    'bg-red-100 text-red-800 border border-red-200'"
                  class="px-3 py-2 rounded-full text-sm font-medium">
                  <mat-icon class="text-sm mr-2">
                    {{ data.is_verified ? 'verified' : 'pending' }}
                  </mat-icon>
                  {{ data.is_verified ? 'Verified Account' : 'Unverified Account' }}
                </mat-chip>
              </mat-chip-set>
            </div>

            <!-- Member Since -->
            <div class="flex items-center text-gray-600 mb-2">
              <mat-icon class="text-gray-400 mr-2">schedule</mat-icon>
              <span>Member since {{ formatDate(data.created_at) }}</span>
            </div>

            <!-- User ID -->
            <div class="flex items-center text-gray-600">
              <mat-icon class="text-gray-400 mr-2">tag</mat-icon>
              <span>User ID: #{{ data.id }}</span>
            </div>
          </div>
        </div>

        <mat-divider class="my-6"></mat-divider>

        <!-- Contact Information -->
        <div class="mb-6">
          <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <mat-icon class="text-blue-600 mr-2">contact_page</mat-icon>
            Contact Information
          </h4>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Email -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center space-x-3">
                <div class="bg-blue-100 rounded-full p-2">
                  <mat-icon class="text-blue-600 text-sm">email</mat-icon>
                </div>
                <div>
                  <p class="text-sm text-gray-500 font-medium">Email Address</p>
                  <p class="text-gray-900 font-semibold">{{ data.email }}</p>
                </div>
              </div>
            </div>

            <!-- Phone -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center space-x-3">
                <div class="bg-green-100 rounded-full p-2">
                  <mat-icon class="text-green-600 text-sm">
                    {{ data.phone ? 'phone' : 'phone_disabled' }}
                  </mat-icon>
                </div>
                <div>
                  <p class="text-sm text-gray-500 font-medium">Phone Number</p>
                  <p class="text-gray-900 font-semibold">
                    {{ data.phone || 'Not provided' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Address Information -->
        <div class="mb-6" *ngIf="data.address">
          <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <mat-icon class="text-purple-600 mr-2">location_on</mat-icon>
            Address Information
          </h4>
          
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-start space-x-3">
              <div class="bg-purple-100 rounded-full p-2 mt-1">
                <mat-icon class="text-purple-600 text-sm">home</mat-icon>
              </div>
              <div>
                <p class="text-sm text-gray-500 font-medium">Home Address</p>
                <p class="text-gray-900 font-semibold">{{ data.address }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Account Details -->
        <div>
          <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <mat-icon class="text-orange-600 mr-2">account_circle</mat-icon>
            Account Details
          </h4>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Terms Accepted -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center space-x-3">
                <div [class]="data.terms_accepted ? 'bg-green-100' : 'bg-red-100'" 
                     class="rounded-full p-2">
                  <mat-icon [class]="data.terms_accepted ? 'text-green-600' : 'text-red-600'" 
                            class="text-sm">
                    {{ data.terms_accepted ? 'check_circle' : 'cancel' }}
                  </mat-icon>
                </div>
                <div>
                  <p class="text-sm text-gray-500 font-medium">Terms & Conditions</p>
                  <p class="font-semibold" 
                     [class]="data.terms_accepted ? 'text-green-700' : 'text-red-700'">
                    {{ data.terms_accepted ? 'Accepted' : 'Not Accepted' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Account Creation -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center space-x-3">
                <div class="bg-blue-100 rounded-full p-2">
                  <mat-icon class="text-blue-600 text-sm">event</mat-icon>
                </div>
                <div>
                  <p class="text-sm text-gray-500 font-medium">Account Created</p>
                  <p class="text-gray-900 font-semibold">{{ formatDateTime(data.created_at) }}</p>
                </div>
              </div>
            </div>

            <!-- Account Status -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center space-x-3">
                <div class="bg-emerald-100 rounded-full p-2">
                  <mat-icon class="text-emerald-600 text-sm">verified_user</mat-icon>
                </div>
                <div>
                  <p class="text-sm text-gray-500 font-medium">Account Status</p>
                  <p class="text-gray-900 font-semibold">{{ formatStatusLabel(data.account_status || 'active') }}</p>
                </div>
              </div>
            </div>

            <!-- Total Violations -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center space-x-3">
                <div class="bg-orange-100 rounded-full p-2">
                  <mat-icon class="text-orange-600 text-sm">gpp_bad</mat-icon>
                </div>
                <div>
                  <p class="text-sm text-gray-500 font-medium">Total Violations</p>
                  <p class="text-gray-900 font-semibold">{{ data.violation_count || 0 }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <mat-divider class="my-6"></mat-divider>

        <!-- Violation & Report History -->
        <div>
          <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <mat-icon class="text-red-600 mr-2">history</mat-icon>
            Violation and Report History
          </h4>

          <div *ngIf="isViolationLoading" class="text-center py-6 text-gray-500">
            <mat-icon class="animate-spin text-green-600">refresh</mat-icon>
            <p class="mt-2">Loading violation details...</p>
          </div>

          <div *ngIf="!isViolationLoading && violationTimeline.length === 0" class="text-center py-6 bg-gray-50 rounded-lg text-gray-500">
            <mat-icon class="text-gray-400">check_circle</mat-icon>
            <p class="mt-2">No violation or report history found for this user.</p>
          </div>

          <div *ngIf="!isViolationLoading && violationTimeline.length > 0" class="timeline-wrap">
            <div *ngFor="let item of violationTimeline" class="timeline-item relative pl-8 pb-5">
              <div class="timeline-line absolute left-3 top-0 bottom-0"></div>
              <div class="timeline-dot absolute left-1.5 top-1"
                   [class.dot-report]="item.source === 'report'"
                   [class.dot-violation]="item.source === 'admin_violation'">
              </div>

              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-semibold text-gray-900">{{ item.title }}</p>
                    <p class="text-sm text-gray-500" *ngIf="item.source === 'report' && item.reporter_name">
                      Reported by: {{ item.reporter_name }}
                    </p>
                  </div>

                  <mat-chip-set>
                    <mat-chip class="text-xs font-medium"
                              [class]="item.source === 'report' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-orange-100 text-orange-800 border border-orange-200'">
                      {{ item.source === 'report' ? 'Report' : 'Violation' }}
                    </mat-chip>
                  </mat-chip-set>
                </div>

                <p class="text-sm text-gray-700 mt-3">
                  <span class="font-semibold">Reason:</span> {{ item.reason }}
                </p>

                <div class="flex flex-wrap items-center gap-2 mt-3 text-xs">
                  <span *ngIf="item.reason_type" class="px-2 py-1 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Type: {{ formatStatusLabel(item.reason_type) }}
                  </span>
                  <span *ngIf="item.status" class="px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Status: {{ formatStatusLabel(item.status) }}
                  </span>
                  <span class="px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200">
                    {{ formatDateTime(item.created_at) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Actions -->
     <div class="absolute top-4 right-4">
  <button mat-icon-button (click)="closeModal()">
    <mat-icon>close</mat-icon>
  </button>
</div>
    </div>
  `,
  styles: [`
    .user-detail-modal {
      max-height: 90vh;
      overflow-y: auto;
    }
    
    ::ng-deep .mat-mdc-dialog-container {
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    .mat-chip {
      font-weight: 500;
    }

    .timeline-wrap {
      position: relative;
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .timeline-item:last-child .timeline-line {
      display: none;
    }

    .timeline-line {
      width: 2px;
      background: #d1d5db;
    }

    .timeline-dot {
      width: 12px;
      height: 12px;
      border-radius: 9999px;
      border: 2px solid white;
      box-shadow: 0 0 0 2px #e5e7eb;
    }

    .dot-report {
      background: #ef4444;
    }

    .dot-violation {
      background: #f97316;
    }

    .animate-spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }

      to {
        transform: rotate(360deg);
      }
    }
  `]
})
export class UserDetailModalComponent implements OnInit {
  isViolationLoading = false;
  violationTimeline: ViolationTimelineItem[] = [];

  constructor(
    public dialogRef: MatDialogRef<UserDetailModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: User,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.loadViolationDetails();
  }

  private loadViolationDetails(): void {
    this.isViolationLoading = true;

    this.apiService.getUserViolationDetails(this.data.id).subscribe({
      next: (response: any) => {
        this.isViolationLoading = false;

        if (response?.status === 'success') {
          const userData = response?.data?.user;
          if (userData) {
            this.data.account_status = userData.account_status || this.data.account_status || 'active';
            this.data.violation_count = Number(userData.violation_count ?? this.data.violation_count ?? 0);
          }

          this.violationTimeline = (response?.data?.timeline || []).map((item: any) => ({
            source: item.source,
            id: Number(item.id),
            title: item.title || (item.source === 'report' ? 'User Report Submitted' : 'Account Violation Notice'),
            reason: item.reason || 'No reason provided',
            reason_type: item.reason_type || null,
            status: item.status || null,
            reporter_name: item.reporter_name || null,
            created_at: item.created_at
          }));
        }
      },
      error: (error: any) => {
        this.isViolationLoading = false;
      }
    });
  }

  closeModal(): void {
    this.dialogRef.close();
  }

  editUser(): void {
    this.dialogRef.close({ action: 'edit', user: this.data });
  }

  onImageError(event: any): void {
    
    // Get the original image path from the user data
    const imagePath = this.data.profile_image;
    if (imagePath) {
      const originalSrc = event.target.src;
      
      // Try without api/ in the path
      const alternativeUrl1 = `${environment.apiUploadsBaseUrl}${imagePath.replace(/^\/+/, '')}`;
      
      if (originalSrc !== alternativeUrl1) {
        event.target.src = alternativeUrl1;
        return;
      }
      
      // Try with different base structure
      const alternativeUrl2 = `${environment.apiUploadsBaseUrl}${imagePath.replace(/^\/+/, '')}`;
      
      if (originalSrc !== alternativeUrl2) {
        event.target.src = alternativeUrl2;
        return;
      }

      // Try direct access to uploads
      const alternativeUrl3 = `${environment.apiUploadsBaseUrl}${imagePath.replace(/^\/+/, '')}`;
      
      if (originalSrc !== alternativeUrl3) {
        event.target.src = alternativeUrl3;
        return;
      }
    }
    
    // If all else fails, use placeholder with user's initial
    const userInitial = this.data.full_name?.charAt(0).toUpperCase() || 
                       this.data.email?.charAt(0).toUpperCase() || 'U';
    event.target.src = `https://via.placeholder.com/96x96/6366f1/white?text=${userInitial}`;
  }

  getProfileImageUrl(imagePath?: string): string {
    if (!imagePath) {
      return 'https://via.placeholder.com/96x96/6366f1/white?text=' + 
             (this.data.full_name?.charAt(0).toUpperCase() || 'U');
    }
    
    // The images are stored as 'uploads/profile_xxx.jpeg' in database
    // Base URL: http://api.cyclemart.shop/CycleMart-api/api
    // Final URL: http://api.cyclemart.shop/CycleMart-api/api/uploads/profile_xxx.jpeg
    
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    const fullUrl = `${environment.apiUploadsBaseUrl}${cleanPath}`;
    
    
    // Test the URL immediately
    this.testImageUrl(fullUrl);
    
    return fullUrl;
  }

  // Test if the image URL is accessible
  private async testImageUrl(url: string): Promise<void> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
      }
    } catch (error) {
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatStatusLabel(status?: string): string {
    if (!status) {
      return 'N/A';
    }

    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
