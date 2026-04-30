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
import { MatBadgeModule } from '@angular/material/badge';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ApiService } from '../api/api.service';
import { ProfileImageService } from '../services/profile-image.service';
import { environment } from '../../environments/environment';

interface Product {
  product_id: number;
  product_name: string;
  brand_name?: string;
  custom_brand?: string;
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
  sale_status: 'available' | 'sold' | 'reserved' | 'traded';
  created_at: string;
  uploader_id: number;
  seller_name?: string;
  seller_email?: string;
  seller_profile_image?: string;
  specifications?: any[];
  buyer_name?: string;
  buyer_user_id?: number;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_profile_image?: string;
}

interface UserRatingSummary {
  averageStars: number;
  totalRatings: number;
}

@Component({
  selector: 'app-listing-monitoring',
  imports: [
    SidenavComponent,
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
    MatTooltipModule,
    MatBadgeModule
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
  statusQuery = 'all';

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  
  // Pagination settings
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];
  
  displayedColumns: string[] = [
    'product_name',
    'seller',
    'buyer',
    'status',
    'sale_status',
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

  // Description & Specifications modal
  showDescriptionModal = false;
  selectedDescriptionProduct: Product | null = null;
  editDescription = '';
  editSpecifications: any[] = [];
  isUpdatingDescription = false;

  // View-only modal
  showViewOnlyModal = false;
  selectedViewProduct: Product | null = null;
  currentMediaType: 'image' | 'video' = 'image';

  // Success modal
  showSuccessModal = false;
  successMessage = '';
  successTitle = '';

  // Buyer information cache
  buyerInfoCache: { [productId: number]: any } = {};
  loadingBuyerInfo: { [productId: number]: boolean } = {};

  // User rating cache (seller and buyer)
  ratingInfoCache: { [userId: number]: UserRatingSummary } = {};
  loadingRatingInfo: { [userId: number]: boolean } = {};

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private profileImageService: ProfileImageService
  ) {}

  private getAdminId(): number | null {
    const adminIdString = localStorage.getItem('admin_id');
    if (adminIdString) {
      const parsed = parseInt(adminIdString, 10);
      if (!isNaN(parsed)) return parsed;
    }

    const adminUser = localStorage.getItem('admin_user');
    if (adminUser) {
      try {
        const parsed = JSON.parse(adminUser);
        const id = parsed?.admin_id || parsed?.id;
        if (id) {
          const parsedId = parseInt(String(id), 10);
          if (!isNaN(parsedId)) return parsedId;
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

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
    // Set up paginator and sort after view initializes
    // Will be reconnected when data loads due to *ngIf condition
    this.connectPaginatorAndSort();
  }

  private connectPaginatorAndSort() {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.pageSize = this.pageSize;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
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
          
          // Load buyer information for sold/traded products
          this.products.forEach(product => {
            if (product.sale_status === 'sold' || product.sale_status === 'traded') {
              this.loadBuyerInfo(product.product_id);
            }
          });
          
          // Reconnect paginator after data loads and view updates
          setTimeout(() => this.connectPaginatorAndSort(), 0);
        } else {
        }
      },
      error: (error) => {
        this.isLoading = false;
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
      alert('Please provide a reason for archiving this product');
      return;
    }

    const adminId = this.getAdminId();
    const adminRole = localStorage.getItem('role') || 'moderator';

    if (!adminId) {
      alert('Admin authentication required');
      return;
    }

    const archiveData = {
      product_id: this.productToArchive.product_id,
      admin_id: adminId,
      role: adminRole,
      reason: this.archiveReason.trim(),
      action: 'archived'
    };

    this.apiService.archiveProduct(archiveData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          // Remove the product from the table immediately without page refresh
          this.products = this.products.filter(p => p.product_id !== this.productToArchive!.product_id);
          this.dataSource.data = this.products;
          
          this.closeArchiveModal();
          this.showSuccessMessage('Product Archived Successfully', 
            `The product has been archived and the uploader has been notified about the reason.`);
        } else {
          alert('Failed to archive product: ' + response.message);
        }
      },
      error: (error) => {
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
      alert('Please provide a reason for restoring this product');
      return;
    }

    const adminId = this.getAdminId();
    const adminRole = localStorage.getItem('role') || 'moderator';

    if (!adminId) {
      alert('Admin authentication required');
      return;
    }

    const restoreData = {
      product_id: this.productToRestore.product_id,
      admin_id: adminId,
      role: adminRole,
      reason: this.restoreReason.trim(),
      action: 'restored'
    };

    this.apiService.archiveProduct(restoreData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          // Update the product status in the list
          this.productToRestore!.status = 'active';
          const productName = this.productToRestore!.product_name;
          this.closeRestoreModal();
          
          // Show success modal instead of alert
          this.successTitle = 'âœ… Product Restored Successfully';
          this.successMessage = `The product "${productName}" has been restored and is now active. The seller has been notified via notification.`;
          this.showSuccessModal = true;
        } else {
          alert('Failed to restore product: ' + response.message);
        }
      },
      error: (error) => {
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
    if (!imagePath) {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }

    if (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    let cleanPath = imagePath.replace(/^\/+/, '');
    cleanPath = cleanPath.replace(/^api\//, '');
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/^api[\/\\]uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  getVideoUrl(videoPath: string): string {
    if (!videoPath) {
      return '';
    }

    if (videoPath.startsWith('data:') || videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
      return videoPath;
    }

    let cleanPath = videoPath.replace(/^\/+/, '');
    cleanPath = cleanPath.replace(/^api\//, '');
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/^api[\/\\]uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
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
  // Format specification names: replace underscores with spaces and capitalize
  formatSpecName(specName: string): string {
    if (!specName) return '';
    return specName
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
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
    // Reset to first page when searching
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  applyFilters() {
    this.dataSource.data = this.products.filter(product => {
      const statusQueryMatch =
        this.statusQuery === 'all' ||
        product.status === this.statusQuery ||
        product.sale_status === this.statusQuery;
      const typeMatch = this.typeFilter === 'all' || product.for_type === this.typeFilter;
      return statusQueryMatch && typeMatch;
    });
    
    // Apply search filter if exists
    if (this.searchTerm) {
      this.dataSource.filter = this.searchTerm.trim().toLowerCase();
    }
    
    // Reset to first page when filters change
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  onStatusQueryChange() {
    this.applyFilters();
  }

  onTypeFilterChange() {
    this.applyFilters();
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatPrice(price: number): string {
    return price.toLocaleString();
  }

  clearFilters() {
    this.searchTerm = '';
    this.statusQuery = 'all';
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

  // Get seller profile image URL
  getSellerProfileImageUrl(profileImage: string | null | undefined): string {
    return this.profileImageService.getUserProfileImageUrl(profileImage, 'S');
  }

  // Handle product image errors
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = 'https://via.placeholder.com/150?text=No+Image';
    }
  }

  // Handle seller profile image errors
  onSellerImageError(event: any): void {
    this.profileImageService.onImageError(event, 'seller');
  }

  // Description & Specifications Modal Methods
  viewDescriptionSpecifications(product: Product): void {
    this.selectedDescriptionProduct = product;
    this.editDescription = product.description || '';
    
    // Parse specifications if they exist
    if (product.specifications && Array.isArray(product.specifications)) {
      this.editSpecifications = [...product.specifications];
    } else {
      this.editSpecifications = [];
    }
    
    this.showDescriptionModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeDescriptionModal(): void {
    this.showDescriptionModal = false;
    this.selectedDescriptionProduct = null;
    this.editDescription = '';
    this.editSpecifications = [];
    this.isUpdatingDescription = false;
    document.body.style.overflow = 'auto';
  }

  addSpecification(): void {
    this.editSpecifications.push({
      spec_name: '',
      spec_value: ''
    });
  }

  removeSpecification(index: number): void {
    this.editSpecifications.splice(index, 1);
  }

  saveDescriptionSpecifications(): void {
    if (!this.selectedDescriptionProduct) return;

    this.isUpdatingDescription = true;

    // Prepare the update data
    const updateData = {
      product_id: this.selectedDescriptionProduct.product_id,
      uploader_id: this.selectedDescriptionProduct.uploader_id,
      product_name: this.selectedDescriptionProduct.product_name,
      brand_name: this.selectedDescriptionProduct.brand_name || 'no brand',
      custom_brand: this.selectedDescriptionProduct.custom_brand || null,
      price: this.selectedDescriptionProduct.price,
      description: this.editDescription,
      location: this.selectedDescriptionProduct.location,
      for_type: this.selectedDescriptionProduct.for_type,
      condition: this.selectedDescriptionProduct.condition,
      category: this.selectedDescriptionProduct.category,
      quantity: this.selectedDescriptionProduct.quantity,
      product_images: JSON.stringify(this.selectedDescriptionProduct.product_images || []),
      product_videos: JSON.stringify(this.selectedDescriptionProduct.product_videos || []),
      specifications: this.editSpecifications.filter(spec => 
        spec.spec_name.trim() !== '' && spec.spec_value.trim() !== ''
      )
    };

    this.apiService.updateProduct(updateData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          // Update the product in the local array
          const productIndex = this.products.findIndex(p => p.product_id === this.selectedDescriptionProduct!.product_id);
          if (productIndex !== -1) {
            this.products[productIndex].description = this.editDescription;
            this.products[productIndex].specifications = updateData.specifications;
          }
          
          // Refresh the table data
          this.dataSource.data = [...this.products];
          
          // Show success message (you might want to add a snackbar service)
          
          this.closeDescriptionModal();
        } else {
          this.isUpdatingDescription = false;
        }
      },
      error: (error) => {
        this.isUpdatingDescription = false;
      }
    });
  }

  // View-Only Modal Methods
  viewDescriptionSpecificationsReadOnly(product: Product): void {
    this.selectedViewProduct = product;
    this.loadUserRating(product.uploader_id);

    if (product.sale_status === 'sold' || product.sale_status === 'traded') {
      this.loadBuyerInfo(product.product_id);
      if (product.buyer_user_id) {
        this.loadUserRating(product.buyer_user_id);
      }
    }

    this.showViewOnlyModal = true;
    this.currentImageIndex = 0;
    this.currentVideoIndex = 0;
    // Set initial media type based on what's available
    if (product.product_images && product.product_images.length > 0) {
      this.currentMediaType = 'image';
    } else if (product.product_videos && product.product_videos.length > 0) {
      this.currentMediaType = 'video';
    }
    document.body.style.overflow = 'hidden';
  }

  closeViewOnlyModal(): void {
    this.showViewOnlyModal = false;
    this.selectedViewProduct = null;
    this.currentImageIndex = 0;
    this.currentVideoIndex = 0;
    this.currentMediaType = 'image';
    document.body.style.overflow = 'auto';
  }

  // Modal Image Navigation Methods
  nextModalImage(): void {
    if (this.selectedViewProduct && this.selectedViewProduct.product_images) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.selectedViewProduct.product_images.length;
    }
  }

  prevModalImage(): void {
    if (this.selectedViewProduct && this.selectedViewProduct.product_images) {
      this.currentImageIndex = this.currentImageIndex === 0 
        ? this.selectedViewProduct.product_images.length - 1 
        : this.currentImageIndex - 1;
    }
  }

  // Modal Video Navigation Methods
  nextModalVideo(): void {
    if (this.selectedViewProduct && this.selectedViewProduct.product_videos) {
      this.currentVideoIndex = (this.currentVideoIndex + 1) % this.selectedViewProduct.product_videos.length;
    }
  }

  prevModalVideo(): void {
    if (this.selectedViewProduct && this.selectedViewProduct.product_videos) {
      this.currentVideoIndex = this.currentVideoIndex === 0 
        ? this.selectedViewProduct.product_videos.length - 1 
        : this.currentVideoIndex - 1;
    }
  }

  // Success Modal Methods
  showSuccessMessage(title: string, message: string): void {
    this.successTitle = title;
    this.successMessage = message;
    this.showSuccessModal = true;
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.successTitle = '';
    this.successMessage = '';
  }

  /**
   * Load buyer information for a sold/traded product
   */
  loadBuyerInfo(productId: number): void {
    if (this.buyerInfoCache[productId] || this.loadingBuyerInfo[productId]) {
      return; // Already loaded or loading
    }

    this.loadingBuyerInfo[productId] = true;

    this.apiService.getProductBuyer(productId).subscribe({
      next: (response) => {
        this.loadingBuyerInfo[productId] = false;
        if (response.status === 'success' && response.data) {
          this.buyerInfoCache[productId] = response.data;
          
          // Update the product with buyer information
          const product = this.products.find(p => p.product_id === productId);
          if (product) {
            product.buyer_name = response.data.buyer_name;
            product.buyer_user_id = response.data.buyer_user_id;
            product.buyer_email = response.data.buyer_email;
            product.buyer_phone = response.data.buyer_phone;
            product.buyer_profile_image = response.data.buyer_profile_image;
          }

          if (response.data.buyer_user_id) {
            this.loadUserRating(response.data.buyer_user_id);
          }
          
          // Update data source to refresh table
          this.dataSource.data = [...this.products];
        }
      },
      error: (error) => {
        this.loadingBuyerInfo[productId] = false;
      }
    });
  }

  /**
   * Get buyer information for display
   */
  getBuyerInfo(productId: number): any {
    return this.buyerInfoCache[productId] || null;
  }

  /**
   * Check if buyer info is loading
   */
  isBuyerInfoLoading(productId: number): boolean {
    return this.loadingBuyerInfo[productId] || false;
  }

  /**
   * Get buyer avatar or generate initials
   */
  getBuyerAvatar(buyer: any): string {
    if (buyer && buyer.buyer_profile_image) {
      const imagePath = buyer.buyer_profile_image.replace(/^uploads[\/\\]/, '');
      return `${environment.apiUploadsBaseUrl}${imagePath}`;
    }
    return this.generateAvatarUrl(buyer?.buyer_name || 'Unknown Buyer');
  }

  /**
   * Generate avatar URL from name
   */
  private generateAvatarUrl(name: string): string {
    const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899'];
    const initials = name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&bold=true&size=128`;
  }

  /**
   * Handle buyer image load error
   */
  onBuyerImageError(event: any, buyer: any) {
    // Fallback to generated avatar
    event.target.src = this.generateAvatarUrl(buyer?.buyer_name || 'Unknown Buyer');
  }

  getBuyerDisplayInfo(product: Product | null): any {
    if (!product) return null;

    const cachedBuyer = this.getBuyerInfo(product.product_id);
    if (cachedBuyer) return cachedBuyer;

    if (product.buyer_name) {
      return {
        buyer_name: product.buyer_name,
        buyer_user_id: product.buyer_user_id,
        buyer_email: product.buyer_email,
        buyer_phone: product.buyer_phone,
        buyer_profile_image: product.buyer_profile_image
      };
    }

    return null;
  }

  loadUserRating(userId?: number): void {
    if (!userId || this.ratingInfoCache[userId] || this.loadingRatingInfo[userId]) {
      return;
    }

    this.loadingRatingInfo[userId] = true;

    this.apiService.getUserAverageRatings(userId).subscribe({
      next: (response) => {
        this.loadingRatingInfo[userId] = false;

        if (response.status === 'success' && response.data && response.data.length > 0) {
          const ratingData = response.data[0];
          this.ratingInfoCache[userId] = {
            averageStars: parseFloat(ratingData.average_stars) || 0,
            totalRatings: parseInt(ratingData.total_ratings, 10) || 0
          };
        } else {
          this.ratingInfoCache[userId] = { averageStars: 0, totalRatings: 0 };
        }
      },
      error: () => {
        this.loadingRatingInfo[userId] = false;
        this.ratingInfoCache[userId] = { averageStars: 0, totalRatings: 0 };
      }
    });
  }

  getUserRating(userId?: number): UserRatingSummary {
    if (!userId) return { averageStars: 0, totalRatings: 0 };
    return this.ratingInfoCache[userId] || { averageStars: 0, totalRatings: 0 };
  }

  isUserRatingLoading(userId?: number): boolean {
    if (!userId) return false;
    return this.loadingRatingInfo[userId] || false;
  }

  getRatingStarIcon(rating: number, starIndex: number): string {
    if (rating >= starIndex) return 'star';
    if (rating >= starIndex - 0.5) return 'star_half';
    return 'star_border';
  }
}
