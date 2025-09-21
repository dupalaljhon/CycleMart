import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ListingModalComponent } from './listing-modal/listing-modal.component';
import { SoldItemsComponent } from './sold-items/sold-items.component';
import { ApiService } from '../api/api.service';
import { FormsModule } from '@angular/forms';

interface Product {
  product_id: number;
  product_name: string;
  product_images: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand_new' | 'second_hand';
  category: 'whole_bike' | 'frame' | 'wheelset' | 'groupset' | 'drivetrain' | 'brakes' | 'saddle' | 'handlebar' | 'accessories' | 'others';
  quantity: number;
  status: 'active' | 'archived';
  sale_status: 'available' | 'sold';
  created_at: string;
  uploader_id: number;
  isEditing?: boolean;
}

@Component({
  selector: 'app-listing',
  standalone: true,
  imports: [CommonModule, SidenavComponent, ListingModalComponent, SoldItemsComponent, FormsModule],
  templateUrl: './listing.component.html',
  styleUrl: './listing.component.css'
})
export class ListingComponent implements OnInit, OnDestroy {
  listings: Product[] = [];
  isLoading = false;
  userId: number = 0;
  showAddModal = false;
  showSoldItemsModal = false;
  currentImageIndex = 0;
  isDragOver = false;
  
  // Lightbox for image viewing
  showLightbox = false;
  lightboxImages: string[] = [];
  lightboxCurrentIndex = 0;
  lightboxProduct: Product | null = null;

  // Categories for dropdown
  categories = [
    { value: 'whole_bike', label: 'Whole Bike' },
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

  constructor(private apiService: ApiService) {
    // Get user ID from localStorage
    const storedId = localStorage.getItem('id');
    this.userId = storedId ? parseInt(storedId) : 0;
  }

  ngOnInit() {
    this.loadUserProducts();
    
    // Add keyboard event listener for lightbox navigation
    document.addEventListener('keydown', (event) => this.onLightboxKeydown(event));
  }

  ngOnDestroy() {
    // Clean up event listener
    document.removeEventListener('keydown', (event) => this.onLightboxKeydown(event));
    
    // Restore body scroll if component is destroyed while modals are open
    document.body.style.overflow = 'auto';
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
          // Filter out sold/traded items - only show available items
          const allProducts = response.data.map((product: any) => ({
            ...product,
            product_images: typeof product.product_images === 'string' 
              ? JSON.parse(product.product_images) 
              : product.product_images,
            isEditing: false,
            pendingApproval: false
          }));
          
          // Only show products that are available (not sold/traded)
          this.listings = allProducts.filter((product: Product) => 
            product.sale_status === 'available'
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
    // Create a copy for editing
    product.isEditing = true;
  }

  saveEdit(product: Product) {
    if (!this.validateProduct(product)) {
      alert('Please fill in all required fields');
      return;
    }

    const updateData = {
      product_id: product.product_id,
      product_name: product.product_name,
      price: product.price,
      description: product.description,
      location: product.location,
      for_type: product.for_type,
      condition: product.condition,
      category: product.category,
      quantity: product.quantity,
      product_images: JSON.stringify(product.product_images),
      uploader_id: this.userId
    };

    this.apiService.updateProduct(updateData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          product.isEditing = false;
          alert('Product updated successfully!');
        } else {
          alert('Failed to update product: ' + response.message);
        }
      },
      error: (error) => {
        console.error('Error updating product:', error);
        alert('Failed to update product. Please try again.');
      }
    });
  }

  cancelEdit(product: Product) {
    product.isEditing = false;
    // Reload to revert changes
    this.loadUserProducts();
  }

  deleteListing(product: Product) {
    if (confirm('Are you sure you want to delete this listing?')) {
      this.apiService.deleteProduct(product.product_id, this.userId).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            alert('Product deleted successfully!');
            this.loadUserProducts(); // Reload the list
          } else {
            alert('Failed to delete product: ' + response.message);
          }
        },
        error: (error) => {
          console.error('Error deleting product:', error);
          alert('Failed to delete product. Please try again.');
        }
      });
    }
  }

  // Mark product as sold/available
  toggleSaleStatus(product: Product) {
    const actionText = product.sale_status === 'available' 
      ? this.getAvailableToSoldText(product)
      : this.getSoldToAvailableText(product);
    
    if (confirm(`${actionText}?`)) {
      const newStatus = product.sale_status === 'available' ? 'sold' : 'available';
      
      const updateData = {
        product_id: product.product_id,
        sale_status: newStatus,
        uploader_id: this.userId,
        for_type: product.for_type // Include for_type for proper logging
      };

      // Use the new dedicated sale status API
      this.apiService.updateSaleStatus(updateData).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            product.sale_status = newStatus;
            const successText = newStatus === 'sold' 
              ? this.getSuccessSoldText(product) 
              : this.getSuccessAvailableText(product);
            alert(successText);
            
            // If item is marked as sold, remove it from the listings array
            if (newStatus === 'sold') {
              const index = this.listings.findIndex(item => item.product_id === product.product_id);
              if (index !== -1) {
                this.listings.splice(index, 1);
              }
            }
            
            // Log the status change for admin monitoring
            console.log('Sale status updated:', {
              product_id: product.product_id,
              product_name: product.product_name,
              previous_status: product.sale_status === 'sold' ? 'available' : 'sold',
              new_status: newStatus,
              for_type: product.for_type,
              timestamp: new Date().toISOString(),
              user_id: this.userId
            });
          } else {
            alert('Failed to update product status: ' + response.message);
          }
        },
        error: (error) => {
          console.error('Error updating product status:', error);
          alert('Failed to update product status. Please try again.');
        }
      });
    }
  }

  // Get appropriate button text based on listing type and status
  getStatusButtonText(product: Product): string {
    if (product.sale_status === 'available') {
      switch (product.for_type) {
        case 'sale':
          return 'Mark as Sold';
        case 'trade':
          return 'Mark as Traded';
        case 'both':
          return 'Mark as Sold/Traded';
        default:
          return 'Mark as Sold';
      }
    } else {
      return 'Mark as Available';
    }
  }

  // Get confirmation text when marking as sold/traded
  getAvailableToSoldText(product: Product): string {
    switch (product.for_type) {
      case 'sale':
        return 'Mark this product as sold';
      case 'trade':
        return 'Mark this product as traded';
      case 'both':
        return 'Mark this product as sold/traded';
      default:
        return 'Mark this product as sold';
    }
  }

  // Get confirmation text when marking as available
  getSoldToAvailableText(product: Product): string {
    return 'Mark this product as available again';
  }

  // Get success message when marked as sold/traded
  getSuccessSoldText(product: Product): string {
    switch (product.for_type) {
      case 'sale':
        return 'Product marked as sold!';
      case 'trade':
        return 'Product marked as traded!';
      case 'both':
        return 'Product marked as sold/traded!';
      default:
        return 'Product marked as sold!';
    }
  }

  // Get success message when marked as available
  getSuccessAvailableText(product: Product): string {
    return 'Product marked as available!';
  }  // Lightbox methods
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

  removeImage(index: number, product: Product) {
    product.product_images.splice(index, 1);
  }

  private validateProduct(product: Partial<Product>): boolean {
    return !!(
      product.product_name &&
      product.price &&
      product.description &&
      product.location &&
      product.for_type &&
      product.condition &&
      product.category &&
      product.quantity && product.quantity > 0
    );
  }
}
