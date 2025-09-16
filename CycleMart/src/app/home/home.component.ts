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
              location: product.location,
              rating: 4.8, // Default rating
              description: product.description,
              condition: product.condition,
              quantity: product.quantity,
              sale_status: product.sale_status,
              status: product.status
            };
          });
          console.log('Processed items:', this.items);
          this.filteredItems = [...this.items]; // Initialize filtered items
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
      return;
    }

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

    console.log('Search results:', this.filteredItems.length, 'items found for query:', query);
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredItems = [...this.items];
  }

  onSearchInputChange() {
    // Optional: Real-time search as user types (with debounce if needed)
    this.performSearch();
  }

  quickSearch(query: string) {
    this.searchQuery = query;
    this.performSearch();
  }

  // Debug function to test product selection
  testProductClick(product: any, event: any) {
    event.stopPropagation();
    console.log('TEST CLICK - Product clicked:', product.product_name, 'ID:', product.id);
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
