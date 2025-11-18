import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';
import { NotificationService } from '../../services/notification.service';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';

export interface UserReport {
  user_report_id: number;
  reporter_id: number;
  reported_user_id: number;
  conversation_id?: number;
  product_id?: number;
  report_type: 'user_behavior' | 'post_purchase_concern';
  reason_type: 'rude behavior' | 'harassment' | 'threats' | 'scamming attempt' | 'spam messages' | 'refund issue' | 'item not as described' | 'damaged item' | 'others';
  reason_details?: string;
  explanation?: string;
  message_reference?: string;
  proof_files?: string;
  status: 'pending' | 'reviewed' | 'action_taken';
  created_at: string;
  reporter_name?: string;
  reported_user_name?: string;
  reporter_email?: string;
  reported_user_email?: string;
  reporter_profile_image?: string;
  reported_user_profile_image?: string;
  product_name?: string;
  product_images?: string;
  product_price?: number;
  conversation_product_id?: number;
}

export interface UserReportStatistics {
  pending: number;
  reviewed: number;
  action_taken: number;
  total: number;
}

@Component({
  selector: 'app-user-report-monitoring',
  imports: [CommonModule, FormsModule, AdminSidenavComponent],
  templateUrl: './user-report-monitoring.component.html',
  styleUrl: './user-report-monitoring.component.css'
})
export class UserReportMonitoringComponent implements OnInit {
  // Data properties
  reports: UserReport[] = [];
  filteredReports: UserReport[] = [];
  paginatedReports: UserReport[] = [];
  statistics: UserReportStatistics = {
    pending: 0,
    reviewed: 0,
    action_taken: 0,
    total: 0
  };

  // Filter properties
  searchTerm: string = '';
  statusFilter: string = '';
  reportTypeFilter: string = '';

  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 10;

  // UI state properties
  isLoading: boolean = false;
  isUpdatingStatus: boolean = false;
  selectedReport: UserReport | null = null;
  previewImage: string | null = null;
  imageLoadError: boolean = false;

  // Math object for template
  Math = Math;

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadUserReports();
  }

  loadUserReports() {
    this.isLoading = true;
    
    this.apiService.getAllUserReports().subscribe({
      next: (response: any) => {
        console.log('User reports response:', response);
        if (response.status === 'success' && response.data) {
          this.reports = response.data;
          this.filteredReports = [...this.reports];
          this.calculateStatistics();
          this.updatePagination();
        } else {
          console.error('Failed to load user reports:', response.message);
          this.notificationService.showError('Failed to load user reports');
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading user reports:', error);
        this.notificationService.showError('Error loading user reports');
        this.isLoading = false;
      }
    });
  }

  calculateStatistics() {
    this.statistics = {
      pending: this.reports.filter(r => r.status === 'pending').length,
      reviewed: this.reports.filter(r => r.status === 'reviewed').length,
      action_taken: this.reports.filter(r => r.status === 'action_taken').length,
      total: this.reports.length
    };
  }

  onSearchChange() {
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    this.filteredReports = this.reports.filter(report => {
      const matchesSearch = !this.searchTerm || 
        report.reporter_name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        report.reported_user_name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        report.reason_type.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        report.reason_details?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter || report.status === this.statusFilter;
      const matchesReportType = !this.reportTypeFilter || report.report_type === this.reportTypeFilter;

      return matchesSearch && matchesStatus && matchesReportType;
    });

    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedReports = this.filteredReports.slice(startIndex, endIndex);
  }

  changePage(page: number) {
    const maxPages = Math.ceil(this.filteredReports.length / this.itemsPerPage);
    if (page >= 1 && page <= maxPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  viewReportDetails(report: UserReport) {
    this.selectedReport = report;
  }

  closeReportDetails() {
    this.selectedReport = null;
  }

  openImagePreview(imageUrl: string) {
    this.previewImage = imageUrl;
    this.imageLoadError = false;
  }

  closeImagePreview() {
    this.previewImage = null;
    this.imageLoadError = false;
  }

  onImageError(event: any) {
    console.error('Failed to load image:', this.previewImage);
    this.imageLoadError = true;
  }

  updateReportStatus(reportId: number, newStatus: 'reviewed' | 'action_taken') {
    this.isUpdatingStatus = true;

    const updateData = {
      user_report_id: reportId,
      status: newStatus
    };

    this.apiService.updateUserReportStatus(updateData).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          // Update local data
          const reportIndex = this.reports.findIndex(r => r.user_report_id === reportId);
          if (reportIndex !== -1) {
            this.reports[reportIndex].status = newStatus;
            this.applyFilters();
            this.calculateStatistics();
          }

          // Update selected report if it's the one being updated
          if (this.selectedReport?.user_report_id === reportId) {
            this.selectedReport.status = newStatus;
          }

          this.notificationService.showSuccess(`Report status updated to ${this.formatStatus(newStatus)}`);
        } else {
          this.notificationService.showError('Failed to update report status');
        }
        this.isUpdatingStatus = false;
      },
      error: (error: any) => {
        console.error('Error updating report status:', error);
        this.notificationService.showError('Error updating report status');
        this.isUpdatingStatus = false;
      }
    });
  }

  // Utility methods
  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  formatReportType(type: string): string {
    switch (type) {
      case 'user_behavior': return 'User Behavior';
      case 'post_purchase_concern': return 'Post Purchase Concern';
      default: return type;
    }
  }

  formatReasonType(reason: string): string {
    switch (reason) {
      case 'rude behavior': return 'Rude Behavior';
      case 'harassment': return 'Harassment';
      case 'threats': return 'Threats';
      case 'scamming attempt': return 'Scamming Attempt';
      case 'spam messages': return 'Spam Messages';
      case 'refund issue': return 'Refund Issue';
      case 'item not as described': return 'Item Not As Described';
      case 'damaged item': return 'Damaged Item';
      case 'others': return 'Others';
      default: return reason;
    }
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'reviewed': return 'Reviewed';
      case 'action_taken': return 'Action Taken';
      default: return status;
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }

  getReportTypeClass(type: string): string {
    switch (type) {
      case 'user_behavior': return 'bg-red-100 text-red-800';
      case 'post_purchase_concern': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'reviewed': return 'bg-blue-100 text-blue-800';
      case 'action_taken': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  formatMessageReference(messageRef: string | undefined): string {
    if (!messageRef) return 'No message reference';
    try {
      const parsed = JSON.parse(messageRef);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return messageRef;
    }
  }

  getProofFiles(proofFiles: string | undefined): string[] {
    if (!proofFiles) return [];
    try {
      const parsed = JSON.parse(proofFiles);
      const files = Array.isArray(parsed) ? parsed : [];
      // Convert relative paths to full URLs
      return files.map(file => this.getImageUrl(file));
    } catch {
      return [];
    }
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // If it's a base64 image, return as is
    if (imagePath.startsWith('data:image/')) {
      return imagePath;
    }
    
    // Clean the path - remove leading 'uploads/' if present
    let cleanPath = imagePath;
    if (cleanPath.startsWith('uploads/')) {
      cleanPath = cleanPath.substring(8);
    }
    
    // Construct full URL from relative path
    const baseUrl = this.apiService.baseUrl.replace('/api/', '');
    return `${baseUrl}uploads/${cleanPath}`;
  }

  getProfileImageUrl(profileImage: string | undefined | null): string {
    if (!profileImage) {
      // Return default avatar SVG
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNGM0Y0RjYiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iIzlDQTNBRiIvPgo8cGF0aCBkPSJNMjAgMjRjLTUuNTIzIDAtMTAgMi4yMzktMTAgNXY1aDIwdi01YzAtMi43NjEtNC40NzctNS0xMC01eiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
    }
    return this.getImageUrl(profileImage);
  }

  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }

  getStatusSummary(): string {
    const pending = this.statistics.pending;
    const reviewed = this.statistics.reviewed;
    const actionTaken = this.statistics.action_taken;
    
    if (pending > 0) {
      return `${pending} pending review`;
    } else if (reviewed > 0) {
      return `${reviewed} under review`;
    } else if (actionTaken > 0) {
      return 'All reports processed';
    } else {
      return 'No active reports';
    }
  }

  onImageLoadError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      // Set a fallback broken image icon
      imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTZMMTAuNTg2IDkuNDE0QTIgMiAwIDAxMTMuNDE0IDkuNDE0TDE2IDE2TTEwIDEwSDEwLjAxTTYgMjBIMTJBMiAyIDAgMDAyMCAxOFY2QTIgMiAwIDAwMTggNEg2QTIgMiAwIDAwNCA2VjE4QTIgMiAwIDAwNiAyMFoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHN2Zz4K';
      imgElement.classList.add('opacity-50');
      imgElement.title = 'Failed to load image';
    }
  }

  onProfileImageError(event: any) {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      // Set default avatar
      imgElement.src = this.getProfileImageUrl(null);
      imgElement.title = 'Default avatar';
    }
  }

  onImageLoad(event: any) {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement && imgElement.parentElement) {
      // Remove loading placeholder
      const loadingElement = imgElement.parentElement.querySelector('.animate-pulse');
      if (loadingElement) {
        loadingElement.remove();
      }
    }
  }

  getProductImageUrl(productImages: string | null | undefined): string {
    // Handle null, undefined, empty string cases
    if (!productImages || productImages === null || productImages === undefined || productImages === '') {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png'; // Default product image
    }

    try {
      let images: any;
      
      // If it's already an array, use it directly
      if (Array.isArray(productImages)) {
        images = productImages;
      } else if (typeof productImages === 'string') {
        // Check if it looks like JSON (starts with [ or ")
        if (productImages.trim().startsWith('[') || productImages.trim().startsWith('"')) {
          // Try to parse as JSON string
          images = JSON.parse(productImages);
        } else {
          // It's a plain string path, treat as single image
          images = [productImages];
        }
      }
      
      if (Array.isArray(images) && images.length > 0) {
        const firstImage = images[0];
        return this.getImageUrl(firstImage);
      }
    } catch (e) {
      console.error('Error parsing product images:', e);
      
      // If JSON parsing failed but we have a string, try to use it as a direct path
      if (typeof productImages === 'string' && productImages.length > 0) {
        return this.getImageUrl(productImages);
      }
    }

    return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png'; // Fallback
  }
}
