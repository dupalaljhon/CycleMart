import { Component, OnInit } from '@angular/core';
import { SidenavComponent } from "../sidenav/sidenav.component";
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api/api.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, SidenavComponent], // ✅ Only standalone pieces
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

  constructor(public apiService: ApiService) {}

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

            const imageUrl = productImages.length > 0 
              ? this.getImageUrl(productImages[0]) 
              : 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
            
            console.log('Product image URL:', imageUrl);

            return {
              id: product.product_id,
              original_id: product.product_id, // Add for tracking
              image: imageUrl,
              productImages: productImages, // Store the full images array for modal
              product_name: product.product_name,
              price: parseFloat(product.price),
              saleType: this.formatSaleType(product.for_type),
              category: this.formatCategory(product.category),
              seller: product.seller_name || 'Unknown Seller',
              seller_profile_image: product.seller_profile_image || null, // Add profile image
              uploader_id: product.uploader_id, // Add uploader ID for profile image path
              location: product.location,
              rating: 4.8, // Default rating
              description: product.description,
              condition: product.condition,
              quantity: product.quantity,
              sale_status: product.sale_status,
              status: product.status,
              created_at: product.created_at || new Date().toISOString(), // Add created date for sorting
              featured_score: Math.random() * 100 // Random score for featured sorting
            };
          });
          console.log('Processed items:', this.items);
          this.filteredItems = [...this.items]; // Initialize filtered items
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
      return `https://ui-avatars.com/api/?name=${encodedName}&background=6BA3BE&color=ffffff&size=128`;
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

  formatCategory(category: string): string {
    switch(category) {
      case 'whole_bike': return 'Complete Bike';
      case 'bike_parts': return 'Bike Parts';
      case 'accessories': return 'Accessories';
      default: return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
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
          item.condition.toLowerCase().includes(query)
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
    console.log('TEST CLICK - Product clicked:', product.product_name, 'ID:', product.id);
    this.openProductModal(product);
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
    console.log('Full product object:', product);
    
    // Create a deep copy of the product to avoid reference issues
    this.selectedProduct = JSON.parse(JSON.stringify(product));
    this.currentImageIndex = 0;
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
}
