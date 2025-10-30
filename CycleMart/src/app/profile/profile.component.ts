import { Component, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { Router } from '@angular/router';
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

  // User profile properties based on users database schema
  id = 0;
  full_name = '';
  email = '';
  phone = '';
  street = '';
  barangay = '';
  city = '';
  province = '';
  profile_image = '';
  terms_accepted = false;
  is_verified = false;
  verification_token = '';
  token_expires_at = '';
  created_at = '';
  updated_at = '';
  
  // UI properties
  imagePreview: string | ArrayBuffer | null = null;
  isEditModalOpen = false;
  successMessage = '';
  errorMessage = '';
  
  // Email editing properties
  editEmail = '';
  originalEmail = '';
  showEmailChangeModal = false;
  
  // Rating properties
  averageStars: number = 0;
  totalRatings: number = 0;
  avgCommunication: number = 0;
  avgProduct: number = 0;
  avgAppHelp: number = 0;
  detailedRatings: any[] = [];
  
  // Image enlargement properties
  isImageModalOpen = false;
  enlargedImageUrl = '';
  enlargedImageAlt = '';

  constructor(public api: ApiService, private router: Router) {}

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
          this.originalEmail = user.email || '';
          this.editEmail = user.email || '';
          this.phone = user.phone || '';
          this.street = user.street || '';
          this.barangay = user.barangay || '';
          this.city = user.city || '';
          this.province = user.province || '';
          this.profile_image = user.profile_image || '';
          this.terms_accepted = user.terms_accepted || false;
          this.is_verified = user.is_verified || false;
          this.verification_token = user.verification_token || '';
          this.token_expires_at = user.token_expires_at || '';
          this.created_at = user.created_at || '';
          this.updated_at = user.updated_at || '';
          
          // Set image preview if profile image exists
          this.imagePreview = user.profile_image
            ? this.api.baseUrl.replace('/api/', '/') + user.profile_image
            : null;
            
          // Load user ratings
          this.loadUserRatings();
        }
      },
      error: (err: unknown) => {
        console.error('Error fetching user:', err);
        this.errorMessage = 'Failed to load profile information.';
      }
    });
  }

  // Load user ratings from backend
  private loadUserRatings(): void {
    if (this.id) {
      // Load average ratings
      this.api.getUserAverageRatings(this.id).subscribe({
        next: (res: any) => {
          if (res.status === 'success' && res.data.length > 0) {
            const ratings = res.data[0];
            this.averageStars = parseFloat(ratings.average_stars) || 0;
            this.totalRatings = parseInt(ratings.total_ratings) || 0;
            this.avgCommunication = parseFloat(ratings.avg_communication) || 0;
            this.avgProduct = parseFloat(ratings.avg_product) || 0;
            this.avgAppHelp = parseFloat(ratings.avg_app_help) || 0;
          }
        },
        error: (err: unknown) => {
          console.error('Error fetching user ratings:', err);
          // Don't show error message for ratings as it's not critical
        }
      });

      // Load detailed ratings with product info and comments
      this.api.getUserRatings(this.id).subscribe({
        next: (res: any) => {
          if (res.status === 'success' && res.data) {
            this.detailedRatings = res.data;
          }
        },
        error: (err: unknown) => {
          console.error('Error fetching detailed ratings:', err);
        }
      });
    }
  }

  // Get star rating array for display
  getStarArray(rating: number): boolean[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(true); // Full star
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(true); // Half star (we'll treat it as full for simplicity)
      } else {
        stars.push(false); // Empty star
      }
    }
    return stars;
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
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Please select a valid image file';
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'Image size must be less than 5MB';
        return;
      }
      
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
      this.readFile(file);
      
      // Clear the input so the same file can be selected again
      input.value = '';
    } else {
      console.log('No file selected');
    }
  }

  // Read file and convert to base64
  private readFile(file: File): void {
    console.log('Reading file:', file.name, 'Size:', file.size, 'Type:', file.type);
    const reader = new FileReader();
    
    reader.onload = () => {
      this.imagePreview = reader.result;
      console.log('File loaded successfully!');
      console.log('imagePreview type:', typeof this.imagePreview);
      console.log('imagePreview length:', this.imagePreview ? this.imagePreview.toString().length : 0);
      console.log('imagePreview starts with data:image:', this.imagePreview ? this.imagePreview.toString().startsWith('data:image') : false);
      console.log('isEditModalOpen:', this.isEditModalOpen);
      
      // Clear any previous error messages
      this.errorMessage = '';
      
      // Only automatically save if we're not in edit modal
      if (!this.isEditModalOpen) {
        console.log('Auto-saving image outside modal');
        this.saveProfileImage(reader.result as string);
      } else {
        console.log('In edit modal - image preview updated but not saved yet');
        console.log('Image will be saved when Save Changes is clicked');
      }
    };
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      this.errorMessage = 'Error reading selected image file';
    };
    
    reader.readAsDataURL(file);
  }

  // Save profile image (when uploaded outside modal)
  private saveProfileImage(imageData: string): void {
    console.log('Auto-saving profile image outside modal...');
    
    const payload = {
      user_id: this.id,
      full_name: this.full_name,
      email: this.email, // Keep current email
      phone: this.phone,
      street: this.street,
      barangay: this.barangay,
      city: this.city,
      province: this.province,
      email_changed: false, // No email change for image-only update
      image: imageData
    };

    this.api.editProfile(payload).subscribe({
      next: (res: any) => {
        if (res.status === 'success') {
          this.successMessage = 'Profile picture updated successfully!';
          
          // Update the profile_image path from server response
          if (res.data && res.data.profile_image) {
            this.profile_image = res.data.profile_image;
            console.log('Profile image updated on server:', this.profile_image);
            
            // Update imagePreview to use the server path for consistency
            this.imagePreview = this.api.baseUrl.replace('/api/', '/') + res.data.profile_image;
            console.log('Updated imagePreview to server path:', this.imagePreview);
          } else {
            // Keep the base64 imagePreview if server doesn't return path
            console.log('Server did not return profile_image path, keeping base64');
          }
        } else {
          this.errorMessage = res.message || 'Failed to update profile picture';
          console.error('Server error:', res.message);
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
    this.editEmail = this.email; // Reset email field to current email
    
    // Ensure imagePreview is set correctly for the modal
    // If we don't have a current imagePreview or it's not valid, set it from profile_image
    if (!this.imagePreview || (!this.imagePreview.toString().startsWith('data:image') && !this.imagePreview.toString().startsWith('http'))) {
      if (this.profile_image) {
        this.imagePreview = this.api.baseUrl.replace('/api/', '/') + this.profile_image;
      }
    }
    
    console.log('Opening edit modal with image:', this.imagePreview); // Debug log
    this.isEditModalOpen = true;
  }

  // Close modal
  closeModal(): void {
    this.isEditModalOpen = false;
    this.showEmailChangeModal = false; // Also close email change modal
    this.editEmail = this.email; // Reset email field
    
    // Reset imagePreview to current server profile image only if needed
    // This ensures that any uploaded but unsaved images are discarded
    if (this.profile_image) {
      this.imagePreview = this.api.baseUrl.replace('/api/', '/') + this.profile_image;
      console.log('Modal closed - reset imagePreview to server image:', this.imagePreview);
    } else {
      this.imagePreview = null;
      console.log('Modal closed - no server image, set imagePreview to null');
    }
  }

  // Confirm email change
  confirmEmailChange(): void {
    this.showEmailChangeModal = false;
    // Proceed with the actual profile save
    this.proceedWithSave();
  }

  // Cancel email change
  cancelEmailChange(): void {
    this.showEmailChangeModal = false;
    // Don't proceed with save
  }

  // Save profile changes
  saveProfile(): void {
    if (!this.full_name.trim()) {
      this.errorMessage = 'Full name is required';
      return;
    }

    if (!this.editEmail.trim()) {
      this.errorMessage = 'Email is required';
      return;
    }

    // Check if email format is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.editEmail.trim())) {
      this.errorMessage = 'Please enter a valid email address';
      return;
    }

    const emailChanged = this.editEmail.trim() !== this.originalEmail;

    // Show confirmation modal for email changes
    if (emailChanged) {
      this.showEmailChangeModal = true;
      return; // Wait for user confirmation
    }

    // If no email change, proceed directly with save
    this.proceedWithSave();
  }

  // Proceed with the actual profile save operation
  private proceedWithSave(): void {
    const emailChanged = this.editEmail.trim() !== this.originalEmail;
    
    // Prepare image data for saving
    let imageDataToSend = null;
    
    // Only send image if it's a base64 string (newly uploaded)
    if (this.imagePreview && this.imagePreview.toString().startsWith('data:image')) {
      imageDataToSend = this.imagePreview;
      console.log('Sending new base64 image data to server');
    } else {
      console.log('No new image to upload - keeping existing server image');
    }

    const payload = {
      user_id: this.id,
      full_name: this.full_name.trim(),
      email: this.editEmail.trim(),
      phone: this.phone.trim(),
      street: this.street.trim(),
      barangay: this.barangay.trim(),
      city: this.city.trim(),
      province: this.province.trim(),
      email_changed: emailChanged,
      image: imageDataToSend // Only send if it's new base64 data
    };

    console.log('Saving profile with payload:', { ...payload, image: payload.image ? 'Base64 data (' + payload.image.toString().length + ' chars)' : null });

    this.api.editProfile(payload).subscribe({
      next: (res: any) => {
        if (res.status === 'success') {
          if (emailChanged) {
            this.successMessage = 'Profile updated successfully! A verification email has been sent to your new email address. You will be logged out for security.';
            
            // Close modal and log out user after showing message
            this.closeModal();
            setTimeout(() => {
              // Clear local storage and redirect to login
              localStorage.clear();
              this.router.navigate(['/login']);
            }, 3000);
          } else {
            this.successMessage = 'Profile updated successfully!';
            
            // Update local data for non-email changes
            this.full_name = res.data.full_name || this.full_name;
            this.phone = res.data.phone || this.phone;
            this.street = res.data.street || this.street;
            this.barangay = res.data.barangay || this.barangay;
            this.city = res.data.city || this.city;
            this.province = res.data.province || this.province;
            
            // Update profile image if server returned a new path
            if (res.data && res.data.profile_image) {
              this.profile_image = res.data.profile_image;
              // Update image preview to use server path
              this.imagePreview = this.api.baseUrl.replace('/api/', '/') + res.data.profile_image;
              console.log('Profile image updated from server:', this.profile_image);
            }
            
            this.closeModal();
          }
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

  // Format full address from separate fields
  formatFullAddress(): string {
    const parts = [this.street, this.barangay, this.city, this.province].filter(part => part && part.trim());
    return parts.join(', ') || 'Not provided';
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

  // Get product image URL
  getProductImageUrl(productImages: string | null): string {
    if (!productImages || productImages.trim() === '' || productImages === '[]') {
      return 'https://via.placeholder.com/150x150/e5e7eb/9ca3af?text=No+Image';
    }
    
    try {
      // Handle different possible formats
      let images: any;
      
      // If it's already a valid URL string (not JSON)
      if (productImages.startsWith('http') || productImages.startsWith('/') || productImages.startsWith('uploads/')) {
        if (productImages.startsWith('http')) {
          return productImages;
        }
        const directPath = this.api.baseUrl + productImages;
        return directPath;
      }
      
      // Try to parse as JSON
      images = JSON.parse(productImages);
      
      if (images && Array.isArray(images) && images.length > 0) {
        let firstImage = images[0];
        
        // Handle object format: {path: "...", name: "..."}
        if (typeof firstImage === 'object' && firstImage.path) {
          firstImage = firstImage.path;
        }
        
        // If it's a full URL, return as is
        if (firstImage.startsWith('http')) {
          return firstImage;
        }
        
        // If it's a relative path, prepend the correct base URL
        let fullPath;
        if (firstImage.startsWith('/')) {
          // For absolute paths starting with /
          fullPath = this.api.baseUrl + firstImage.substring(1);
        } else {
          // For uploads/ path, keep the CycleMart-api/api/ path since that's where uploads are stored
          fullPath = this.api.baseUrl + firstImage;
        }
        
        return fullPath;
      }
    } catch (e) {
      // If JSON parsing failed, try treating it as a direct path
      if (typeof productImages === 'string' && productImages.length > 0) {
        if (productImages.startsWith('http')) {
          return productImages;
        }
        const fallbackPath = this.api.baseUrl + productImages;
        return fallbackPath;
      }
    }
    
    return 'https://via.placeholder.com/150x150/e5e7eb/9ca3af?text=No+Image';
  }

  // Get buyer avatar URL
  getBuyerAvatarUrl(profileImage: string | null | undefined, name: string): string {
    if (profileImage && profileImage.trim() !== '') {
      // If it's a full URL, return as is
      if (profileImage.startsWith('http')) {
        return profileImage;
      }
      // If it's a relative path, prepend the API base URL
      return this.api.baseUrl.replace('/api/', '/') + profileImage;
    }
    
    // Generate avatar using UI Avatars with black background
    const colors = ['000000', '333333', '666666', '999999', 'CCCCCC'];
    const color = colors[name.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=64`;
  }

  // Format rating date
  formatRatingDate(dateString: string): string {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  // Handle image error
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    console.error('Failed to load image:', img.src);
    console.log('Fallback will be used');
    if (img) {
      img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.full_name)}&background=000000&color=fff&size=128`;
    }
  }

  // Handle image load success
  onImageLoad(event: Event): void {
    console.log('Image loaded successfully:', (event.target as HTMLImageElement).src);
  }

  // Open image enlargement modal
  enlargeImage(imageUrl: string, altText: string): void {
    this.enlargedImageUrl = imageUrl;
    this.enlargedImageAlt = altText;
    this.isImageModalOpen = true;
  }

  // Close image enlargement modal
  closeImageModal(): void {
    this.isImageModalOpen = false;
    this.enlargedImageUrl = '';
    this.enlargedImageAlt = '';
  }

  // Listen for Escape key to close modal
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isImageModalOpen) {
      this.closeImageModal();
    }
  }

  // Utility function for template
  encodeURIComponent(value: string): string {
    return encodeURIComponent(value || '');
  }

  // Get the current profile image URL for display
  getCurrentProfileImageUrl(): string {
    // Priority order:
    // 1. imagePreview (if it's a base64 string from recent upload or valid URL)
    // 2. profile_image (server path)
    // 3. fallback avatar
    
    if (this.imagePreview) {
      // If imagePreview is a base64 string, use it
      if (this.imagePreview.toString().startsWith('data:image')) {
        console.log('Using base64 imagePreview for display');
        return this.imagePreview.toString();
      }
      // If imagePreview is already a URL, use it
      if (this.imagePreview.toString().startsWith('http') || this.imagePreview.toString().includes('/CycleMart/')) {
        console.log('Using URL imagePreview for display:', this.imagePreview);
        return this.imagePreview.toString();
      }
    }
    
    // If we have a profile_image path from server
    if (this.profile_image) {
      const serverUrl = this.api.baseUrl.replace('/api/', '/') + this.profile_image;
      console.log('Using server profile_image:', serverUrl);
      return serverUrl;
    }
    
    // Fallback to generated avatar
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.full_name)}&background=000000&color=fff&size=128`;
    console.log('Using fallback avatar:', fallbackUrl);
    return fallbackUrl;
  }


}
