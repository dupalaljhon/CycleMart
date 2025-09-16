import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';

interface Product {
  product_id?: number;
  product_name: string;
  product_images: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand_new' | 'second_hand';
  category: 'whole_bike' | 'frame' | 'wheelset' | 'groupset' | 'drivetrain' | 'brakes' | 'saddle' | 'handlebar' | 'accessories' | 'others';
  quantity: number;
  status?: 'active' | 'archived';
  sale_status?: 'available' | 'sold';
  created_at?: string;
  uploader_id?: number;
}

@Component({
  selector: 'app-listing-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listing-modal.component.html',
  styleUrl: './listing-modal.component.css'
})
export class ListingModalComponent implements OnInit {
  @Input() showModal: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() productAdded = new EventEmitter<void>();

  isDragOver = false;
  userId: number = 0;
  
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

  close() {
    this.resetNewProductForm();
    this.closeModal.emit();
    // Restore body scroll
    document.body.style.overflow = 'auto';
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
          this.productAdded.emit(); // Notify parent to reload products
          this.close();
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

  onImageSelect(event: any) {
    const files = event.target.files;
    this.handleImageFiles(files);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files || null;
    this.handleImageFiles(files);
  }

  private handleImageFiles(files: FileList | null) {
    if (files) {
      for (let file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            const imageData = e.target.result;
            this.newProduct.product_images = this.newProduct.product_images || [];
            this.newProduct.product_images.push(imageData);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  removeImage(index: number) {
    this.newProduct.product_images?.splice(index, 1);
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

  onModalClick(event: Event) {
    // Prevent modal from closing when clicking inside the modal content
    event.stopPropagation();
  }

  onOverlayClick() {
    // Close modal when clicking on the overlay
    this.close();
  }
}
