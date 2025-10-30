import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../api/api.service';

interface SoldProduct {
  product_id: number;
  product_name: string;
  product_images: string[];
  product_videos?: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand_new' | 'second_hand';
  category: string;
  quantity: number;
  status: 'active' | 'archived';
  sale_status: 'sold' | 'traded';
  created_at: string;
  uploader_id: number;
}

@Component({
  selector: 'app-sold-items',
  imports: [CommonModule],
  templateUrl: './sold-items.component.html',
  styleUrl: './sold-items.component.css'
})
export class SoldItemsComponent implements OnInit, OnChanges {
  @Input() userId: number = 0;
  @Input() isVisible: boolean = false;

  soldItems: SoldProduct[] = [];
  isLoading = false;
  
  // Notification properties
  showSuccessModal = false;
  showErrorModal = false;
  successMessage = '';
  errorMessage = '';
  isProcessing = false;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    if (this.userId && this.isVisible) {
      this.loadSoldItems();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible'] && this.isVisible && this.userId) {
      this.loadSoldItems();
    }
  }

  loadSoldItems() {
    if (!this.userId) {
      console.error('No user ID provided');
      return;
    }

    this.isLoading = true;
    this.apiService.getProductsByUser(this.userId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          // Filter sold and traded items
          this.soldItems = response.data
            .filter((product: any) => product.sale_status === 'sold' || product.sale_status === 'traded')
            .map((product: any) => ({
              ...product,
              product_images: typeof product.product_images === 'string' 
                ? JSON.parse(product.product_images) 
                : product.product_images,
              product_videos: product.product_videos 
                ? (typeof product.product_videos === 'string' 
                    ? JSON.parse(product.product_videos) 
                    : product.product_videos)
                : []
            }));
        } else {
          console.error('Failed to load sold items:', response.message);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading sold items:', error);
      }
    });
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('data:')) {
      return imagePath; // Base64 image
    }
    return `${this.apiService.baseUrl}${imagePath}`;
  }

  getSaleTypeText(forType: string): string {
    switch (forType) {
      case 'sale':
        return 'Sold';
      case 'trade':
        return 'Traded';
      case 'both':
        return 'Sold/Traded';
      default:
        return 'Sold';
    }
  }

  markAsAvailable(product: SoldProduct) {
    if (confirm('Mark this item as available again?')) {
      const updateData = {
        product_id: product.product_id,
        sale_status: 'available',
        uploader_id: this.userId,
        for_type: product.for_type
      };

      this.isProcessing = true;
      this.apiService.updateSaleStatus(updateData).subscribe({
        next: (response) => {
          this.isProcessing = false;
          if (response.status === 'success') {
            // Remove from sold items list
            this.soldItems = this.soldItems.filter(item => item.product_id !== product.product_id);
            this.showSuccess('Item marked as available again! Your product is now back in the active listings and visible to buyers.');
          } else {
            this.showError('Failed to update item status: ' + (response.message || 'Unknown error occurred'));
          }
        },
        error: (error) => {
          this.isProcessing = false;
          console.error('Error updating item status:', error);
          this.showError('Failed to update item status. Please check your internet connection and try again.');
        }
      });
    }
  }

  // Notification Methods
  showSuccess(message: string) {
    this.successMessage = message;
    this.showSuccessModal = true;
    this.showErrorModal = false;
  }

  showError(message: string) {
    this.errorMessage = message;
    this.showErrorModal = true;
    this.showSuccessModal = false;
  }

  resetNotifications() {
    this.showSuccessModal = false;
    this.showErrorModal = false;
    this.successMessage = '';
    this.errorMessage = '';
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
  }

  closeErrorModal() {
    this.showErrorModal = false;
  }
}
