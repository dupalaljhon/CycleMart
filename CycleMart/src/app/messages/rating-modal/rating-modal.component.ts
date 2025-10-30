import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';
import { NotificationService } from '../../services/notification.service';

interface RatedUser {
  id: number;
  full_name: string;
  profile_image?: string | null;
}

interface RatingData {
  conversation_id: number;
  rated_by: number;
  rated_user_id: number;
  product_id?: number;
  communication_rating: number;
  product_rating: number;
  app_help_rating: number;
  feedback?: string;
}

@Component({
  selector: 'app-rating-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rating-modal.component.html',
  styleUrl: './rating-modal.component.css'
})
export class RatingModalComponent implements OnInit {
  @Input() conversationId!: number;
  @Input() ratedUser!: RatedUser;
  @Input() productId?: number;
  @Input() productName?: string;
  @Output() modalClosed = new EventEmitter<void>();
  @Output() ratingSubmitted = new EventEmitter<any>();

  // Rating values
  communicationRating: number = 0;
  productRating: number = 0;
  appRating: number = 0;
  feedback: string = '';

  // Current user ID
  currentUserId: number = 0;

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.currentUserId = parseInt(localStorage.getItem('id') || '0');
  }

  /**
   * Set communication rating
   */
  setCommunicationRating(rating: number) {
    this.communicationRating = rating;
  }

  /**
   * Set product rating
   */
  setProductRating(rating: number) {
    this.productRating = rating;
  }

  /**
   * Set app rating
   */
  setAppRating(rating: number) {
    this.appRating = rating;
  }

  /**
   * Get rating text description
   */
  getRatingText(rating: number): string {
    switch (rating) {
      case 1: return 'Very Poor';
      case 2: return 'Poor';
      case 3: return 'Average';
      case 4: return 'Good';
      case 5: return 'Excellent';
      default: return 'Not Rated';
    }
  }

  /**
   * Check if form is valid
   */
  isFormValid(): boolean {
    return this.communicationRating > 0 && 
           this.productRating > 0 && 
           this.appRating > 0;
  }

  /**
   * Get user avatar URL
   */
  getUserAvatarUrl(profileImage: string | null | undefined, name: string): string {
    if (profileImage && profileImage.trim() !== '') {
      // If it's a full URL, return as is
      if (profileImage.startsWith('http')) {
        return profileImage;
      }
      // If it's a relative path, prepend the API base URL
      return this.apiService.baseUrl.replace('/api/', '/') + profileImage;
    }
    
    // Generate avatar using UI Avatars
    const colors = ['6BA3BE', '34D399', 'F59E0B', '8B5CF6', 'EF4444', '10B981'];
    const color = colors[name.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff`;
  }

  /**
   * Submit rating
   */
  submitRating() {
    if (!this.isFormValid()) {
      this.notificationService.showWarning('Incomplete Rating', 'Please rate all categories before submitting.');
      return;
    }

    const ratingData: RatingData = {
      conversation_id: this.conversationId,
      rated_by: this.currentUserId,
      rated_user_id: this.ratedUser.id,
      product_id: this.productId,
      communication_rating: this.communicationRating,
      product_rating: this.productRating,
      app_help_rating: this.appRating,
      feedback: this.feedback.trim() || undefined
    };

    console.log('Submitting rating:', ratingData);

    this.apiService.submitRating(ratingData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.notificationService.showSuccess(
            'Rating Submitted',
            `Thank you for rating ${this.ratedUser.full_name}!`
          );
          this.ratingSubmitted.emit(response.data);
          this.closeModal();
        } else {
          this.notificationService.showError(
            'Rating Failed',
            response.message || 'Failed to submit rating. Please try again.'
          );
        }
      },
      error: (error) => {
        console.error('Error submitting rating:', error);
        
        if (error.status === 409) {
          this.notificationService.showWarning(
            'Already Rated',
            'You have already rated this user for this transaction.'
          );
        } else if (error.status === 403) {
          this.notificationService.showError(
            'Permission Denied',
            'You do not have permission to rate this user.'
          );
        } else {
          this.notificationService.showError(
            'Rating Failed',
            'Unable to submit rating. Please check your connection and try again.'
          );
        }
      }
    });
  }

  /**
   * Close modal
   */
  closeModal() {
    this.modalClosed.emit();
  }
}
