import { Component, OnInit, HostListener } from '@angular/core';
import { SidenavComponent } from "../sidenav/sidenav.component";
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api/api.service';
import { ApplyModeratorComponent } from '../user-dashboard/apply-moderator/apply-moderator.component';
import { environment } from '../../environments/environment';

import { NotificationService } from '../services/notification.service';
import { AccountStatusService } from '../services/account-status.service';
import { ReportsComponent } from '../reports/reports.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, SidenavComponent, ReportsComponent, ApplyModeratorComponent], // âœ… Only standalone pieces
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {

  // Loading and error states
  loading: boolean = false;
  error: string | null = null;
  items: any[] = [];
  filteredItems: any[] = [];
  searchQuery: string = '';
  
  // Sorting state
  currentSortOption: string = 'featured';

  // Modal state
  showModal: boolean = false;
  selectedProduct: any = null;
  currentImageIndex: number = 0;
  showImageZoomModal: boolean = false;
  zoomImageUrl: string = '';
  zoomImageAlt: string = '';

  // Video state
  currentVideoIndex: number = 0;
  showVideoModal: boolean = false;
  currentMediaType: 'image' | 'video' = 'image';

  // Report modal state
  showReportModal: boolean = false;
  reportTargetProduct: any = null;

  // Mobile-only image zoom state (use Angular-controlled overlay to avoid router/hash issues)
  mobileZoomId: number | null = null;
  // Whether the viewport is considered mobile (matches md breakpoint)
  isMobileDisplay: boolean = window.innerWidth < 768;
  // Optional override controlled by other UI/toggles. If set to 'web', mobile features hidden.
  viewMode: 'mobile' | 'web' | null = null;
  // Modal image zoom state
  showModalImageZoom: boolean = false;
  modalZoomedImageUrl: string = '';
  modalZoomedImageAlt: string = '';

  // Alert modal state
  showAlertModal: boolean = false;
  alertModalData: any = {
    title: '',
    message: '',
    type: 'info',
    primaryButtonText: 'OK',
    secondaryButtonText: 'Cancel',
    showSecondaryButton: false
  };
  private alertModalCallback: (() => void) | null = null;

  // Tooltip state
  activeTooltip: string | null = null;

  // Profile modal state
  showProfileModal: boolean = false;
  selectedSellerProfile: any = null;
  profileModalActiveTab: 'reviews' | 'listings' = 'reviews';
  sellerOtherListings: any[] = [];
  loadingOtherListings: boolean = false;

  // Reviews modal state
  showReviewsModal: boolean = false;
  selectedSellerForReviews: any = null;
  sellerReviews: any[] = [];
  loadingReviews: boolean = false;

  // Floating moderator card state (not persisted; returns on page refresh)
  showModeratorBanner: boolean = true;
  showApplyModeratorModal: boolean = false;

  // Rules reminder modal state
  showRulesReminderModal: boolean = false;

  constructor(
    public apiService: ApiService,
    private router: Router,
    private notificationService: NotificationService,
    public accountStatusService: AccountStatusService
  ) {}

  // Navigate to moderator application page
  navigateToModeratorApplication() {
    this.openModeratorApplicationModal();
  }

  openModeratorApplicationModal() {
    this.showApplyModeratorModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeModeratorApplicationModal() {
    this.showApplyModeratorModal = false;
    document.body.style.overflow = 'auto';
  }

  dismissModeratorBanner(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.showModeratorBanner = false;
  }

  ngOnInit() {
    this.openRulesReminderModal();
    this.loadActiveProducts();
    this.updateMobileState();
  }

  @HostListener('window:resize')
  onResize() {
    this.updateMobileState();
  }

  @HostListener('window:storage', ['$event'])
  onStorageEvent(event: StorageEvent) {
    if (event.key === 'viewMode') {
      this.updateMobileState();
    }
  }

  private updateMobileState() {
    this.isMobileDisplay = window.innerWidth < 768;
    const vm = localStorage.getItem('viewMode');
    if (vm === 'web') {
      this.viewMode = 'web';
    } else if (vm === 'mobile') {
      this.viewMode = 'mobile';
    } else {
      this.viewMode = null;
    }
    console.log('updateMobileState:', { windowWidth: window.innerWidth, isMobileDisplay: this.isMobileDisplay, viewMode: this.viewMode });
  }

  getCurrentUserId(): number {
    return Number(localStorage.getItem('id') || 0);
  }

  isOwnedByCurrentUser(product: any): boolean {
    if (!product) return false;

    const currentUserId = this.getCurrentUserId();
    const ownerId = Number(product.uploader_id || product.seller_id || 0);

    return !!currentUserId && !!ownerId && currentUserId === ownerId;
  }

  openRulesReminderModal() {
    this.showRulesReminderModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeRulesReminderModal() {
    this.showRulesReminderModal = false;
    document.body.style.overflow = 'auto';
  }

  loadActiveProducts() {
    this.loading = true;
    this.error = null;
    
    this.apiService.getAllActiveProducts().subscribe({
      next: (response) => {
        
        // Check if response has data
        if (response && response.data && Array.isArray(response.data)) {
          this.items = response.data.map((product: any) => {
            // Parse product images from JSON string or use array as-is
            let productImages: string[] = [];
            try {
              if (Array.isArray(product.product_images)) {
                productImages = product.product_images;
              } else if (typeof product.product_images === 'string' && product.product_images) {
                productImages = JSON.parse(product.product_images);
              }
            } catch {
              productImages = [];
            }

            // Parse product videos from JSON string or use array as-is
            let productVideos: string[] = [];
            try {
              if (Array.isArray(product.product_videos)) {
                productVideos = product.product_videos;
              } else if (typeof product.product_videos === 'string' && product.product_videos) {
                productVideos = JSON.parse(product.product_videos);
              }
            } catch {
              productVideos = [];
            }

            const imageUrl = productImages.length > 0 
              ? this.getImageUrl(productImages[0]) 
              : 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
            

            return {
              id: product.product_id,
              original_id: product.product_id, // Add for tracking
              image: imageUrl,
              productImages: productImages, // Store the full images array for modal
              productVideos: productVideos, // Store the full videos array for modal
              product_name: product.product_name,
              brand_name: product.brand_name || 'no brand',
              custom_brand: product.custom_brand || '',
              brand_display: this.formatBrandDisplay(product.brand_name, product.custom_brand),
              part_display: product.bicycle_part_name || product.part_name || '',
              price: parseFloat(product.price),
              saleType: this.formatSaleType(product.for_type),
              category: this.formatCategory(product.category),
              seller: product.seller_name || 'Unknown Seller',
              seller_profile_image: product.seller_profile_image || null, // Add profile image
              uploader_id: product.uploader_id, // Add uploader ID for profile image path
              location: product.location,
              rating: 0, // Will be loaded separately
              totalRatings: 0, // Will be loaded separately
              description: product.description,
              condition: product.condition,
              quantity: product.quantity,
              sale_status: product.sale_status,
              status: product.status,
              created_at: product.created_at || new Date().toISOString(), // Add created date for sorting
              featured_score: Math.random() * 100, // Random score for featured scoring
              specifications: product.specifications || [] // Include specifications from backend
            };
          });
          this.filteredItems = [...this.items]; // Initialize filtered items
          
          // Load ratings for all sellers
          this.loadSellerRatings();
          
          this.applySorting(); // Apply default sorting
        } else {
          this.error = 'No products found or invalid response format';
        }
        this.loading = false;
      },
      error: (error) => {
        this.error = `Failed to load products: ${error.message || error.statusText || 'Unknown error'}`;
        this.loading = false;
      }
    });
  }

  loadSellerRatings() {
    // Get unique seller IDs
    const sellerIds = [...new Set(this.items.map(item => item.uploader_id))];
    
    // Load ratings for each seller
    sellerIds.forEach(sellerId => {
      if (sellerId) {
        this.apiService.getUserAverageRatings(sellerId).subscribe({
          next: (response) => {
            
            if (response.status === 'success' && response.data && response.data.length > 0) {
              const ratingData = response.data[0];
              // Fix: Use 'average_stars' from API response instead of 'average_rating'
              const averageRating = parseFloat(ratingData.average_stars) || 0;
              const totalRatings = parseInt(ratingData.total_ratings) || 0;
              
              // Update all items for this seller
              this.items.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = averageRating;
                  item.totalRatings = totalRatings;
                }
              });
              
              // Update filtered items as well
              this.filteredItems.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = averageRating;
                  item.totalRatings = totalRatings;
                }
              });
              
            } else {
              // No ratings found, set to 0 or "No ratings"
              this.items.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = 0;
                  item.totalRatings = 0;
                }
              });
              
              this.filteredItems.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = 0;
                  item.totalRatings = 0;
                }
              });
              
            }
          },
          error: (error) => {
            // Set rating to 0 on error
            this.items.forEach(item => {
              if (item.uploader_id === sellerId) {
                item.rating = 0;
                item.totalRatings = 0;
              }
            });
            
            this.filteredItems.forEach(item => {
              if (item.uploader_id === sellerId) {
                item.rating = 0;
                item.totalRatings = 0;
              }
            });
          }
        });
      }
    });
  }

  getImageUrl(imageName: string): string {
    if (!imageName) {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }

    if (imageName.startsWith('data:') || imageName.startsWith('http://') || imageName.startsWith('https://')) {
      return imageName;
    }

    let cleanImageName = imageName.replace(/^\/+/, '');
    cleanImageName = cleanImageName.replace(/^api\//, '');
    cleanImageName = cleanImageName.replace(/^uploads[\/\\]/, '');
    cleanImageName = cleanImageName.replace(/^api[\/\\]uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanImageName}`;
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

  getProfileImageUrl(profileImage: string | null, username?: string): string {
    if (!profileImage || profileImage.trim() === '') {
      return this.generateAvatarUrl(username || 'User');
    }

    // Handle base64 images (actual uploaded images)
    if (profileImage.startsWith('data:')) {
      return profileImage;
    }

    // If it's already a full URL, return as is
    if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
      return profileImage;
    }

    // Remove any extra path prefixes from the image name
    const cleanImageName = profileImage.replace(/^\/?(api\/)?uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanImageName}`;
  }

  private generateAvatarUrl(name: string): string {
    const colors = ['6BA3BE', '34D399', 'F59E0B', '8B5CF6', 'EF4444', '10B981'];
    const color = colors[name.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff`;
  }

  formatSaleType(forType: string): string {
    switch(forType) {
      case 'sale': return 'For Sale';
      case 'trade': return 'For Trade';
      case 'both': return 'For Sale or Trade';
      default: return 'Available';
    }
  }

  getSaleTypeBadgeClass(saleType: string): string {
    return 'cm-tag-unified-strong';
  }

  formatCategory(category: string): string {
    switch(category) {
      case 'whole_bike': return 'Complete Bike';
      case 'bike parts': return 'Bike Parts';
      case 'accessories': return 'Accessories';
      default: return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
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
      return 'bg-gray-300 text-gray-800';
    }
    
    // Major brands get special styling
    const majorBrands = ['giant', 'trek', 'specialized', 'cannondale', 'scott', 'bianchi'];
    if (majorBrands.includes(brandName)) {
      return 'bg-black text-white';
    }
    
    return 'bg-gray-200 text-gray-700';
  }

  onImageError(event: any, item: any) {
    // Set a fallback image
    event.target.src = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
  }

  onImageLoad(event: any, item: any) {
  }

  // Search functionality
  performSearch() {
    if (!this.searchQuery.trim()) {
      this.filteredItems = [...this.items];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredItems = this.items.filter(item => {
        return (
          item.product_name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.seller.toLowerCase().includes(query) ||
          item.location.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.saleType.toLowerCase().includes(query) ||
          item.condition.toLowerCase().includes(query) ||
          item.brand_display.toLowerCase().includes(query) ||
          (item.brand_name && item.brand_name.toLowerCase().includes(query)) ||
          (item.custom_brand && item.custom_brand.toLowerCase().includes(query))
        );
      });
    }

    // Apply current sorting after filtering
    // this.applySorting();
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredItems = [...this.items];
    this.applySorting(); // Reapply sorting after clearing search
  }

  onSearchInputChange() {
    // Optional: Real-time search as user types (with debounce if needed)
    this.performSearch();
  }

  quickSearch(query: string) {
    this.searchQuery = query;
    this.performSearch();
  }

  // Handle mobile dropdown filter change
  onMobileFilterChange(event: any) {
    const selectedValue = event.target.value;
    if (selectedValue) {
      this.quickSearch(selectedValue);
      // Reset the dropdown to placeholder after selection
      event.target.value = '';
    }
  }

  // Sorting functionality
  onSortChange(event: any) {
    this.currentSortOption = event.target.value;
    this.applySorting();
  }

  applySorting() {
    const startTime = performance.now();
    
    switch (this.currentSortOption) {
      case 'featured':
        this.sortByFeatured();
        break;
      case 'price-low-high':
        this.sortByPriceLowToHigh();
        break;
      case 'price-high-low':
        this.sortByPriceHighToLow();
        break;
      case 'newest':
        this.sortByNewest();
        break;
      case 'oldest':
        this.sortByOldest();
        break;
      case 'name-a-z':
        this.sortByNameAToZ();
        break;
      case 'name-z-a':
        this.sortByNameZToA();
        break;
      case 'brand-a-z':
        this.sortByBrandAToZ();
        break;
      case 'rating':
        this.sortByRating();
        break;
      default:
        this.sortByFeatured();
    }
    
    const endTime = performance.now();
  }

  getSortDisplayName(): string {
    const sortOptions: { [key: string]: string } = {
      'featured': 'Featured',
      'price-low-high': 'Price: Low to High',
      'price-high-low': 'Price: High to Low',
      'newest': 'Newest First',
      'oldest': 'Oldest First',
      'name-a-z': 'Name: A to Z',
      'name-z-a': 'Name: Z to A',
      'brand-a-z': 'Brand: A to Z',
      'rating': 'Highest Rated'
    };
    return sortOptions[this.currentSortOption] || 'Featured';
  }

  sortByFeatured() {
    this.filteredItems.sort((a, b) => {
      // Enhanced featured algorithm:
      // 1. Prioritize available items over sold items
      if (a.sale_status !== b.sale_status) {
        if (a.sale_status === 'available' && b.sale_status === 'sold') return -1;
        if (a.sale_status === 'sold' && b.sale_status === 'available') return 1;
      }
      
      // 2. Sort by featured score (higher score first)
      if (b.featured_score !== a.featured_score) {
        return b.featured_score - a.featured_score;
      }
      
      // 3. Then by rating (higher rating first)
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      
      // 4. Finally by newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  sortByPriceLowToHigh() {
    this.filteredItems.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      // Secondary sort by rating if prices are equal
      return b.rating - a.rating;
    });
  }

  sortByPriceHighToLow() {
    this.filteredItems.sort((a, b) => {
      if (b.price !== a.price) {
        return b.price - a.price;
      }
      // Secondary sort by rating if prices are equal
      return b.rating - a.rating;
    });
  }

  sortByNewest() {
    this.filteredItems.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // Secondary sort by rating if dates are equal
      return b.rating - a.rating;
    });
  }

  sortByOldest() {
    this.filteredItems.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      // Secondary sort by rating if dates are equal
      return b.rating - a.rating;
    });
  }

  sortByNameAToZ() {
    this.filteredItems.sort((a, b) => {
      const nameComparison = a.product_name.toLowerCase().localeCompare(b.product_name.toLowerCase());
      if (nameComparison !== 0) {
        return nameComparison;
      }
      // Secondary sort by price if names are equal
      return a.price - b.price;
    });
  }

  sortByNameZToA() {
    this.filteredItems.sort((a, b) => {
      const nameComparison = b.product_name.toLowerCase().localeCompare(a.product_name.toLowerCase());
      if (nameComparison !== 0) {
        return nameComparison;
      }
      // Secondary sort by price if names are equal
      return a.price - b.price;
    });
  }

  sortByBrandAToZ() {
    this.filteredItems.sort((a, b) => {
      const brandA = a.brand_display.toLowerCase();
      const brandB = b.brand_display.toLowerCase();
      
      // Sort "No Brand" items to the end
      if (brandA === 'no brand' && brandB !== 'no brand') return 1;
      if (brandA !== 'no brand' && brandB === 'no brand') return -1;
      
      const brandComparison = brandA.localeCompare(brandB);
      if (brandComparison !== 0) {
        return brandComparison;
      }
      
      // Secondary sort by product name if brands are equal
      return a.product_name.toLowerCase().localeCompare(b.product_name.toLowerCase());
    });
  }

  sortByRating() {
    this.filteredItems.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      // Secondary sort by featured score if ratings are equal
      if (b.featured_score !== a.featured_score) {
        return b.featured_score - a.featured_score;
      }
      // Tertiary sort by newest if both rating and featured score are equal
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  // Debug function to test product selection
  testProductClick(product: any, event: any) {
    event.stopPropagation();
    this.openProductModal(product);
  }

  // Debug function to test contact seller
  testContactSeller(product: any, event: any) {
    event.stopPropagation();
    this.contactSeller(product);
  }

  // Handle product card click (for when user clicks anywhere on the card)
  onProductCardClick(product: any, event: any) {
    // Prevent opening modal if user clicked on a button or interactive element
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    this.openProductModal(product);
  }

  // Modal methods
  openProductModal(product: any) {
    // Create a deep copy of the product to avoid reference issues
    this.selectedProduct = JSON.parse(JSON.stringify(product));
    this.currentImageIndex = 0;
    this.currentVideoIndex = 0;
    
    // Set default media type based on available media
    if (this.selectedProduct.productImages && this.selectedProduct.productImages.length > 0) {
      this.currentMediaType = 'image';
    } else if (this.selectedProduct.productVideos && this.selectedProduct.productVideos.length > 0) {
      this.currentMediaType = 'video';
    } else {
      this.currentMediaType = 'image'; // fallback
    }
    
    this.showModal = true;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.showModal = false;
    this.selectedProduct = null;
    this.currentImageIndex = 0;
    this.currentVideoIndex = 0;
    this.currentMediaType = 'image';
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  openImageZoom(product: any, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.zoomImageUrl = product?.image || this.getImageUrl(product?.productImages?.[0]);
    this.zoomImageAlt = product?.product_name || 'Product image';
    this.showImageZoomModal = true;
    document.body.style.overflow = 'hidden';
  }

  // Open mobile zoom overlay (prevents router/hash interference)
  openMobileZoom(product: any, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    console.log('openMobileZoom called:', { productId: product?.id, isMobileDisplay: this.isMobileDisplay, viewMode: this.viewMode });
    this.mobileZoomId = product?.id || null;
    document.body.style.overflow = 'hidden';
  }

  // Close mobile zoom overlay
  closeMobileZoom(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    console.log('closeMobileZoom called');
    this.mobileZoomId = null;
    document.body.style.overflow = 'auto';
  }

  // Modal image zoom handlers
  openModalImageZoom(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    console.log('openModalImageZoom called');
    this.modalZoomedImageUrl = this.getCurrentImageUrl();
    this.modalZoomedImageAlt = this.selectedProduct?.product_name || 'Product image';
    this.showModalImageZoom = true;
    document.body.style.overflow = 'hidden';
  }

  closeModalImageZoom(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    console.log('closeModalImageZoom called');
    this.showModalImageZoom = false;
    this.modalZoomedImageUrl = '';
    this.modalZoomedImageAlt = '';
    document.body.style.overflow = 'auto';
  }

  closeImageZoom() {
    this.showImageZoomModal = false;
    this.zoomImageUrl = '';
    this.zoomImageAlt = '';
    document.body.style.overflow = 'auto';
  }

  nextImage() {
    if (this.selectedProduct && this.selectedProduct.productImages && this.selectedProduct.productImages.length > 1) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.selectedProduct.productImages.length;
    }
  }

  prevImage() {
    if (this.selectedProduct && this.selectedProduct.productImages && this.selectedProduct.productImages.length > 1) {
      this.currentImageIndex = this.currentImageIndex === 0 
        ? this.selectedProduct.productImages.length - 1 
        : this.currentImageIndex - 1;
    }
  }

  goToImage(index: number) {
    this.currentImageIndex = index;
  }

  getCurrentImageUrl(): string {
    if (this.selectedProduct && this.selectedProduct.productImages && this.selectedProduct.productImages.length > 0) {
      return this.getImageUrl(this.selectedProduct.productImages[this.currentImageIndex]);
    }
    return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
  }

  // Video navigation methods
  nextVideo() {
    if (this.selectedProduct && this.selectedProduct.productVideos && this.selectedProduct.productVideos.length > 1) {
      this.currentVideoIndex = (this.currentVideoIndex + 1) % this.selectedProduct.productVideos.length;
    }
  }

  prevVideo() {
    if (this.selectedProduct && this.selectedProduct.productVideos && this.selectedProduct.productVideos.length > 1) {
      this.currentVideoIndex = this.currentVideoIndex === 0 
        ? this.selectedProduct.productVideos.length - 1 
        : this.currentVideoIndex - 1;
    }
  }

  goToVideo(index: number) {
    this.currentVideoIndex = index;
  }

  getCurrentVideoUrl(): string {
    if (this.selectedProduct && this.selectedProduct.productVideos && this.selectedProduct.productVideos.length > 0) {
      return this.getVideoUrl(this.selectedProduct.productVideos[this.currentVideoIndex]);
    }
    return '';
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

  // Media type switching
  switchToImages() {
    this.currentMediaType = 'image';
  }

  switchToVideos() {
    this.currentMediaType = 'video';
  }

  /**
   * Contact seller function - creates or finds existing conversation and navigates to messages
   */
  contactSeller(product: any) {
    
    const currentUserId = parseInt(localStorage.getItem('id') || '0');
    const sellerId = product.uploader_id;
    
    
    // Check if user is trying to message themselves
    if (currentUserId === sellerId) {
      this.showAlert('Cannot Message Yourself', 'You cannot message yourself!', 'warning');
      return;
    }

    // Check if user is logged in
    if (!currentUserId) {
      this.showAlert('Login Required', 'Please login to message the seller', 'warning', () => {
        this.router.navigate(['/login']);
      });
      return;
    }

    // Get the correct product ID - try both property names
    const productId = product.product_id || product.id;
    

    // Validate required data
    if (!productId) {
      this.showAlert('Missing Information', 'Product ID is missing. Please refresh the page and try again.', 'error');
      return;
    }

    if (!sellerId) {
      this.showAlert('Missing Information', 'Seller information is missing. Please try again.', 'error');
      return;
    }

    // Create or find conversation
    const conversationData = {
      product_id: productId,
      buyer_id: currentUserId,
      seller_id: sellerId
    };

    this.apiService.createConversation(conversationData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          
          // Add a small delay to ensure the message is processed
          setTimeout(() => {
            // Navigate immediately for better user experience
            const navigationPromise = this.router.navigate(['/messages'], {
              queryParams: {
                conversation_id: response.data.conversation_id,
                product_id: productId
              }
            });

            navigationPromise.then(
              (navigationSuccessful) => {
                if (!navigationSuccessful) {
                  this.showAlert('Navigation Error', 'Unable to navigate to messages. Please try going to Messages manually.', 'error');
                }
              }
            ).catch((navigationError) => {
              this.showAlert('Navigation Error', 'Unable to navigate to messages. Please try going to Messages manually.', 'error');
            });
          }, 500); // Small delay to allow backend processing
        } else {
          this.showAlert('Conversation Error', `Failed to start conversation: ${response.message}`, 'error');
        }
      },
      error: (error) => {
        
        let errorMessage = 'Error starting conversation. Please try again.';
        if (error.error && error.error.message) {
          errorMessage = `Error: ${error.error.message}`;
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }
        
        this.showAlert('Connection Error', errorMessage, 'error');
      }
    });
  }
  
  /**
   * Report product functionality
   */
  openReportModal(product: any, event: any) {
    event.stopPropagation(); // Prevent opening product modal

    if (this.isOwnedByCurrentUser(product)) {
      this.showAlert('Not Allowed', 'You cannot report your own listing.', 'warning');
      return;
    }

    
    this.reportTargetProduct = product;
    this.showReportModal = true;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  /**
   * Open report modal from within the product modal
   */
  openReportModalFromProductModal() {
    if (this.isOwnedByCurrentUser(this.selectedProduct)) {
      this.showAlert('Not Allowed', 'You cannot report your own listing.', 'warning');
      return;
    }

    
    // Set the report target to the currently selected product
    this.reportTargetProduct = this.selectedProduct;
    
    // Open the report modal first
    this.showReportModal = true;
    
    // Close the product modal after a brief delay to ensure smooth transition
    setTimeout(() => {
      this.closeModal();
    }, 50);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeReportModal() {
    this.showReportModal = false;
    this.reportTargetProduct = null;
    
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  onReportSubmitted(reportData: any) {
    // You could show a success message here or refresh data if needed
  }

  // Alert modal methods
  showAlert(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', callback?: () => void) {
    this.alertModalData = {
      title,
      message,
      type,
      primaryButtonText: 'OK',
      secondaryButtonText: 'Cancel',
      showSecondaryButton: false
    };
    this.alertModalCallback = callback || null;
    this.showAlertModal = true;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  showConfirm(title: string, message: string, onConfirm: () => void, onCancel?: () => void) {
    this.alertModalData = {
      title,
      message,
      type: 'warning',
      primaryButtonText: 'Confirm',
      secondaryButtonText: 'Cancel',
      showSecondaryButton: true
    };
    this.alertModalCallback = onConfirm;
    this.showAlertModal = true;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeAlertModal() {
    this.showAlertModal = false;
    this.alertModalCallback = null;
    
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  onAlertPrimaryAction() {
    if (this.alertModalCallback) {
      this.alertModalCallback();
    }
    this.closeAlertModal();
  }

  onAlertSecondaryAction() {
    this.closeAlertModal();
  }

  getAlertHeaderClass(): string {
    switch (this.alertModalData.type) {
      case 'success':
        return 'bg-gradient-to-r from-gray-800 to-black';
      case 'error':
        return 'bg-gradient-to-r from-black to-gray-900';
      case 'warning':
        return 'bg-gradient-to-r from-gray-600 to-gray-800';
      case 'info':
      default:
        return 'bg-gradient-to-r from-gray-700 to-gray-900';
    }
  }

  getAlertIconBgClass(): string {
    switch (this.alertModalData.type) {
      case 'success':
        return 'bg-gray-200';
      case 'error':
        return 'bg-gray-300';
      case 'warning':
        return 'bg-gray-100';
      case 'info':
      default:
        return 'bg-gray-200';
    }
  }

  getAlertIconClass(): string {
    switch (this.alertModalData.type) {
      case 'success':
        return 'text-gray-700';
      case 'error':
        return 'text-black';
      case 'warning':
        return 'text-gray-600';
      case 'info':
      default:
        return 'text-gray-800';
    }
  }

  getAlertButtonClass(): string {
    switch (this.alertModalData.type) {
      case 'success':
        return 'bg-gray-800 hover:bg-black text-white';
      case 'error':
        return 'bg-black hover:bg-gray-900 text-white';
      case 'warning':
        return 'bg-gray-600 hover:bg-gray-700 text-white';
      case 'info':
      default:
        return 'bg-gray-700 hover:bg-gray-800 text-white';
    }
  }

  getAlertIcon(): string {
    switch (this.alertModalData.type) {
      case 'success':
        return 'M5 13l4 4L19 7';
      case 'error':
        return 'M6 18L18 6M6 6l12 12';
      case 'warning':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z';
      case 'info':
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  // Tooltip management methods
  showTooltip(tooltipId: string) {
    this.activeTooltip = tooltipId;
  }

  hideTooltip() {
    this.activeTooltip = null;
  }

  toggleTooltip(tooltipId: string, event: any) {
    event.stopPropagation();
    if (this.activeTooltip === tooltipId) {
      this.activeTooltip = null;
    } else {
      this.activeTooltip = tooltipId;
    }
  }

  isTooltipActive(tooltipId: string): boolean {
    return this.activeTooltip === tooltipId;
  }

  // Test method for new notification system
  testNotification(type: 'success' | 'error' | 'warning' | 'info') {
    switch (type) {
      case 'success':
        this.notificationService.showSuccess(
          'Operation Successful!', 
          'This is a test success notification with the new modal design.'
        );
        break;
      case 'error':
        this.notificationService.showError(
          'Something Went Wrong!', 
          'This is a test error notification that shakes to grab your attention.'
        );
        break;
      case 'warning':
        this.notificationService.showWarning(
          'Warning Notice!', 
          'This is a test warning notification with enhanced visibility.'
        );
        break;
      case 'info':
        this.notificationService.showInfo(
          'Information Update!', 
          'This is a test info notification with the new design system.'
        );
        break;
    }
  }

  // Global click listener to hide tooltips when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: any) {
    // Hide tooltip when clicking anywhere on the document
    // unless it's a double-click on a button (which toggles tooltip)
    if (!event.target.closest('button')) {
      this.hideTooltip();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress() {
    if (this.showImageZoomModal) {
      this.closeImageZoom();
      return;
    }

    if (this.showRulesReminderModal) {
      this.closeRulesReminderModal();
      return;
    }

    if (this.showApplyModeratorModal) {
      this.closeModeratorApplicationModal();
    }
  }

  // ===== PROFILE MODAL METHODS =====

  // Open profile modal with seller information
  openProfileModal(product: any) {
    
    // Reset modal state
    this.profileModalActiveTab = 'reviews';
    this.sellerOtherListings = [];
    this.loadingOtherListings = false;
    this.sellerReviews = [];
    this.loadingReviews = false;
    
    // Show modal immediately with basic info
    this.selectedSellerProfile = {
      seller_name: product.seller || product.seller_name,
      seller_profile_image: product.seller_profile_image,
      uploader_id: product.uploader_id, // For profile image path
      city: product.location, // Using location as city
      is_verified: false, // Will be loaded from API
      average_rating: 0, // Will be loaded from API
      total_ratings: 0, // Will be loaded from API
      created_at: product.created_at || new Date().toISOString(),
      loading: true // Add loading state
    };
    
    
    this.showProfileModal = true;
    
    // Load detailed seller information from API
    if (product.uploader_id) {
      this.loadSellerDetails(product.uploader_id);
      // Load reviews by default since Reviews tab is active
      this.loadSellerReviews(this.selectedSellerProfile);
      // Also pre-load other listings for better UX
      this.loadSellerOtherListings(product.uploader_id);
    } else {
      this.selectedSellerProfile.loading = false;
    }
  }

  // Load detailed seller information from API
  loadSellerDetails(uploaderId: number) {
    // Get user details
    this.apiService.getUser(uploaderId).subscribe({
      next: (userResponse) => {
        if (userResponse && userResponse.data && userResponse.data.length > 0) {
          const userData = userResponse.data[0]; // API returns array
          
          // Update seller profile with user details
          this.selectedSellerProfile = {
            ...this.selectedSellerProfile,
            is_verified: userData.is_verified === 1 || userData.is_verified === '1' || userData.is_verified === true,
            city: userData.city || this.selectedSellerProfile.city,
            created_at: userData.created_at || this.selectedSellerProfile.created_at,
            seller_name: userData.full_name || this.selectedSellerProfile.seller_name,
            seller_profile_image: userData.profile_image || this.selectedSellerProfile.seller_profile_image
          };
          
        }
      },
      error: (error) => {
      }
    });

    // Get user ratings
    this.apiService.getUserAverageRatings(uploaderId).subscribe({
      next: (ratingsResponse) => {
        if (ratingsResponse && ratingsResponse.data && ratingsResponse.data.length > 0) {
          const ratingsData = ratingsResponse.data[0]; // API returns array
          this.selectedSellerProfile = {
            ...this.selectedSellerProfile,
            average_rating: parseFloat(ratingsData.average_stars) || 0,
            total_ratings: parseInt(ratingsData.total_ratings) || 0,
            loading: false
          };
        } else {
          this.selectedSellerProfile = {
            ...this.selectedSellerProfile,
            average_rating: 0,
            total_ratings: 0,
            loading: false
          };
        }
      },
      error: (error) => {
        this.selectedSellerProfile = {
          ...this.selectedSellerProfile,
          average_rating: 0,
          total_ratings: 0,
          loading: false
        };
      }
    });
  }

  // Close profile modal
  closeProfileModal() {
    this.showProfileModal = false;
    this.selectedSellerProfile = null;
    this.profileModalActiveTab = 'reviews';
    this.sellerOtherListings = [];
    this.loadingOtherListings = false;
  }

  // Open reviews modal for selected seller
  viewSellerReviews(sellerProfile: any) {
    
    this.selectedSellerForReviews = sellerProfile;
    this.showReviewsModal = true;
    this.loadSellerReviews(sellerProfile);
  }

  // Close reviews modal
  closeReviewsModal() {
    this.showReviewsModal = false;
    this.selectedSellerForReviews = null;
    this.sellerReviews = [];
    this.loadingReviews = false;
  }

  // Load seller reviews from API
  loadSellerReviews(sellerProfile: any) {
    this.loadingReviews = true;
    this.sellerReviews = [];
    
    
    // Use uploader_id from the seller profile to get actual reviews
    if (sellerProfile.uploader_id) {
      this.apiService.getUserRatings(sellerProfile.uploader_id).subscribe({
        next: (response) => {
          if (response && response.data && Array.isArray(response.data)) {
            this.sellerReviews = response.data.map((review: any) => ({
              // Reviewer information
              reviewer_name: review.buyer_name || review.reviewer_name || 'Anonymous',
              reviewer_profile_image: review.buyer_profile_image || review.reviewer_profile_image || null,
              
              // Rating information - calculate overall rating from individual ratings
              overall_rating: this.calculateOverallRating(review),
              communication_rating: parseInt(review.communication_rating) || 0,
              product_rating: parseInt(review.product_rating) || 0,
              app_help_rating: parseInt(review.app_help_rating) || 0,
              
              // Review content
              review_comment: review.feedback || review.review_comment || '',
              product_name: review.product_name || 'Product',
              created_at: review.created_at || new Date().toISOString(),
              
              // Product information
              product_images: review.product_images || '[]',
              product_price: review.product_price || 0,
              product_description: review.product_description || '',
              product_id: review.product_id || null,
              
              // Keep original data for any additional fields
              ...review
            }));
          } else {
            this.sellerReviews = [];
          }
          this.loadingReviews = false;
        },
        error: (error) => {
          this.sellerReviews = [];
          this.loadingReviews = false;
        }
      });
    } else {
      // Fallback: No seller ID available
      this.sellerReviews = [];
      this.loadingReviews = false;
    }
  }

  // Message seller from profile modal
  messageSellerFromProfile(sellerProfile: any) {

    if (this.isOwnedByCurrentUser(sellerProfile)) {
      this.showAlert('Cannot Message Yourself', 'You cannot message yourself.', 'warning');
      return;
    }
    
    // Close profile modal first
    this.closeProfileModal();
    
    // Navigate to messages with seller info
    this.router.navigate(['/messages'], {
      queryParams: { 
        seller: sellerProfile.seller_name 
      }
    });
  }

  // Format member since date
  formatMemberSince(dateString: string): string {
    try {
      const date = new Date(dateString);
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long'
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      return 'Unknown';
    }
  }

  // Format review date
  formatReviewDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) {
        return 'Today';
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays < 7) {
        return `${diffInDays} days ago`;
      } else if (diffInDays < 30) {
        const weeks = Math.floor(diffInDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      } else {
        const options: Intl.DateTimeFormatOptions = { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        };
        return date.toLocaleDateString('en-US', options);
      }
    } catch (error) {
      return 'Unknown date';
    }
  }

  // ===== PROFILE MODAL TAB METHODS =====

  // Switch between tabs in profile modal
  switchProfileModalTab(tab: 'reviews' | 'listings') {
    this.profileModalActiveTab = tab;
    
    // Load data for the selected tab if not already loaded
    if (tab === 'listings' && this.sellerOtherListings.length === 0 && this.selectedSellerProfile && !this.loadingOtherListings) {
      this.loadSellerOtherListings(this.selectedSellerProfile.uploader_id);
    } else if (tab === 'reviews' && this.sellerReviews.length === 0 && this.selectedSellerProfile && !this.loadingReviews) {
      this.loadSellerReviews(this.selectedSellerProfile);
    }
  }

  // Load seller's other listings
  loadSellerOtherListings(uploaderId: number) {
    this.loadingOtherListings = true;
    
    this.apiService.getProductsByUser(uploaderId).subscribe({
      next: (response) => {
        if (response && response.data) {
          // Filter out inactive products and enrich with seller info
          this.sellerOtherListings = response.data
            .filter((product: any) => 
              product.status === 'active' && product.sale_status === 'available'
            )
            .map((product: any) => ({
              ...product,
              // Ensure seller information is available
              seller: product.seller_name || this.selectedSellerProfile?.seller_name,
              seller_name: product.seller_name || this.selectedSellerProfile?.seller_name,
              seller_email: product.seller_email || this.selectedSellerProfile?.email,
              seller_profile_image: product.seller_profile_image || this.selectedSellerProfile?.seller_profile_image
            }));
        } else {
          this.sellerOtherListings = [];
        }
        this.loadingOtherListings = false;
      },
      error: (error) => {
        this.sellerOtherListings = [];
        this.loadingOtherListings = false;
      }
    });
  }

  // View specific product from other listings
  viewProductFromListings(product: any) {
    
    // Enrich the product data to ensure it has all required fields for the modal
    const enrichedProduct = {
      ...product,
      // Convert database field names to modal expected format
      productImages: this.parseProductImages(product.product_images),
      productVideos: this.parseProductVideos(product.product_videos),
      // Ensure images and videos arrays exist for compatibility
      images: this.parseProductImages(product.product_images),
      videos: this.parseProductVideos(product.product_videos),
      // Ensure seller information is complete
      seller: product.seller_name || product.seller || 'Unknown Seller',
      seller_name: product.seller_name || 'Unknown Seller',
      seller_profile_image: product.seller_profile_image,
      // Use location as fallback for missing data
      location: product.location || 'Location not specified',
      // Ensure proper ID field
      id: product.product_id || product.id
    };
    
    // Debug the enriched product
    this.debugProductModal(enrichedProduct);
    
    this.closeProfileModal();
    this.openProductModal(enrichedProduct);
  }

  // Contact seller about a specific listing
  contactSellerAboutListing(product: any) {
    this.closeProfileModal();
    this.contactSeller(product);
  }

  // Helper method to get first image from product images
  getFirstProductImage(productImages: string): string {
    try {
      const images = JSON.parse(productImages || '[]');
      return images.length > 0 ? images[0] : '';
    } catch (error) {
      return '';
    }
  }

  // Helper method to get image count
  getImageCount(productImages: string): number {
    try {
      const images = JSON.parse(productImages || '[]');
      return Array.isArray(images) ? images.length : 0;
    } catch (error) {
      return 0;
    }
  }

  // Helper method to get video count
  getVideoCount(productVideos: string): number {
    try {
      const videos = JSON.parse(productVideos || '[]');
      return Array.isArray(videos) ? videos.length : 0;
    } catch (error) {
      return 0;
    }
  }

  // Helper method to parse product images
  parseProductImages(productImages: string): string[] {
    try {
      const images = JSON.parse(productImages || '[]');
      return Array.isArray(images) ? images : [];
    } catch (error) {
      return [];
    }
  }

  // Helper method to parse product videos
  parseProductVideos(productVideos: string): string[] {
    try {
      const videos = JSON.parse(productVideos || '[]');
      return Array.isArray(videos) ? videos : [];
    } catch (error) {
      return [];
    }
  }

  // Quick view listing method
  quickViewListing(listing: any) {
    // Use the same enrichment logic as viewProductFromListings
    this.viewProductFromListings(listing);
  }

  // Debug method to test ratings API (can be removed in production)
  testRatingsAPI(sellerId: number) {
    this.apiService.getUserRatings(sellerId).subscribe({
      next: (response) => {
        if (response && response.data) {
        }
      },
      error: (error) => {
      }
    });
  }

  // Debug method to log product modal data (can be removed in production)
  debugProductModal(product: any) {
    // Debugging disabled - enable console logs if needed
  }

  // ===== RATING DISPLAY HELPER METHODS =====

  // Generate array for star rating display
  getStarArray(rating: number): { type: 'full' | 'half' | 'empty', index: number }[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push({ type: 'full' as const, index: i });
    }
    
    // Add half star if needed
    if (hasHalfStar && fullStars < 5) {
      stars.push({ type: 'half' as const, index: fullStars });
    }
    
    // Add empty stars to make total of 5
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push({ type: 'empty' as const, index: fullStars + (hasHalfStar ? 1 : 0) + i });
    }
    
    return stars;
  }

  // Get rating description text
  getRatingText(rating: number, totalRatings: number): string {
    if (rating === 0 || totalRatings === 0) {
      return 'No ratings yet';
    }
    
    if (rating >= 4.5) {
      return 'Excellent seller';
    } else if (rating >= 4.0) {
      return 'Very good seller';
    } else if (rating >= 3.5) {
      return 'Good seller';
    } else if (rating >= 3.0) {
      return 'Average seller';
    } else {
      return 'Below average';
    }
  }

  // Get rating color class
  getRatingColorClass(rating: number): string {
    if (rating === 0) {
      return 'text-gray-400';
    } else if (rating >= 4.5) {
      return 'text-green-500';
    } else if (rating >= 4.0) {
      return 'text-yellow-500';
    } else if (rating >= 3.0) {
      return 'text-orange-500';
    } else {
      return 'text-red-500';
    }
  }

  // Calculate overall rating from individual rating components
  calculateOverallRating(review: any): number {
    const communication = parseInt(review.communication_rating) || 0;
    const product = parseInt(review.product_rating) || 0;
    const appHelp = parseInt(review.app_help_rating) || 0;
    
    if (communication === 0 && product === 0 && appHelp === 0) {
      // Try to use average_stars if available
      return parseFloat(review.average_stars) || 0;
    }
    
    // Calculate average of non-zero ratings
    const ratings = [communication, product, appHelp].filter(r => r > 0);
    if (ratings.length === 0) {
      return 0;
    }
    
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return Math.round(average * 10) / 10; // Round to 1 decimal place
  }

  // Get the first product image from review data
  getReviewProductImage(productImages: string): string {
    if (!productImages || productImages === '[]') {
      return 'https://via.placeholder.com/150x150/f3f4f6/9ca3af?text=No+Image'; // fallback image
    }
    
    try {
      const images = JSON.parse(productImages);
      if (Array.isArray(images) && images.length > 0) {
        // Get the first image and format the URL
        const firstImage = images[0];
        return this.getImageUrl(firstImage);
      }
    } catch (error) {
    }
    
    return 'https://via.placeholder.com/150x150/f3f4f6/9ca3af?text=No+Image'; // fallback image
  }
}
