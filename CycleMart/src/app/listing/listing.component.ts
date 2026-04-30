import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ListingModalComponent } from './listing-modal/listing-modal.component';
import { ListingEditModalComponent } from './listing-edit-modal/listing-edit-modal.component';
import { SoldItemsComponent } from './sold-items/sold-items.component';
import { ApiService } from '../api/api.service';
import { AccountStatusService } from '../services/account-status.service';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

interface ProductSpecification {
  spec_id?: number;
  spec_name: string;
  spec_value: string;
}

interface Product {
  product_id: number;
  product_name: string;
  brand_name?: 'giant' | 'trek' | 'specialized' | 'cannondale' | 'merida' | 'scott' | 'bianchi' | 'cervelo' | 'pinarello' | 'shimano' | 'sram' | 'campagnolo' | 'microshift' | 'fsa' | 'vision' | 'zipp' | 'dt swiss' | 'others' | 'no brand';
  custom_brand?: string;
  brand_display?: string;
  product_images: string[];
  product_videos?: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand new' | 'second hand';
  category: 'whole bike' | 'frame' | 'wheelset' | 'groupset' | 'drivetrain' | 'brakes' | 'tires' | 'saddle' | 'handlebar' | 'accessories' | 'others';
  quantity: number;
  status: 'active' | 'archived';
  sale_status: 'available' | 'sold' | 'reserved' | 'traded';
  approval_status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  uploader_id: number;
  specifications?: ProductSpecification[];
  isEditing?: boolean;
}

@Component({
  selector: 'app-listing',
  standalone: true,
  imports: [CommonModule, SidenavComponent, ListingModalComponent, ListingEditModalComponent, SoldItemsComponent, FormsModule],
  templateUrl: './listing.component.html',
  styleUrl: './listing.component.css'
})
export class ListingComponent implements OnInit, OnDestroy {
  listings: Product[] = [];
  isLoading = false;
  userId: number = 0;
  showAddModal = false;
  showEditModal = false;
  productToEdit: Product | null = null;
  showSoldItemsModal = false;
  currentImageIndex = 0;
  isDragOver = false;
  
  // Dropdown state for each product
  dropdownStates: { [key: number]: boolean } = {};
  
  // Notification properties
  showSuccessModal = false;
  showErrorModal = false;
  successMessage = '';
  errorMessage = '';
  isProcessing = false;
  
  // Status change modal properties
  showStatusChangeModal = false;
  statusChangeProduct: Product | null = null;
  pendingStatusChange: 'sold' | 'traded' | 'reserved' | 'available' | null = null;
  statusChangeMessage = '';
  
  // Delete confirmation modal properties
  showDeleteModal = false;
  productToDelete: Product | null = null;
  
  // Lightbox for image viewing
  showLightbox = false;
  lightboxImages: string[] = [];
  lightboxCurrentIndex = 0;
  lightboxProduct: Product | null = null;

  // Restriction modal properties
  showRestrictionModal = false;
  restrictionDetails: any = null;
  restrictionTimeLeft = '';
  private restrictionTimer: any = null;
  private restrictionSyncInterval: any = null;

  // Guidelines dropdown
  showGuidelines = false;
  expandedRules: { [key: number]: boolean } = {};
  
  guidelines = [
    {
      id: 1,
      title: 'Only Bicycle-Related Items',
      description: 'List only bicycles, bicycle parts, components, accessories, and cycling gear. Items must be relevant to cycling activities. We do not accept listings for motorcycles, scooters, e-bikes with throttle controls, or non-cycling related products.'
    },
    {
      id: 2,
      title: 'Provide Accurate Descriptions',
      description: 'Be honest and detailed about your item\'s condition, age, specifications, and any defects or damage. Include brand, model, size, and relevant technical details. Misleading information may result in listing removal and account restrictions.'
    },
    {
      id: 3,
      title: 'Use Clear, Original Photos',
      description: 'Upload your own high-quality photos showing the actual item from multiple angles. Stock images or photos from other sources are not allowed. Include close-ups of any damage, wear, or unique features.'
    },
    {
      id: 4,
      title: 'Set Fair & Realistic Prices',
      description: 'Price your items competitively based on condition, age, and market value. Overpricing or price manipulation tactics are discouraged. Consider the local market in Olongapo City when setting prices.'
    },
    {
      id: 5,
      title: 'No Prohibited or Illegal Items',
      description: 'Do not list stolen property, counterfeit goods, or items obtained through fraudulent means. All listings must comply with Philippine laws and regulations.'
    },
    {
      id: 6,
      title: 'Respond to Inquiries Promptly',
      description: 'Reply to messages and inquiries within 24-48 hours. Maintain professional communication with potential buyers. Ignoring messages repeatedly may affect your seller reputation.'
    },
    {
      id: 7,
      title: 'Complete Transactions Safely',
      description: 'Meet in public places for transactions. Avoid advance payments to unknown parties. Report suspicious activities to administrators. Your safety is our priority.'
    },
    {
      id: 8,
      title: 'No Spam or Duplicate Listings',
      description: 'Create only one listing per item. Do not repeatedly post the same item or flood the marketplace with similar listings. Quality over quantity is encouraged.'
    },
    {
      id: 9,
      title: 'Respect Location Restrictions',
      description: 'CycleMart primarily serves Olongapo City and nearby areas. Listings must be available for local pickup or delivery. International shipping items may be considered on a case-by-case basis.'
    },
    {
      id: 10,
      title: 'Update Listing Status',
      description: 'Mark your listing as sold, reserved, or delete it once the item is no longer available. Keeping listings current helps maintain marketplace accuracy and user trust.'
    }
  ];

  // Categories for dropdown
  categories = [
    { value: 'whole bike', label: 'Whole Bike' },
    { value: 'frame', label: 'Frame' },
    { value: 'wheelset', label: 'Wheelset' },
    { value: 'groupset', label: 'Groupset' },
    { value: 'drivetrain', label: 'Drivetrain' },
    { value: 'brakes', label: 'Brakes' },
    { value: 'saddle', label: 'Saddle' },
    { value: 'handlebar', label: 'Handlebar' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'others', label: 'Others' }
  ];

  // Brand options for dropdown
  brands = [
    { value: 'no brand', label: 'No Brand' },
    { value: 'giant', label: 'Giant' },
    { value: 'trek', label: 'Trek' },
    { value: 'specialized', label: 'Specialized' },
    { value: 'cannondale', label: 'Cannondale' },
    { value: 'merida', label: 'Merida' },
    { value: 'scott', label: 'Scott' },
    { value: 'bianchi', label: 'Bianchi' },
    { value: 'cervelo', label: 'CervÃ©lo' },
    { value: 'pinarello', label: 'Pinarello' },
    { value: 'shimano', label: 'Shimano' },
    { value: 'sram', label: 'SRAM' },
    { value: 'campagnolo', label: 'Campagnolo' },
    { value: 'microshift', label: 'MicroSHIFT' },
    { value: 'fsa', label: 'FSA' },
    { value: 'vision', label: 'Vision' },
    { value: 'zipp', label: 'Zipp' },
    { value: 'dt swiss', label: 'DT Swiss' },
    { value: 'others', label: 'Others' }
  ];

  constructor(
    private apiService: ApiService,
    public accountStatusService: AccountStatusService
  ) {
    // Get user ID from localStorage
    const storedId = localStorage.getItem('id');
    this.userId = storedId ? parseInt(storedId) : 0;
  }

  ngOnInit() {
    // Check for expired reservations first
    this.checkExpiredReservations();
    
    // Then load user products
    this.loadUserProducts();

    // Keep restriction state synchronized and auto-restore when expired.
    this.syncRestrictionStatus();
    this.restrictionSyncInterval = setInterval(() => this.syncRestrictionStatus(), 60000);
    
    // Add keyboard event listener for lightbox navigation
    document.addEventListener('keydown', (event) => this.onLightboxKeydown(event));
    
    // Add click listener to close dropdowns when clicking outside
    document.addEventListener('click', (event) => this.onDocumentClick(event));
  }

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('keydown', (event) => this.onLightboxKeydown(event));
    document.removeEventListener('click', (event) => this.onDocumentClick(event));

    if (this.restrictionSyncInterval) {
      clearInterval(this.restrictionSyncInterval);
    }
    this.stopRestrictionTimer();
    
    // Restore body scroll if component is destroyed while modals are open
    document.body.style.overflow = 'auto';
  }

  // Handle document clicks to close dropdowns
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.status-dropdown')) {
      this.closeAllDropdowns();
    }
  }

  loadUserProducts() {
    if (!this.userId) {
      return;
    }

    this.isLoading = true;
    this.apiService.getProductsByUser(this.userId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          // Filter out sold/traded items - only show available items
          const allProducts = response.data.map((product: any) => {
            // Format brand display
            const brand_display = this.formatBrandDisplay(product.brand_name, product.custom_brand);

            // Parse product images from JSON string
            let productImages: string[] = [];
            try {
              if (product.product_images) {
                productImages = typeof product.product_images === 'string' 
                  ? JSON.parse(product.product_images) 
                  : product.product_images;
              }
            } catch (e) {
              productImages = [];
            }

            // Parse product videos from JSON string
            let productVideos: string[] = [];
            try {
              if (product.product_videos) {
                productVideos = typeof product.product_videos === 'string' 
                  ? JSON.parse(product.product_videos) 
                  : product.product_videos;
                
                // Ensure it's an array and filter out any invalid entries
                if (Array.isArray(productVideos)) {
                  productVideos = productVideos.filter(video => 
                    typeof video === 'string' && video.trim().length > 0
                  );
                } else {
                  productVideos = [];
                }
              }
            } catch (e) {
              productVideos = [];
            }

            return {
              ...product,
              product_images: productImages,
              product_videos: productVideos,
              brand_name: product.brand_name || 'no brand',
              custom_brand: product.custom_brand || '',
              brand_display: brand_display,
              isEditing: false,
              pendingApproval: false
            };
          });
          
          // Only show products that are available or reserved (not sold/traded)
          this.listings = allProducts.filter((product: Product) => 
            product.sale_status === 'available' || product.sale_status === 'reserved'
          );
        }
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  addNewListing() {
    // Immediate UI guard: restricted/suspended/banned users should never open listing modal first.
    if (!this.accountStatusService.canPerformAction('list_product')) {
      this.restrictionDetails = this.restrictionDetails || this.getFallbackRestrictionDetails();
      this.showRestrictionModal = true;
      this.showAddModal = false;
      document.body.style.overflow = 'hidden';
      this.syncRestrictionStatus();
      return;
    }

    this.syncRestrictionStatus(true);
  }

  private syncRestrictionStatus(openListingOnAllowed: boolean = false) {
    if (!this.userId) {
      return;
    }

    this.apiService.checkUserRestriction(this.userId).subscribe({
      next: (response) => {
        const payload = response?.data ?? response;
        const hasExplicitRestrictionFlag = typeof payload?.is_restricted === 'boolean';
        const isRestricted = hasExplicitRestrictionFlag
          ? payload.is_restricted
          : this.accountStatusService.isRestricted();

        if (isRestricted) {
          this.accountStatusService.updateAccountStatus({
            account_status: 'restricted',
            violation_count: Number(payload?.violation_count ?? this.accountStatusService.getCurrentStatus().violation_count ?? 0)
          });

          this.restrictionDetails = payload?.is_restricted
            ? this.normalizeRestrictionDetails(payload)
            : this.getFallbackRestrictionDetails();
          this.startRestrictionTimer(this.restrictionDetails?.expires_at);

          if (openListingOnAllowed) {
            this.showRestrictionModal = true;
            this.showAddModal = false;
            document.body.style.overflow = 'hidden';
          }
        } else {
          this.stopRestrictionTimer();
          this.restrictionDetails = null;

          if (this.accountStatusService.getCurrentStatus().account_status === 'restricted') {
            this.accountStatusService.updateAccountStatus({
              account_status: 'active',
              violation_count: this.accountStatusService.getCurrentStatus().violation_count
            });
          }

          if (openListingOnAllowed) {
            this.showRestrictionModal = false;
            this.showAddModal = true;
            document.body.style.overflow = 'hidden';
          }
        }
      },
      error: () => {
        if (openListingOnAllowed) {
          // If status is already restricted locally, keep blocking listing creation.
          if (this.accountStatusService.isRestricted()) {
            this.restrictionDetails = this.getFallbackRestrictionDetails();
            this.showRestrictionModal = true;
            this.showAddModal = false;
          } else {
            this.showAddModal = true;
            this.showRestrictionModal = false;
          }
          document.body.style.overflow = 'hidden';
        }
      }
    });
  }

  private getFallbackRestrictionDetails() {
    const fallbackExpiry = new Date(Date.now() + (48 * 60 * 60 * 1000)).toISOString();
    return {
      is_restricted: true,
      reason: 'Your account is currently restricted from creating new listings. Please wait until the restriction period ends.',
      restriction_type: 'temporary_restriction',
      violation_count: this.accountStatusService.getCurrentStatus().violation_count,
      expires_at: fallbackExpiry,
      violation_code: 'other'
    };
  }

  private normalizeRestrictionDetails(details: any) {
    if (!details) {
      return details;
    }

    const normalized = { ...details };
    const restrictionType = String(normalized.restriction_type || '').toLowerCase();
    const isTemporary = restrictionType.includes('temporary') || restrictionType === 'listing_ban';

    if (!normalized.expires_at && isTemporary && normalized.starts_at) {
      const startsAtTime = new Date(normalized.starts_at).getTime();
      if (!Number.isNaN(startsAtTime)) {
        normalized.expires_at = new Date(startsAtTime + (48 * 60 * 60 * 1000)).toISOString();
      }
    }

    return normalized;
  }

  isPermanentRestriction(): boolean {
    const type = String(this.restrictionDetails?.restriction_type || '').toLowerCase();
    return type.includes('permanent') || type === 'banned';
  }

  closeRestrictionModal() {
    this.showRestrictionModal = false;
    document.body.style.overflow = 'auto';
  }

  private startRestrictionTimer(expiresAt?: string) {
    this.stopRestrictionTimer();

    if (!expiresAt) {
      this.restrictionTimeLeft = '';
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        this.restrictionTimeLeft = 'Expired';
        this.stopRestrictionTimer();
        this.syncRestrictionStatus();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      this.restrictionTimeLeft = `${hours}h ${minutes}m`;
    };

    updateTimer();
    this.restrictionTimer = setInterval(updateTimer, 60000);
  }

  private stopRestrictionTimer() {
    if (this.restrictionTimer) {
      clearInterval(this.restrictionTimer);
      this.restrictionTimer = null;
    }
    this.restrictionTimeLeft = '';
  }

  getRestrictionWaitMessage(): string {
    if (this.restrictionDetails?.expires_at) {
      return 'Please wait until your restriction period ends before adding a new listing.';
    }

    if (this.restrictionDetails?.restriction_type === 'listing_ban') {
      return 'Please wait for 48 hours before using this feature again.';
    }

    return 'Please wait for admin review before using this feature again.';
  }

  getViolationTypeLabel(code: string): string {
    const labels: { [key: string]: string } = {
      'not_bike_related': 'Not Bicycle Related',
      'prohibited_item': 'Prohibited Item',
      'spam': 'Spam/Duplicates',
      'fraud': 'Fraudulent Content',
      'inappropriate_content': 'Inappropriate Content',
      'misleading_info': 'Misleading Information',
      'price_manipulation': 'Price Manipulation',
      'other': 'Policy Violation'
    };
    return labels[code] || 'Policy Violation';
  }

  closeAddModal() {
    this.showAddModal = false;
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  openSoldItemsModal() {
    this.showSoldItemsModal = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeSoldItemsModal() {
    this.showSoldItemsModal = false;
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  onProductAdded() {
    // Reload products when a new product is added
    this.loadUserProducts();
  }

  editListing(product: Product) {
    // Process video data before passing to modal
    let processedProduct = { ...product };
    
    if (product.product_videos) {
      try {
        let videoData = product.product_videos;
        
        // Parse if it's a string
        if (typeof videoData === 'string') {
          videoData = JSON.parse(videoData);
        }
        
        // Ensure it's an array and clean it
        if (Array.isArray(videoData)) {
          const cleanedVideos = [...new Set(videoData)]  // Remove duplicates
            .filter(video => 
              typeof video === 'string' && 
              video.trim().length > 0 &&
              !video.includes('undefined') &&
              !video.includes('null')
            )
            .slice(0, 3); // Limit to max 3 videos
          
          processedProduct.product_videos = cleanedVideos;
        } else {
          processedProduct.product_videos = [];
        }
      } catch (e) {
        processedProduct.product_videos = [];
      }
    } else {
      processedProduct.product_videos = [];
    }
    
    this.productToEdit = processedProduct;
    this.showEditModal = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeEditModal() {
    this.showEditModal = false;
    this.productToEdit = null;
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  onProductUpdated() {
    // Reload products when a product is updated
    this.loadUserProducts();
  }

  deleteListing(product: Product) {
    this.productToDelete = product;
    this.showDeleteModal = true;
    document.body.style.overflow = 'hidden';
  }

  // Confirm deletion
  confirmDeletion() {
    if (!this.productToDelete) return;
    
    const product = this.productToDelete;
    this.closeDeleteModal();
    
    this.isProcessing = true;
    this.apiService.deleteProduct(product.product_id, this.userId).subscribe({
      next: (response) => {
        this.isProcessing = false;
        if (response.status === 'success') {
          this.showSuccess('Product deleted successfully! Your listing has been removed from the marketplace.');
          this.loadUserProducts(); // Reload the list
        } else {
          this.showError('Failed to delete product: ' + (response.message || 'Unknown error occurred'));
        }
      },
      error: (error) => {
        this.isProcessing = false;
        this.showError('Failed to delete product. Please check your internet connection and try again.');
      }
    });
  }

  // Cancel deletion
  closeDeleteModal() {
    this.showDeleteModal = false;
    this.productToDelete = null;
    document.body.style.overflow = 'auto';
  }

  // Mark product with specific status
  markProductStatus(product: Product, newStatus: 'sold' | 'traded' | 'reserved' | 'available') {
    // Close dropdown first
    this.dropdownStates[product.product_id] = false;
    
    // Set up the confirmation modal
    this.statusChangeProduct = product;
    this.pendingStatusChange = newStatus;
    
    switch (newStatus) {
      case 'sold':
        this.statusChangeMessage = `Are you sure you want to mark "${product.product_name}" as sold? This will remove it from active listings and move it to your sold items.`;
        break;
      case 'traded':
        this.statusChangeMessage = `Are you sure you want to mark "${product.product_name}" as traded? This will remove it from active listings and move it to your sold items.`;
        break;
      case 'reserved':
        this.statusChangeMessage = `Are you sure you want to reserve "${product.product_name}"? This will mark it as reserved for a potential buyer.`;
        break;
      case 'available':
        this.statusChangeMessage = `Are you sure you want to mark "${product.product_name}" as available again? This will make it visible to all buyers.`;
        break;
    }
    
    this.showStatusChangeModal = true;
    document.body.style.overflow = 'hidden';
  }

  // Confirm status change
  confirmStatusChange() {
    if (!this.statusChangeProduct || !this.pendingStatusChange) return;
    
    const product = this.statusChangeProduct;
    const newStatus = this.pendingStatusChange;
    
    const updateData = {
      product_id: product.product_id,
      sale_status: newStatus,
      uploader_id: this.userId,
      seller_id: this.userId,
      for_type: product.for_type
    };

    this.isProcessing = true;
    this.closeStatusChangeModal();
    
    this.apiService.updateSaleStatus(updateData).subscribe({
      next: (response) => {
        this.isProcessing = false;
        if (response.status === 'success') {
          product.sale_status = newStatus as 'available' | 'sold' | 'reserved' | 'traded';
          
          let successText = '';
          switch (newStatus) {
            case 'sold':
              successText = 'Product marked as sold! Your item has been successfully sold.';
              break;
            case 'traded':
              successText = 'Product marked as traded! Your item has been successfully traded.';
              break;
            case 'reserved':
              successText = 'Item reserved! Your product is now marked as reserved for a potential buyer.';
              break;
            case 'available':
              successText = 'Product marked as available! Your item is now back in active listings.';
              break;
          }
          
          this.showSuccess(successText);
          
          // If item is marked as sold/traded, remove it from the listings array
          if (newStatus === 'sold' || newStatus === 'traded') {
            const index = this.listings.findIndex(item => item.product_id === product.product_id);
            if (index !== -1) {
              this.listings.splice(index, 1);
            }
          }
          
          // Log the status change
        } else {
          this.showError('Failed to update product status: ' + (response.message || 'Unknown error occurred'));
        }
      },
      error: (error) => {
        this.isProcessing = false;
        this.showError('Failed to update product status. Please check your internet connection and try again.');
      }
    });
  }

  // Cancel status change
  closeStatusChangeModal() {
    this.showStatusChangeModal = false;
    this.statusChangeProduct = null;
    this.pendingStatusChange = null;
    this.statusChangeMessage = '';
    document.body.style.overflow = 'auto';
  }

  // Toggle dropdown for a specific product
  toggleDropdown(productId: number, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    
    // Close all other dropdowns
    Object.keys(this.dropdownStates).forEach(key => {
      if (parseInt(key) !== productId) {
        this.dropdownStates[parseInt(key)] = false;
      }
    });
    
    // Toggle current dropdown
    this.dropdownStates[productId] = !this.dropdownStates[productId];
  }

  // Close all dropdowns (useful for click outside)
  closeAllDropdowns() {
    Object.keys(this.dropdownStates).forEach(key => {
      this.dropdownStates[parseInt(key)] = false;
    });
  }

  // Check if dropdown is open for specific product
  isDropdownOpen(productId: number): boolean {
    const isOpen = !!this.dropdownStates[productId];
    return isOpen;
  }

  // Lightbox methods
  openLightbox(product: Product, imageIndex: number = 0) {
    this.lightboxProduct = product;
    this.lightboxImages = product.product_images || [];
    this.lightboxCurrentIndex = imageIndex;
    this.showLightbox = true;
    
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    this.showLightbox = false;
    this.lightboxProduct = null;
    this.lightboxImages = [];
    this.lightboxCurrentIndex = 0;
    
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  nextLightboxImage() {
    if (this.lightboxImages.length > 1) {
      this.lightboxCurrentIndex = (this.lightboxCurrentIndex + 1) % this.lightboxImages.length;
    }
  }

  prevLightboxImage() {
    if (this.lightboxImages.length > 1) {
      this.lightboxCurrentIndex = this.lightboxCurrentIndex === 0 
        ? this.lightboxImages.length - 1 
        : this.lightboxCurrentIndex - 1;
    }
  }

  goToLightboxImage(index: number) {
    this.lightboxCurrentIndex = index;
  }

  // Keyboard navigation for lightbox
  onLightboxKeydown(event: KeyboardEvent) {
    if (!this.showLightbox) return;
    
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.prevLightboxImage();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextLightboxImage();
        break;
      case 'Escape':
        event.preventDefault();
        this.closeLightbox();
        break;
    }
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }

    if (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    let cleanPath = imagePath.replace(/^\/+/, '');
    cleanPath = cleanPath.replace(/^api\//, '');
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/^api[\/\\]uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  getVideoUrl(videoPath: string): string {
    if (!videoPath) {
      return '';
    }
    
    // Check if it's already a complete URL or base64
    if (videoPath.startsWith('http://') || videoPath.startsWith('https://') || videoPath.startsWith('data:')) {
      return videoPath;
    }
    
    let cleanPath = videoPath.replace(/^\/+/, '');
    cleanPath = cleanPath.replace(/^api\//, '');
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/^api[\/\\]uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanPath}`;

  }

  removeImage(index: number, product: Product) {
    product.product_images.splice(index, 1);
  }

  formatBrandDisplay(brandName?: string, customBrand?: string): string {
    if (!brandName || brandName === 'no brand') {
      return 'No Brand';
    }
    
    if (brandName === 'others' && customBrand) {
      return customBrand;
    }
    
    // Format brand name for display (capitalize first letter)
    return brandName.charAt(0).toUpperCase() + brandName.slice(1);
  }

  // Format specification names: replace underscores with spaces and capitalize
  formatSpecName(specName: string): string {
    if (!specName) return '';
    return specName
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  toggleGuidelines() {
    this.showGuidelines = !this.showGuidelines;
  }

  toggleRule(ruleId: number) {
    this.expandedRules[ruleId] = !this.expandedRules[ruleId];
  }

  isRuleExpanded(ruleId: number): boolean {
    return this.expandedRules[ruleId] || false;
  }

  getBrandDisplayClass(brandName?: string): string {
    if (!brandName || brandName === 'no brand') {
      return 'bg-gray-100 text-gray-600';
    }
    
    if (brandName === 'others') {
      return 'bg-purple-100 text-purple-700';
    }
    
    // Major brands get special styling
    const majorBrands = ['giant', 'trek', 'specialized', 'cannondale', 'scott', 'bianchi'];
    if (majorBrands.includes(brandName)) {
      return 'bg-blue-100 text-blue-700';
    }
    
    return 'bg-green-100 text-green-700';
  }

  private validateProduct(product: Partial<Product>): boolean {
    // Check if brand is "others" and custom brand is required
    const brandValid = product.brand_name !== 'others' || (product.brand_name === 'others' && product.custom_brand && product.custom_brand.trim().length > 0);
    
    return !!(
      product.product_name &&
      product.brand_name &&
      brandValid &&
      product.price &&
      product.description &&
      product.location &&
      product.for_type &&
      product.condition &&
      product.category &&
      product.quantity && product.quantity > 0
    );
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

  /**
   * ================================================================================================
   * RESERVATION SYSTEM METHODS
   * ================================================================================================
   */

  /**
   * Check for expired reservations when component loads
   * This ensures reservations are automatically released when they expire
   */
  checkExpiredReservations() {
    this.apiService.checkExpiredReservations().subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data.expired_count > 0) {
          // Reload products to reflect updated statuses
          this.loadUserProducts();
        }
      },
      error: (error) => {
      }
    });
  }

  /**
   * Get reservation status badge class
   */
  getReservationBadgeClass(product: Product): string {
    if (product.sale_status === 'reserved') {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    }
    return '';
  }

  /**
   * Format reservation time remaining
   */
  formatReservationTime(reservedUntil: string): string {
    const until = new Date(reservedUntil);
    const now = new Date();
    const diff = until.getTime() - now.getTime();
    
    if (diff <= 0) {
      return 'Expired';
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }
}
