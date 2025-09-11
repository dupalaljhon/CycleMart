import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api/api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, SidenavComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // User profile properties based on new database schema
  id = 0;
  full_name = '';
  email = '';
  phone = '';
  address = '';
  profile_image = '';
  terms_accepted = false;
  is_verified = false;
  created_at = '';
  
  // UI properties
  imagePreview: string | ArrayBuffer | null = null;
  isEditModalOpen = false;
  successMessage = '';
  errorMessage = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadUserProfile();
  }

  // Load user profile from backend
  private loadUserProfile(): void {
    const userId = localStorage.getItem('id');
    if (!userId) {
      this.errorMessage = 'No user ID found. Please login again.';
      return;
    }

    this.api.getUser(Number(userId)).subscribe({
      next: (res: any) => {
        console.log('Fetched user:', res);
        if (res.status === 'success' && res.data.length > 0) {
          const user = res.data[0];
          this.id = user.id || 0;
          this.full_name = user.full_name || '';
          this.email = user.email || '';
          this.phone = user.phone || '';
          this.address = user.address || '';
          this.profile_image = user.profile_image || '';
          this.terms_accepted = user.terms_accepted || false;
          this.is_verified = user.is_verified || false;
          this.created_at = user.created_at || '';
          
          // Set image preview if profile image exists
          this.imagePreview = user.profile_image
            ? this.api.baseUrl + user.profile_image
            : null;
        }
      },
      error: (err: unknown) => {
        console.error('Error fetching user:', err);
        this.errorMessage = 'Failed to load profile information.';
      }
    });
  }

  // Trigger file input click
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  // Handle file selection
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.readFile(file);
    }
  }

  // Read file and convert to base64
  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result;
      // Automatically save the profile image
      this.saveProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Save profile image
  private saveProfileImage(imageData: string): void {
    const payload = {
      user_id: this.id,
      full_name: this.full_name,
      phone: this.phone,
      address: this.address,
      image: imageData
    };

    this.api.editProfile(payload).subscribe({
      next: (res: any) => {
        if (res.status === 'success') {
          this.successMessage = 'Profile picture updated successfully!';
          if (res.data.profile_image) {
            this.profile_image = res.data.profile_image;
            this.imagePreview = this.api.baseUrl + res.data.profile_image;
          }
        } else {
          this.errorMessage = res.message || 'Failed to update profile picture';
        }
      },
      error: (err: unknown) => {
        console.error('Error updating profile picture:', err);
        this.errorMessage = 'Error updating profile picture';
      }
    });
  }

  // Open edit profile modal
  onEditProfile(): void {
    this.isEditModalOpen = true;
  }

  // Close modal
  closeModal(): void {
    this.isEditModalOpen = false;
  }

  // Save profile changes
  saveProfile(): void {
    if (!this.full_name.trim()) {
      this.errorMessage = 'Full name is required';
      return;
    }

    const payload = {
      user_id: this.id,
      full_name: this.full_name.trim(),
      phone: this.phone.trim(),
      address: this.address.trim()
    };

    this.api.editProfile(payload).subscribe({
      next: (res: any) => {
        if (res.status === 'success') {
          this.successMessage = 'Profile updated successfully!';
          
          // Update local data
          this.full_name = res.data.full_name || this.full_name;
          this.phone = res.data.phone || this.phone;
          this.address = res.data.address || this.address;
          
          this.closeModal();
        } else {
          this.errorMessage = res.message || 'Failed to update profile';
        }
      },
      error: (err: unknown) => {
        console.error('Error updating profile:', err);
        this.errorMessage = 'Error updating profile';
      }
    });
  }

  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return 'Not available';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  // Close success/error messages
  closeMessage(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  // Utility function for template
  encodeURIComponent(value: string): string {
    return encodeURIComponent(value || '');
  }
}
