import { Component, OnInit, HostListener } from '@angular/core';
import { SidenavComponent } from "../sidenav/sidenav.component";
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api/api.service';
import { ReportsComponent } from '../reports/reports.component';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, SidenavComponent, ReportsComponent], // ✅ Only standalone pieces
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

  // Video state
  currentVideoIndex: number = 0;
  showVideoModal: boolean = false;
  currentMediaType: 'image' | 'video' = 'image';

  // Report modal state
  showReportModal: boolean = false;
  reportTargetProduct: any = null;

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

  // Reviews modal state
  showReviewsModal: boolean = false;
  selectedSellerForReviews: any = null;
  sellerReviews: any[] = [];
  loadingReviews: boolean = false;

  constructor(
    public apiService: ApiService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadActiveProducts();
  }

  loadActiveProducts() {
    this.loading = true;
    this.error = null;
    
    this.apiService.getAllActiveProducts().subscribe({
      next: (response) => {
        console.log('API Response:', response);
        
        // Check if response has data
        if (response && response.data && Array.isArray(response.data)) {
          this.items = response.data.map((product: any) => {
            // Parse product images from JSON string
            let productImages: string[] = [];
            try {
              if (product.product_images) {
                productImages = JSON.parse(product.product_images);
              }
            } catch (e) {
              console.warn('Failed to parse product images:', product.product_images);
              productImages = [];
            }

            // Parse product videos from JSON string
            let productVideos: string[] = [];
            try {
              if (product.product_videos) {
                productVideos = JSON.parse(product.product_videos);
              }
            } catch (e) {
              console.warn('Failed to parse product videos:', product.product_videos);
              productVideos = [];
            }

            const imageUrl = productImages.length > 0 
              ? this.getImageUrl(productImages[0]) 
              : 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
            
            console.log('Product image URL:', imageUrl);
            console.log('Product videos count:', productVideos.length);

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
              price: parseFloat(product.price),
              saleType: this.formatSaleType(product.for_type),
              category: this.formatCategory(product.category),
              seller: product.seller_name || 'Unknown Seller',
              seller_profile_image: product.seller_profile_image || null, // Add profile image
              uploader_id: product.uploader_id, // Add uploader ID for profile image path
              location: product.location,
              rating: 0, // Will be loaded separately
              description: product.description,
              condition: product.condition,
              quantity: product.quantity,
              sale_status: product.sale_status,
              status: product.status,
              created_at: product.created_at || new Date().toISOString(), // Add created date for sorting
              featured_score: Math.random() * 100 // Random score for featured scoring
            };
          });
          console.log('Processed items:', this.items);
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
        console.error('Error loading products:', error);
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
            console.log(`Ratings for seller ${sellerId}:`, response);
            
            if (response.status === 'success' && response.data && response.data.length > 0) {
              const ratingData = response.data[0];
              const averageRating = parseFloat(ratingData.average_rating) || 0;
              
              // Update all items for this seller
              this.items.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = averageRating;
                }
              });
              
              // Update filtered items as well
              this.filteredItems.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = averageRating;
                }
              });
            } else {
              // No ratings found, set to 0 or "No ratings"
              this.items.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = 0;
                }
              });
              
              this.filteredItems.forEach(item => {
                if (item.uploader_id === sellerId) {
                  item.rating = 0;
                }
              });
            }
          },
          error: (error) => {
            console.error(`Error loading ratings for seller ${sellerId}:`, error);
            // Set rating to 0 on error
            this.items.forEach(item => {
              if (item.uploader_id === sellerId) {
                item.rating = 0;
              }
            });
            
            this.filteredItems.forEach(item => {
              if (item.uploader_id === sellerId) {
                item.rating = 0;
              }
            });
          }
        });
      }
    });
  }

  getImageUrl(imageName: string): string {
    // Remove any extra path prefixes from the image name
    const cleanImageName = imageName.replace(/^uploads[\/\\]/, '');
    // Create the correct path to the uploads folder (which is inside the api directory)
    return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
  }

  getProfileImageUrl(profileImage: string | null, username?: string): string {
    if (!profileImage) {
      // Generate a personalized avatar with the user's name or default
      const displayName = username || 'User';
      const encodedName = encodeURIComponent(displayName);
      return `https://ui-avatars.com/api/?name=${encodedName}&background=000000&color=ffffff&size=128`;
    }
    
    // Handle base64 images
    if (profileImage.startsWith('data:')) {
      return profileImage;
    }
    
    // Remove any extra path prefixes from the image name
    const cleanImageName = profileImage.replace(/^uploads[\/\\]/, '');
    // Create the correct path to the uploads folder
    return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
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
    switch(saleType) {
      case 'For Sale':
        return 'bg-black hover:bg-gray-800';
      case 'For Trade':
        return 'bg-gray-600 hover:bg-gray-700';
      case 'For Sale or Trade':
        return 'bg-gray-800 hover:bg-black';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
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
    console.error('Image failed to load:', item.image, event);
    // Set a fallback image
    event.target.src = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
  }

  onImageLoad(event: any, item: any) {
    console.log('Image loaded successfully:', item.image);
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
    this.applySorting();
    console.log('Search results:', this.filteredItems.length, 'items found for query:', this.searchQuery);
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
    console.log('Sorting changed to:', this.currentSortOption);
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
    console.log(`Sorting completed in ${(endTime - startTime).toFixed(2)}ms`);
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
    console.log('🔍 TEST CLICK - Product clicked:', product.product_name, 'ID:', product.id);
    console.log('🔍 TEST CLICK - Full product object:', product);
    this.openProductModal(product);
  }

  // Debug function to test contact seller
  testContactSeller(product: any, event: any) {
    event.stopPropagation();
    console.log('🔍 TEST CONTACT - Testing contactSeller with product:', product);
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
    console.log('=== Opening modal for product ===');
    console.log('Product ID:', product.id);
    console.log('Product Name:', product.product_name);
    console.log('Product Images:', product.productImages);
    console.log('Product Videos:', product.productVideos);
    console.log('Full product object:', product);
    
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
    
    console.log('Selected product after assignment:', this.selectedProduct);
    console.log('Modal state - showModal:', this.showModal);
    console.log('===================================');
    
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
    if (videoPath.startsWith('data:')) {
      return videoPath; // Base64 video
    }
    return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/${videoPath}`;
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
    console.log('🔵 contactSeller called with product:', product);
    
    const currentUserId = parseInt(localStorage.getItem('id') || '0');
    const sellerId = product.uploader_id;
    
    console.log('🔵 User IDs - Current:', currentUserId, 'Seller:', sellerId);
    
    // Check if user is trying to message themselves
    if (currentUserId === sellerId) {
      console.log('🔵 Cannot message yourself - showing alert');
      this.showAlert('Cannot Message Yourself', 'You cannot message yourself!', 'warning');
      return;
    }

    // Check if user is logged in
    if (!currentUserId) {
      console.log('🔵 User not logged in - showing login alert');
      this.showAlert('Login Required', 'Please login to message the seller', 'warning', () => {
        this.router.navigate(['/login']);
      });
      return;
    }

    // Get the correct product ID - try both property names
    const productId = product.product_id || product.id;
    
    console.log('🔵 Product ID resolved to:', productId);
    console.log('🔵 Contacting seller:', {
      productId: productId,
      productName: product.product_name,
      sellerId: sellerId,
      buyerId: currentUserId,
      fullProduct: product
    });

    // Validate required data
    if (!productId) {
      console.log('🔵 Missing product ID - showing error');
      this.showAlert('Missing Information', 'Product ID is missing. Please refresh the page and try again.', 'error');
      return;
    }

    if (!sellerId) {
      console.log('🔵 Missing seller ID - showing error');
      this.showAlert('Missing Information', 'Seller information is missing. Please try again.', 'error');
      return;
    }

    // Create or find conversation
    const conversationData = {
      product_id: productId,
      buyer_id: currentUserId,
      seller_id: sellerId
    };

    console.log('🔵 Making API call with data:', conversationData);
    this.apiService.createConversation(conversationData).subscribe({
      next: (response) => {
        console.log('🔄 Conversation creation response:', response);
        console.log('📋 Conversation data sent:', conversationData);
        if (response.status === 'success') {
          console.log('✅ Conversation creation successful:', response.data);
          console.log('✅ Navigating to conversation ID:', response.data.conversation_id);
          
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
                if (navigationSuccessful) {
                  console.log('✅ Navigation successful to /messages');
                } else {
                  console.error('❌ Navigation failed - navigationSuccessful:', navigationSuccessful);
                  this.showAlert('Navigation Error', 'Unable to navigate to messages. Please try going to Messages manually.', 'error');
                }
              }
            ).catch((navigationError) => {
              console.error('❌ Navigation exception:', navigationError);
              this.showAlert('Navigation Error', 'Unable to navigate to messages. Please try going to Messages manually.', 'error');
            });
          }, 500); // Small delay to allow backend processing
        } else {
          console.error('❌ Failed to create conversation:', response.message);
          this.showAlert('Conversation Error', `Failed to start conversation: ${response.message}`, 'error');
        }
      },
      error: (error) => {
        console.error('❌ Error creating conversation:', error);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        
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
    console.log('Opening report modal for product:', product.product_name);
    
    this.reportTargetProduct = product;
    this.showReportModal = true;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeReportModal() {
    console.log('Closing report modal');
    this.showReportModal = false;
    this.reportTargetProduct = null;
    
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  onReportSubmitted(reportData: any) {
    console.log('Report submitted:', reportData);
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

  // ===== PROFILE MODAL METHODS =====

  // Open profile modal with seller information
  openProfileModal(product: any) {
    console.log('Opening profile modal for:', product.seller);
    console.log('Product data:', product); // Debug log to see available fields
    
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
    
    console.log('Initial seller profile:', this.selectedSellerProfile);
    
    this.showProfileModal = true;
    
    // Load detailed seller information from API
    if (product.uploader_id) {
      console.log('Loading seller details for uploader_id:', product.uploader_id);
      this.loadSellerDetails(product.uploader_id);
    } else {
      console.error('No uploader_id found in product data');
      this.selectedSellerProfile.loading = false;
    }
  }

  // Load detailed seller information from API
  loadSellerDetails(uploaderId: number) {
    // Get user details
    this.apiService.getUser(uploaderId).subscribe({
      next: (userResponse) => {
        console.log('User details response:', userResponse);
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
          
          console.log('Updated seller profile with user data:', this.selectedSellerProfile);
        }
      },
      error: (error) => {
        console.error('Error loading user details:', error);
      }
    });

    // Get user ratings
    this.apiService.getUserAverageRatings(uploaderId).subscribe({
      next: (ratingsResponse) => {
        console.log('Ratings response:', ratingsResponse);
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
        console.error('Error loading ratings:', error);
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
  }

  // Open reviews modal for selected seller
  viewSellerReviews(sellerProfile: any) {
    console.log('Viewing reviews for seller:', sellerProfile.seller_name);
    
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
    
    console.log('Loading reviews for seller:', sellerProfile);
    
    // Use uploader_id from the seller profile to get actual reviews
    if (sellerProfile.uploader_id) {
      this.apiService.getUserRatings(sellerProfile.uploader_id).subscribe({
        next: (response) => {
          console.log('Seller reviews response:', response);
          if (response && response.data && Array.isArray(response.data)) {
            this.sellerReviews = response.data.map((review: any) => ({
              reviewer_name: review.reviewer_name || 'Anonymous',
              reviewer_profile_image: review.reviewer_profile_image || null,
              rating: parseInt(review.rating) || 0,
              comment: review.comment || '',
              created_at: review.created_at || new Date().toISOString()
            }));
          }
          this.loadingReviews = false;
        },
        error: (error) => {
          console.error('Error loading seller reviews:', error);
          this.sellerReviews = [];
          this.loadingReviews = false;
        }
      });
    } else {
      // Fallback: No seller ID available
      console.log('No uploader_id available for reviews');
      this.sellerReviews = [];
      this.loadingReviews = false;
    }
  }

  // Message seller from profile modal
  messageSellerFromProfile(sellerProfile: any) {
    console.log('Messaging seller from profile:', sellerProfile.seller_name);
    
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
}
