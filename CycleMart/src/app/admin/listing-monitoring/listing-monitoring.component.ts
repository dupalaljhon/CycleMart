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
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminSidenavComponent } from "../admin-sidenav/admin-sidenav.component";
import { ApiService } from '../../api/api.service';

interface Product {
  product_id: number;
  product_name: string;
  product_images: string[];
  product_videos: string[];
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
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './listing-monitoring.component.html',
  styleUrl: './listing-monitoring.component.css'
})
export class ListingMonitoringComponent implements OnInit, AfterViewInit {
  typeFilter = 'all';
  
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
    'for_type',
    'condition',
    'status',
    'created_at',
    'actions'
  ];

  // Image preview
  showImagePreview = false;
  previewImages: string[] = [];
  currentImageIndex = 0;
  selectedProduct: Product | null = null;

  // Video preview
  showVideoPreview = false;
  previewVideos: string[] = [];
  currentVideoIndex = 0;
  selectedVideoProduct: Product | null = null;

  // Archive/Restore modal
  showArchiveModal = false;
  showRestoreModal = false;
  archiveReason = '';
  restoreReason = '';
  productToArchive: Product | null = null;
  productToRestore: Product | null = null;

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
              : product.product_images || [],
            product_videos: typeof product.product_videos === 'string' 
              ? JSON.parse(product.product_videos) 
              : product.product_videos || []
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
    this.productToArchive = product;
    this.archiveReason = '';
    this.showArchiveModal = true;
  }

  confirmArchive() {
    if (!this.productToArchive || !this.archiveReason.trim()) {
      return;
    }

    const adminId = localStorage.getItem('id');
    const adminRole = localStorage.getItem('role') || 'moderator';

    if (!adminId) {
      alert('Admin authentication required');
      return;
    }

    const archiveData = {
      product_id: this.productToArchive.product_id,
      admin_id: parseInt(adminId),
      role: adminRole,
      reason: this.archiveReason.trim(),
      action: 'archived'
    };

    this.apiService.archiveProduct(archiveData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.productToArchive!.status = 'archived';
          this.closeArchiveModal();
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

  closeArchiveModal() {
    this.showArchiveModal = false;
    this.productToArchive = null;
    this.archiveReason = '';
  }

  restoreProduct(product: Product) {
    this.productToRestore = product;
    this.restoreReason = '';
    this.showRestoreModal = true;
  }

  confirmRestore() {
    if (!this.productToRestore || !this.restoreReason.trim()) {
      return;
    }

    const adminId = localStorage.getItem('id');
    const adminRole = localStorage.getItem('role') || 'moderator';

    if (!adminId) {
      alert('Admin authentication required');
      return;
    }

    const restoreData = {
      product_id: this.productToRestore.product_id,
      admin_id: parseInt(adminId),
      role: adminRole,
      reason: this.restoreReason.trim(),
      action: 'restored'
    };

    this.apiService.archiveProduct(restoreData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.productToRestore!.status = 'active';
          this.closeRestoreModal();
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

  closeRestoreModal() {
    this.showRestoreModal = false;
    this.productToRestore = null;
    this.restoreReason = '';
  }

  viewImages(product: Product) {
    this.selectedProduct = product;
    this.previewImages = product.product_images || [];
    this.currentImageIndex = 0;
    this.showImagePreview = true;
    document.body.style.overflow = 'hidden';
  }

  viewVideos(product: Product) {
    this.selectedVideoProduct = product;
    this.previewVideos = product.product_videos || [];
    this.currentVideoIndex = 0;
    this.showVideoPreview = true;
    document.body.style.overflow = 'hidden';
  }

  closeImagePreview() {
    this.showImagePreview = false;
    this.selectedProduct = null;
    this.previewImages = [];
    this.currentImageIndex = 0;
    document.body.style.overflow = 'auto';
  }

  closeVideoPreview() {
    this.showVideoPreview = false;
    this.selectedVideoProduct = null;
    this.previewVideos = [];
    this.currentVideoIndex = 0;
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

  nextVideo() {
    if (this.previewVideos.length > 1) {
      this.currentVideoIndex = (this.currentVideoIndex + 1) % this.previewVideos.length;
    }
  }

  prevVideo() {
    if (this.previewVideos.length > 1) {
      this.currentVideoIndex = this.currentVideoIndex === 0 
        ? this.previewVideos.length - 1 
        : this.currentVideoIndex - 1;
    }
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    return `${this.apiService.baseUrl}${imagePath}`;
  }

  getVideoUrl(videoPath: string): string {
    if (videoPath.startsWith('data:')) {
      return videoPath;
    }
    return `${this.apiService.baseUrl}${videoPath}`;
  }

  getVideoExtension(videoPath: string): string {
    const extension = videoPath.split('.').pop()?.toLowerCase() || '';
    return extension;
  }

  getVideoType(videoPath: string): string {
    const extension = this.getVideoExtension(videoPath);
    switch (extension) {
      case 'mp4':
        return 'MP4 Video';
      case 'webm':
        return 'WebM Video';
      case 'ogg':
        return 'OGG Video';
      case 'avi':
        return 'AVI Video';
      case 'mov':
        return 'MOV Video';
      default:
        return 'Video';
    }
  }

  hasMediaContent(product: Product): boolean {
    const hasImages = product.product_images && product.product_images.length > 0;
    const hasVideos = product.product_videos && product.product_videos.length > 0;
    return hasImages || hasVideos;
  }

  getTotalMediaCount(product: Product): number {
    const imageCount = product.product_images ? product.product_images.length : 0;
    const videoCount = product.product_videos ? product.product_videos.length : 0;
    return imageCount + videoCount;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'bg-white text-black border border-gray-300';
      case 'archived': return 'bg-gray-800 text-white border border-gray-500';
      default: return 'bg-gray-400 text-black border border-gray-300';
    }
  }

  getSaleStatusColor(saleStatus: string): string {
    switch (saleStatus) {
      case 'available': return 'bg-white text-black border border-gray-300';
      case 'sold': return 'bg-gray-600 text-white border border-gray-500';
      default: return 'bg-gray-400 text-black border border-gray-300';
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
      const typeMatch = this.typeFilter === 'all' || product.for_type === this.typeFilter;
      return statusMatch && saleStatusMatch && typeMatch;
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

  onTypeFilterChange() {
    this.applyFilters();
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatPrice(price: number): string {
    return '₱' + price.toLocaleString();
  }

  clearFilters() {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.saleStatusFilter = 'all';
    this.typeFilter = 'all';
    this.dataSource.filter = '';
    this.applyFilters();
  }

  getTimeAgo(dateString: string): string {
    const now = new Date();
    const createdDate = new Date(dateString);
    const diffInMs = now.getTime() - createdDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
      }
      return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
  }
}
