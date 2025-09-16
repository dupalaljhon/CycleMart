import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { AdminSidenavComponent } from "../admin-sidenav/admin-sidenav.component";
import { ApiService } from '../../api/api.service';

interface Product {
  product_id: number;
  product_name: string;
  product_images: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand_new' | 'second_hand';
  category: string;
  quantity: number;
  status: 'active' | 'archived';
  sale_status: 'available' | 'sold';
  created_at: string;
  uploader_id: number;
  seller_name?: string;
  seller_email?: string;
}

@Component({
  selector: 'app-listing-monitoring',
  imports: [
    AdminSidenavComponent,
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule
  ],
  templateUrl: './listing-monitoring.component.html',
  styleUrl: './listing-monitoring.component.css'
})
export class ListingMonitoringComponent implements OnInit {
  products: Product[] = [];
  isLoading = false;
  
  displayedColumns: string[] = [
    'product_name',
    'seller',
    'price',
    'category',
    'condition',
    'for_type',
    'status',
    'sale_status',
    'created_at',
    'actions'
  ];

  // Image preview
  showImagePreview = false;
  previewImages: string[] = [];
  currentImageIndex = 0;
  selectedProduct: Product | null = null;

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadAllProducts();
  }

  loadAllProducts() {
    this.isLoading = true;
    this.apiService.getAllProductsForAdmin().subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          this.products = response.data.map((product: any) => ({
            ...product,
            product_images: typeof product.product_images === 'string' 
              ? JSON.parse(product.product_images) 
              : product.product_images || []
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

  archiveProduct(product: Product) {
    const reason = prompt('Please provide a reason for archiving this product:');
    if (reason === null) return; // User cancelled

    const adminId = localStorage.getItem('id');
    const adminRole = localStorage.getItem('role') || 'moderator';

    if (!adminId) {
      alert('Admin authentication required');
      return;
    }

    const archiveData = {
      product_id: product.product_id,
      admin_id: parseInt(adminId),
      role: adminRole,
      reason: reason,
      action: 'archived'
    };

    this.apiService.archiveProduct(archiveData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          product.status = 'archived';
          alert('Product archived successfully');
        } else {
          alert('Failed to archive product: ' + response.message);
        }
      },
      error: (error) => {
        console.error('Error archiving product:', error);
        alert('Failed to archive product. Please try again.');
      }
    });
  }

  restoreProduct(product: Product) {
    const reason = prompt('Please provide a reason for restoring this product:');
    if (reason === null) return; // User cancelled

    const adminId = localStorage.getItem('id');
    const adminRole = localStorage.getItem('role') || 'moderator';

    if (!adminId) {
      alert('Admin authentication required');
      return;
    }

    const restoreData = {
      product_id: product.product_id,
      admin_id: parseInt(adminId),
      role: adminRole,
      reason: reason,
      action: 'restored'
    };

    this.apiService.archiveProduct(restoreData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          product.status = 'active';
          alert('Product restored successfully');
        } else {
          alert('Failed to restore product: ' + response.message);
        }
      },
      error: (error) => {
        console.error('Error restoring product:', error);
        alert('Failed to restore product. Please try again.');
      }
    });
  }

  viewImages(product: Product) {
    this.selectedProduct = product;
    this.previewImages = product.product_images || [];
    this.currentImageIndex = 0;
    this.showImagePreview = true;
    document.body.style.overflow = 'hidden';
  }

  closeImagePreview() {
    this.showImagePreview = false;
    this.selectedProduct = null;
    this.previewImages = [];
    this.currentImageIndex = 0;
    document.body.style.overflow = 'auto';
  }

  nextImage() {
    if (this.previewImages.length > 1) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.previewImages.length;
    }
  }

  prevImage() {
    if (this.previewImages.length > 1) {
      this.currentImageIndex = this.currentImageIndex === 0 
        ? this.previewImages.length - 1 
        : this.currentImageIndex - 1;
    }
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    return `${this.apiService.baseUrl}${imagePath}`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'primary';
      case 'archived': return 'warn';
      default: return 'accent';
    }
  }

  getSaleStatusColor(saleStatus: string): string {
    switch (saleStatus) {
      case 'available': return 'primary';
      case 'sold': return 'accent';
      default: return 'warn';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatPrice(price: number): string {
    return '₱' + price.toLocaleString();
  }
}
