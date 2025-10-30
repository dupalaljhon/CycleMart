import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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

interface DeleteData {
  user: User;
  onConfirm: (user: User) => void;
  apiService: ApiService;
}

@Component({
  selector: 'app-delete-user-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="delete-user-modal">
      <!-- Modal Header -->
      <div mat-dialog-title class="flex items-center justify-between p-6 border-b border-red-200 bg-red-50">
        <div class="flex items-center space-x-3">
          <div class="bg-red-100 rounded-full p-2">
            <mat-icon class="text-red-600 text-xl">warning</mat-icon>
          </div>
          <h2 class="text-xl font-semibold text-red-800">Delete User Confirmation</h2>
        </div>
        <button mat-icon-button 
                (click)="closeModal()" 
                class="text-red-400 hover:text-red-600"
                [disabled]="isDeleting">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Modal Content -->
      <div mat-dialog-content class="p-6">
        <!-- Warning Message -->
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-start space-x-3">
            <mat-icon class="text-red-500 mt-1">error</mat-icon>
            <div>
              <h3 class="text-red-800 font-semibold mb-2">⚠️ This action cannot be undone!</h3>
              <p class="text-red-700 text-sm">
                You are about to permanently delete this user and all associated data.
              </p>
            </div>
          </div>
        </div>

        <!-- User Information -->
        <div class="mb-6">
          <h4 class="text-lg font-semibold text-gray-800 mb-4">User to be deleted:</h4>
          
          <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div class="flex items-center space-x-4">
              <img [src]="getProfileImageUrl(data.user.profile_image)" 
                   [alt]="data.user.full_name"
                   (error)="onImageError($event)"
                   class="w-16 h-16 rounded-full border-2 border-gray-300 object-cover">
              
              <div class="flex-1">
                <h5 class="text-lg font-semibold text-gray-900">
                  {{ data.user.full_name || 'No Name Provided' }}
                </h5>
                <p class="text-gray-600 flex items-center mt-1">
                  <mat-icon class="text-sm mr-1">email</mat-icon>
                  {{ data.user.email }}
                </p>
                <p class="text-gray-600 flex items-center mt-1" *ngIf="data.user.phone">
                  <mat-icon class="text-sm mr-1">phone</mat-icon>
                  {{ data.user.phone }}
                </p>
                <div class="mt-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [class]="data.user.is_verified ? 
                          'bg-green-100 text-green-800' : 
                          'bg-red-100 text-red-800'">
                    <mat-icon class="text-xs mr-1">
                      {{ data.user.is_verified ? 'verified' : 'pending' }}
                    </mat-icon>
                    {{ data.user.is_verified ? 'Verified' : 'Unverified' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Data to be deleted -->
        <div class="mb-6">
          <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <mat-icon class="text-orange-600 mr-2">delete_sweep</mat-icon>
            The following data will be permanently deleted:
          </h4>
          
          <div class="space-y-3">
            <div class="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <mat-icon class="text-orange-600">inventory_2</mat-icon>
              <span class="text-orange-800 font-medium">All products and listings posted by this user</span>
            </div>
            
            <div class="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <mat-icon class="text-orange-600">chat</mat-icon>
              <span class="text-orange-800 font-medium">All conversations and messages</span>
            </div>
            
            <div class="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <mat-icon class="text-orange-600">report</mat-icon>
              <span class="text-orange-800 font-medium">All reports made by or about this user</span>
            </div>
            
            <div class="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <mat-icon class="text-orange-600">account_circle</mat-icon>
              <span class="text-orange-800 font-medium">User profile and account data</span>
            </div>
          </div>
        </div>

        <!-- Confirmation Input -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            To confirm deletion, please type the user's email address:
          </label>
          <input 
            type="text" 
            [(ngModel)]="confirmationInput"
            [placeholder]="data.user.email"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            [disabled]="isDeleting">
        </div>

        <!-- Loading State -->
        <div *ngIf="isDeleting" class="flex items-center justify-center py-6">
          <mat-spinner diameter="32" class="mr-3"></mat-spinner>
          <span class="text-gray-600 font-medium">Deleting user and all related data...</span>
        </div>
      </div>

      <!-- Modal Actions -->
      <div mat-dialog-actions class="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
        <button mat-button 
                (click)="closeModal()"
                class="px-6 py-2 text-gray-600 hover:text-gray-800"
                [disabled]="isDeleting">
          <mat-icon class="mr-2">close</mat-icon>
          Cancel
        </button>
        
        <button mat-raised-button 
                color="warn"
                (click)="confirmDelete()"
                [disabled]="!canDelete() || isDeleting"
                class="px-6 py-2 bg-red-600 hover:bg-red-700">
          <mat-icon class="mr-2" *ngIf="!isDeleting">delete_forever</mat-icon>
          <mat-spinner diameter="16" class="mr-2" *ngIf="isDeleting"></mat-spinner>
          {{ isDeleting ? 'Deleting...' : 'Delete User' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .delete-user-modal {
      max-height: 90vh;
      overflow-y: auto;
    }
    
    ::ng-deep .mat-mdc-dialog-container {
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    input:focus {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
  `]
})
export class DeleteUserModalComponent {
  confirmationInput = '';
  isDeleting = false;

  constructor(
    public dialogRef: MatDialogRef<DeleteUserModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteData
  ) {}

  closeModal(): void {
    if (!this.isDeleting) {
      this.dialogRef.close();
    }
  }

  canDelete(): boolean {
    return this.confirmationInput.toLowerCase() === this.data.user.email.toLowerCase();
  }

  async confirmDelete(): Promise<void> {
    if (!this.canDelete() || this.isDeleting) {
      return;
    }

    this.isDeleting = true;
    
    try {
      // Call the parent component's delete function
      await this.data.onConfirm(this.data.user);
      this.dialogRef.close({ deleted: true });
    } catch (error) {
      this.isDeleting = false;
      // Error handling is done in the parent component
    }
  }

  getProfileImageUrl(imagePath?: string): string {
    if (!imagePath) {
      return 'https://via.placeholder.com/64x64/6366f1/white?text=' + 
             (this.data.user.full_name?.charAt(0).toUpperCase() || 'U');
    }
    
    // The images are in the api/uploads directory
    const fullUrl = `${this.data.apiService.baseUrl}${imagePath}`;
    console.log('Delete modal image URL:', fullUrl);
    return fullUrl;
  }

  onImageError(event: any): void {
    console.log('Delete modal image failed to load:', event.target.src);
    // Set a fallback image
    event.target.src = 'https://via.placeholder.com/64x64/6366f1/white?text=' + 
                       (this.data.user.full_name?.charAt(0).toUpperCase() || 'U');
  }
}