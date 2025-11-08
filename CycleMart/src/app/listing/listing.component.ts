import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ListingModalComponent } from './listing-modal/listing-modal.component';
import { ListingEditModalComponent } from './listing-edit-modal/listing-edit-modal.component';
import { SoldItemsComponent } from './sold-items/sold-items.component';
import { ApiService } from '../api/api.service';
import { FormsModule } from '@angular/forms';

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
    { value: 'cervelo', label: 'Cervélo' },
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

  constructor(private apiService: ApiService) {
    // Get user ID from localStorage
    const storedId = localStorage.getItem('id');
    this.userId = storedId ? parseInt(storedId) : 0;
  }

  ngOnInit() {
    this.loadUserProducts();
    
    // Add keyboard event listener for lightbox navigation
    document.addEventListener('keydown', (event) => this.onLightboxKeydown(event));
    
    // Add click listener to close dropdowns when clicking outside
    document.addEventListener('click', (event) => this.onDocumentClick(event));
  }

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('keydown', (event) => this.onLightboxKeydown(event));
    document.removeEventListener('click', (event) => this.onDocumentClick(event));
    
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
      console.error('No user ID found');
      return;
    }

    this.isLoading = true;
    this.apiService.getProductsByUser(this.userId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          console.log('=== API Response Data ===');
          console.log('Raw response data:', response.data);
          
          // Filter out sold/traded items - only show available items
          const allProducts = response.data.map((product: any) => {
            console.log('Processing product:', product.product_name);
            console.log('Raw product_images:', product.product_images);
            console.log('Raw product_videos:', product.product_videos);
            
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
              console.warn('Failed to parse product images:', product.product_images);
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
              console.warn('Failed to parse product videos:', product.product_videos);
              productVideos = [];
            }

            console.log('Parsed product_images:', productImages);
            console.log('Parsed product_videos:', productVideos);

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
        } else {
          console.error('Failed to load products:', response.message);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading products:', error);
      }
    });
  }

  addNewListing() {
    this.showAddModal = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
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
    console.log('🎯 EditListing - Raw Product:', JSON.stringify(product, null, 2));
    console.log('🎥 EditListing - Raw product_videos:', product.product_videos);
    console.log('🎥 EditListing - Type of product_videos:', typeof product.product_videos);
    
    // Process video data before passing to modal
    let processedProduct = { ...product };
    
    if (product.product_videos) {
      try {
        let videoData = product.product_videos;
        
        // Parse if it's a string
        if (typeof videoData === 'string') {
          videoData = JSON.parse(videoData);
          console.log('🔄 EditListing - Parsed video data:', videoData);
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
          console.log('✅ EditListing - Cleaned videos:', cleanedVideos);
        } else {
          processedProduct.product_videos = [];
          console.log('⚠️ EditListing - Video data is not an array, setting to empty');
        }
      } catch (e) {
        console.error('❌ EditListing - Error processing videos:', e);
        processedProduct.product_videos = [];
      }
    } else {
      processedProduct.product_videos = [];
      console.log('ℹ️ EditListing - No videos found');
    }
    
    console.log('📤 EditListing - Final processed product:', processedProduct);
    
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
        console.error('Error deleting product:', error);
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
          console.log('Product status updated:', {
            product_id: product.product_id,
            product_name: product.product_name,
            new_status: newStatus,
            for_type: product.for_type,
            timestamp: new Date().toISOString(),
            user_id: this.userId
          });
        } else {
          this.showError('Failed to update product status: ' + (response.message || 'Unknown error occurred'));
        }
      },
      error: (error) => {
        this.isProcessing = false;
        console.error('Error updating product status:', error);
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
    console.log('toggleDropdown called for product:', productId);
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
    console.log('Dropdown state for product', productId, ':', this.dropdownStates[productId]);
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
    console.log('isDropdownOpen for product', productId, ':', isOpen);
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
    if (imagePath.startsWith('data:')) {
      return imagePath; // Base64 image
    }
    return `${this.apiService.baseUrl}${imagePath}`;
  }

  getVideoUrl(videoPath: string): string {
    if (videoPath.startsWith('data:')) {
      return videoPath; // Base64 video
    }
    return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/${videoPath}`;
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
}
