import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../api/api.service';

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
        <button mat-icon-button 
                (click)="closeModal()" 
                class="text-gray-400 hover:text-gray-600">
          <mat-icon>close</mat-icon>
        </button>
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
          </div>
        </div>
      </div>

      <!-- Modal Actions -->
      <div mat-dialog-actions class="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
        <button mat-button 
                (click)="closeModal()"
                class="px-6 py-2 text-gray-600 hover:text-gray-800">
          <mat-icon class="mr-2">close</mat-icon>
          Close
        </button>
        
        <button mat-raised-button 
                color="primary"
                (click)="editUser()"
                class="px-6 py-2">
          <mat-icon class="mr-2">edit</mat-icon>
          Edit User
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
  `]
})
export class UserDetailModalComponent {
  constructor(
    public dialogRef: MatDialogRef<UserDetailModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: User,
    private apiService: ApiService
  ) {}

  closeModal(): void {
    this.dialogRef.close();
  }

  editUser(): void {
    this.dialogRef.close({ action: 'edit', user: this.data });
  }

  onImageError(event: any): void {
    console.log('Image failed to load:', event.target.src);
    console.log('User data for fallback:', this.data);
    console.log('Trying alternative URL constructions...');
    
    // Get the original image path from the user data
    const imagePath = this.data.profile_image;
    if (imagePath) {
      const originalSrc = event.target.src;
      
      // Try without api/ in the path
      const alternativeUrl1 = `http://localhost/CycleMart/CycleMart/CycleMart-api/${imagePath}`;
      console.log('Trying alternative URL 1:', alternativeUrl1);
      
      if (originalSrc !== alternativeUrl1) {
        event.target.src = alternativeUrl1;
        return;
      }
      
      // Try with different base structure
      const alternativeUrl2 = `http://localhost/CycleMart/CycleMart-api/${imagePath}`;
      console.log('Trying alternative URL 2:', alternativeUrl2);
      
      if (originalSrc !== alternativeUrl2) {
        event.target.src = alternativeUrl2;
        return;
      }

      // Try direct access to uploads
      const alternativeUrl3 = `http://localhost/CycleMart/CycleMart/CycleMart-api/${imagePath}`;
      console.log('Trying alternative URL 3:', alternativeUrl3);
      
      if (originalSrc !== alternativeUrl3) {
        event.target.src = alternativeUrl3;
        return;
      }
    }
    
    // If all else fails, use placeholder with user's initial
    console.log('All image URLs failed, using placeholder');
    const userInitial = this.data.full_name?.charAt(0).toUpperCase() || 
                       this.data.email?.charAt(0).toUpperCase() || 'U';
    event.target.src = `https://via.placeholder.com/96x96/6366f1/white?text=${userInitial}`;
  }

  getProfileImageUrl(imagePath?: string): string {
    if (!imagePath) {
      console.log('No image path provided, using placeholder');
      return 'https://via.placeholder.com/96x96/6366f1/white?text=' + 
             (this.data.full_name?.charAt(0).toUpperCase() || 'U');
    }
    
    // The images are stored as 'uploads/profile_xxx.jpeg' in database
    // Base URL: http://localhost/CycleMart/CycleMart/CycleMart-api/api/
    // Final URL: http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/profile_xxx.jpeg
    
    const fullUrl = `${this.apiService.baseUrl}${imagePath}`;
    
    console.log('=== Image URL Debug ===');
    console.log('Base URL:', this.apiService.baseUrl);
    console.log('Image path from DB:', imagePath);
    console.log('Final URL:', fullUrl);
    console.log('User data:', this.data);
    console.log('=======================');
    
    // Test the URL immediately
    this.testImageUrl(fullUrl);
    
    return fullUrl;
  }

  // Test if the image URL is accessible
  private async testImageUrl(url: string): Promise<void> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`Image URL test for ${url}:`, response.status, response.statusText);
      if (!response.ok) {
        console.error('Image not accessible:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to test image URL:', error);
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
}