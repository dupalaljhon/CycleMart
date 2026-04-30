import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../api/api.service';
import { environment } from '../../../environments/environment';

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
  transaction_date?: string;
  uploader_id: number;
  seller_name?: string;
  seller_email?: string;
  seller_phone?: string;
  seller_profile_image?: string;
  seller_street?: string;
  seller_barangay?: string;
  seller_city?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_profile_image?: string;
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
  boughtItems: SoldProduct[] = [];
  isLoading = false;
  private pendingLoads = 0;
  currentUserName = '';
  currentUserEmail = '';
  buyerInfoCache: { [productId: number]: any } = {};
  loadingBuyerInfo: { [productId: number]: boolean } = {};
  
  // Notification properties
  showSuccessModal = false;
  showErrorModal = false;
  showConfirmModal = false;
  successMessage = '';
  errorMessage = '';
  confirmMessage = '';
  isProcessing = false;
  pendingProduct: SoldProduct | null = null;

  constructor(private apiService: ApiService) {
    this.currentUserName = localStorage.getItem('full_name') || localStorage.getItem('name') || 'You';
    this.currentUserEmail = localStorage.getItem('email') || '';
  }

  ngOnInit() {
    if (this.userId && this.isVisible) {
      this.loadItems();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible'] && this.isVisible && this.userId) {
      this.loadItems();
    }
  }

  loadItems() {
    this.loadSoldItems();
    this.loadBoughtItems();
  }

  loadSoldItems() {
    if (!this.userId) {
      return;
    }

    this.startLoading();
    this.apiService.getProductsByUser(this.userId).subscribe({
      next: (response) => {
        this.finishLoading();
        if (response.status === 'success') {
          // Filter sold and traded items
          this.soldItems = response.data
            .filter((product: any) => product.sale_status === 'sold' || product.sale_status === 'traded')
            .map((product: any) => this.normalizeProduct(product));
            
            // Fetch buyer information for each sold item
            this.soldItems.forEach(item => {
              this.loadBuyerInfo(item.product_id);
            });
        } else {
          const noRecords = typeof response?.message === 'string' && response.message.toLowerCase().includes('no records found');
          if (noRecords) {
            this.soldItems = [];
            return;
          }
        }
      },
      error: (error) => {
        this.finishLoading();
        if (error?.status === 404) {
          this.soldItems = [];
          return;
        }
      }
    });
  }

  loadBoughtItems() {
    if (!this.userId) {
      return;
    }

    this.startLoading();
    this.apiService.getProductsBoughtByUser(this.userId).subscribe({
      next: (response) => {
        this.finishLoading();
        if (response.status === 'success' && Array.isArray(response.data)) {
          this.boughtItems = response.data.map((product: any) => this.normalizeProduct(product));
        } else {
          const noRecords = typeof response?.message === 'string' && response.message.toLowerCase().includes('no records found');
          if (noRecords) {
            this.boughtItems = [];
            return;
          }
          this.boughtItems = [];
        }
      },
      error: (error) => {
        this.finishLoading();
        if (error?.status === 404) {
          this.boughtItems = [];
          return;
        }
        this.boughtItems = [];
      }
    });
  }

  private startLoading() {
    this.pendingLoads += 1;
    this.isLoading = true;
  }

  private finishLoading() {
    this.pendingLoads = Math.max(0, this.pendingLoads - 1);
    this.isLoading = this.pendingLoads > 0;
  }

  private normalizeProduct(product: any): SoldProduct {
    let parsedImages: string[] = [];
    let parsedVideos: string[] = [];

    try {
      parsedImages = typeof product.product_images === 'string'
        ? JSON.parse(product.product_images)
        : (product.product_images || []);
    } catch {
      parsedImages = [];
    }

    try {
      parsedVideos = product.product_videos
        ? (typeof product.product_videos === 'string'
            ? JSON.parse(product.product_videos)
            : product.product_videos)
        : [];
    } catch {
      parsedVideos = [];
    }

    return {
      ...product,
      product_images: Array.isArray(parsedImages) ? parsedImages : [],
      product_videos: Array.isArray(parsedVideos) ? parsedVideos : []
    };
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('data:')) {
      return imagePath; // Base64 image
    }
    const cleanPath = imagePath.replace(/^\/?uploads[\/\\]/, '');
    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
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
    this.pendingProduct = product;
    this.confirmMessage = 'Are you sure you want to mark this item as available again? It will be visible to buyers in your active listings.';
    this.showConfirmModal = true;
  }

  confirmMarkAsAvailable() {
    if (!this.pendingProduct) return;
    
    const product = this.pendingProduct;
    this.showConfirmModal = false;
    
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
        this.pendingProduct = null;
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
        this.pendingProduct = null;
        this.showError('Failed to update item status. Please check your internet connection and try again.');
      }
    });
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
    this.showConfirmModal = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.confirmMessage = '';
    this.pendingProduct = null;
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
  }

  closeErrorModal() {
    this.showErrorModal = false;
  }

  closeConfirmModal() {
    this.showConfirmModal = false;
    this.pendingProduct = null;
  }

  /**
   * Load buyer information for a sold product
   */
  loadBuyerInfo(productId: number) {
    if (this.buyerInfoCache[productId] || this.loadingBuyerInfo[productId]) {
      return; // Already loaded or loading
    }

    this.loadingBuyerInfo[productId] = true;

    this.apiService.getProductBuyer(productId).subscribe({
      next: (response) => {
        this.loadingBuyerInfo[productId] = false;
        if (response.status === 'success' && response.data) {
          this.buyerInfoCache[productId] = response.data;
          // Update the sold item with buyer information
          const item = this.soldItems.find(p => p.product_id === productId);
          if (item) {
            item.buyer_name = response.data.buyer_name;
            item.buyer_email = response.data.buyer_email;
            item.buyer_phone = response.data.buyer_phone;
            item.buyer_profile_image = response.data.buyer_profile_image;
          }
        } else {
        }
      },
      error: (error) => {
        this.loadingBuyerInfo[productId] = false;
      }
    });
  }

  /**
   * Get buyer information for display
   */
  getBuyerInfo(productId: number): any {
    return this.buyerInfoCache[productId] || null;
  }

  /**
   * Check if buyer info is loading
   */
  isBuyerInfoLoading(productId: number): boolean {
    return this.loadingBuyerInfo[productId] || false;
  }

  /**
   * Get buyer avatar or generate initials
   */
  getBuyerAvatar(buyer: any): string {
    return this.normalizeProfileImageUrl(buyer?.buyer_profile_image || '', buyer?.buyer_name || 'Unknown Buyer');
  }

  /**
   * Generate avatar URL from name
   */
  private generateAvatarUrl(name: string): string {
    const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899'];
    const initials = name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&bold=true&size=128`;
  }

  /**
   * Handle image load error
   */
  onImageError(event: any, buyer: any) {
    // Fallback to generated avatar
    event.target.src = this.generateAvatarUrl(buyer?.buyer_name || 'Unknown Buyer');
  }

  getSellerAvatar(item: SoldProduct): string {
    return this.normalizeProfileImageUrl(item?.seller_profile_image || '', item?.seller_name || 'Unknown Seller');
  }

  onSellerImageError(event: any, item: SoldProduct) {
    event.target.src = this.generateAvatarUrl(item?.seller_name || 'Unknown Seller');
  }

  private normalizeProfileImageUrl(imagePath: string, name: string): string {
    if (!imagePath || !imagePath.trim()) {
      return this.generateAvatarUrl(name || 'User');
    }

    if (imagePath.startsWith('data:')) {
      return imagePath;
    }

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    const cleanPath = imagePath
      .replace(/^\/?api\/uploads[\/\\]/, '')
      .replace(/^\/?uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }
}

