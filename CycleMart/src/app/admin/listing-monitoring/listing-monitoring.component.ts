import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './listing-monitoring.component.html',
  styleUrl: './listing-monitoring.component.css'
})
export class ListingMonitoringComponent implements OnInit, AfterViewInit {
  products: Product[] = [];
  dataSource = new MatTableDataSource<Product>([]);
  isLoading = false;
  
  searchTerm = '';
  statusFilter = 'all';
  saleStatusFilter = 'all';

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  
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
    
    // Set up custom filter predicate
    this.dataSource.filterPredicate = (data: Product, filter: string) => {
      const searchTermLower = filter.toLowerCase();
      return data.product_name.toLowerCase().includes(searchTermLower) ||
             data.category.toLowerCase().includes(searchTermLower) ||
             (data.seller_name?.toLowerCase().includes(searchTermLower) ?? false) ||
             data.description.toLowerCase().includes(searchTermLower);
    };
    
    // Auto-refresh every 30 seconds to catch real-time updates
    setInterval(() => {
      this.loadAllProducts();
    }, 30000);
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
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
          this.dataSource.data = this.products;
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

  getSaleStatusText(product: Product): string {
    if (product.sale_status === 'available') {
      return 'Available';
    } else {
      // Show contextual text based on listing type
      switch (product.for_type) {
        case 'sale':
          return 'Sold';
        case 'trade':
          return 'Traded';
        case 'both':
          return 'Sold/Traded';
        default:
          return 'Sold';
      }
    }
  }

  getForTypeText(forType: string): string {
    switch (forType) {
      case 'sale': return 'For Sale';
      case 'trade': return 'For Trade';
      case 'both': return 'Sale & Trade';
      default: return forType;
    }
  }

  refreshProducts() {
    this.loadAllProducts();
  }

  applyGlobalFilter() {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase();
  }

  applyFilters() {
    this.dataSource.data = this.products.filter(product => {
      const statusMatch = this.statusFilter === 'all' || product.status === this.statusFilter;
      const saleStatusMatch = this.saleStatusFilter === 'all' || product.sale_status === this.saleStatusFilter;
      return statusMatch && saleStatusMatch;
    });
    
    // Apply search filter if exists
    if (this.searchTerm) {
      this.dataSource.filter = this.searchTerm.trim().toLowerCase();
    }
  }

  onStatusFilterChange() {
    this.applyFilters();
  }

  onSaleStatusFilterChange() {
    this.applyFilters();
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatPrice(price: number): string {
    return '₱' + price.toLocaleString();
  }
}
