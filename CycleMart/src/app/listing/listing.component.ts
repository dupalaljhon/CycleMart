import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidenavComponent } from '../sidenav/sidenav.component';
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
  created_at: string;
  uploader_id: number;
  isEditing?: boolean;
  pendingApproval?: boolean;
}

@Component({
  selector: 'app-listing',
  standalone: true,
  imports: [CommonModule, SidenavComponent, FormsModule],
  templateUrl: './listing.component.html',
  styleUrl: './listing.component.css'
})
export class ListingComponent implements OnInit, OnDestroy {
  listings: Product[] = [];
  isLoading = false;
  userId: number = 0;
  showAddForm = false;
  showApprovalModal = false;
  selectedProduct: Product | null = null;
  currentImageIndex = 0;
  isDragOver = false;
  
  // Lightbox for image viewing
  showLightbox = false;
  lightboxImages: string[] = [];
  lightboxCurrentIndex = 0;
  lightboxProduct: Product | null = null;
  
  // New product form
  newProduct: Partial<Product> = {
    product_name: '',
    price: 0,
    description: '',
    location: '',
    for_type: 'sale',
    condition: 'second_hand',
    category: 'others',
    quantity: 1,
    product_images: []
  };

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
    
    // Restore body scroll if component is destroyed while lightbox is open
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
          this.listings = response.data.map((product: any) => ({
            ...product,
            product_images: typeof product.product_images === 'string' 
              ? JSON.parse(product.product_images) 
              : product.product_images,
            isEditing: false,
            pendingApproval: false
          }));
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
    this.showAddForm = true;
    this.resetNewProductForm();
  }

  resetNewProductForm() {
    this.newProduct = {
      product_name: '',
      price: 0,
      description: '',
      location: '',
      for_type: 'sale',
      condition: 'second_hand',
      category: 'others',
      quantity: 1,
      product_images: []
    };
  }

  cancelAddForm() {
    this.showAddForm = false;
    this.resetNewProductForm();
  }

  saveNewProduct() {
    if (!this.validateProduct(this.newProduct)) {
      alert('Please fill in all required fields');
      return;
    }

    const productData = {
      ...this.newProduct,
      uploader_id: this.userId,
      product_images: JSON.stringify(this.newProduct.product_images || [])
    };

    this.apiService.addProduct(productData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          alert('Product added successfully!');
          this.showAddForm = false;
          this.loadUserProducts(); // Reload the list
        } else {
          alert('Failed to add product: ' + response.message);
        }
      },
      error: (error) => {
        console.error('Error adding product:', error);
        alert('Failed to add product. Please try again.');
      }
    });
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

  submitForApproval(product: Product) {
    this.selectedProduct = product;
    this.currentImageIndex = 0;
    this.showApprovalModal = true;
  }

  confirmSubmitForApproval() {
    if (!this.selectedProduct) return;

    const submissionData = {
      product_id: this.selectedProduct.product_id,
      uploader_id: this.userId
    };

    this.apiService.submitForApproval(submissionData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          if (this.selectedProduct) {
            this.selectedProduct.pendingApproval = true;
          }
          alert('Product submitted for approval successfully!');
          this.closeApprovalModal();
        } else {
          alert('Failed to submit product: ' + response.message);
        }
      },
      error: (error) => {
        console.error('Error submitting product:', error);
        alert('Failed to submit product for approval. Please try again.');
      }
    });
  }

  closeApprovalModal() {
    this.showApprovalModal = false;
    this.selectedProduct = null;
    this.currentImageIndex = 0;
  }

  nextImage() {
    if (this.selectedProduct && this.selectedProduct.product_images) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.selectedProduct.product_images.length;
    }
  }

  prevImage() {
    if (this.selectedProduct && this.selectedProduct.product_images) {
      this.currentImageIndex = this.currentImageIndex === 0 
        ? this.selectedProduct.product_images.length - 1 
        : this.currentImageIndex - 1;
    }
  }

  goToImage(index: number) {
    this.currentImageIndex = index;
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

  onImageSelect(event: any, isNewProduct: boolean = false) {
    const files = event.target.files;
    this.handleImageFiles(files, isNewProduct);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent, isNewProduct: boolean = false) {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files || null;
    this.handleImageFiles(files, isNewProduct);
  }

  private handleImageFiles(files: FileList | null, isNewProduct: boolean = false) {
    if (files) {
      for (let file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            const imageData = e.target.result;
            if (isNewProduct) {
              this.newProduct.product_images = this.newProduct.product_images || [];
              this.newProduct.product_images.push(imageData);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  removeImage(index: number, product?: Product) {
    if (product) {
      product.product_images.splice(index, 1);
    } else {
      this.newProduct.product_images?.splice(index, 1);
    }
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

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('data:')) {
      return imagePath; // Base64 image
    }
    return `${this.apiService.baseUrl}${imagePath}`;
  }
}
