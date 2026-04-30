import { Component, OnInit, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ApiService } from '../api/api.service';
import { ProfileImageService } from '../services/profile-image.service';
import { environment } from '../../environments/environment';

export interface Report {
  report_id: number;
  reporter_id: number;
  reported_user_id?: number;
  product_id?: number;
  conversation_id?: number;
  report_type: 'product' | 'user_behavior' | 'post_purchase_concern';
  product_reason_type?: string; // Only for product reports
  user_reason_type?: string; // Only for user_behavior and post_purchase_concern reports
  reason_details?: string;
  explanation?: string;
  message_reference?: string; // JSON array
  proof?: string | null; // JSON array of proof files
  status: 'pending' | 'reviewed' | 'action_taken';
  created_at: string;
  reviewed_by?: number;
  reviewed_at?: string;
  // Additional fields from joins
  reporter_name?: string;
  reporter_email?: string;
  reporter_profile_image?: string;
  reported_user_name?: string;
  reported_user_email?: string;
  product_name?: string;
  product_price?: number;
  product_images?: string;
  product_description?: string;
  reviewed_by_name?: string;
}

@Component({
  selector: 'app-report-monitoring',
  imports: [
    CommonModule,
    SidenavComponent,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatCardModule,
    MatToolbarModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    FormsModule
  ],
  templateUrl: './report-monitoring.component.html',
  styleUrl: './report-monitoring.component.css'
})
export class ReportMonitoringComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'reporter_info',
    'reported_target',
    'reason_info',
    'reason_details',
    'proof',
    'status',
    'created_at',
    'reviewed_info',
    'actions'
  ];

  dataSource = new MatTableDataSource<Report>();
  loading = false;
  error: string | null = null;

  // Proof file viewing properties
  showProofModal = false;
  currentProofFiles: string[] = [];
  currentProofIndex = 0;
  currentReportId: number | null = null;

  // Filter properties
  statusFilter = '';
  reasonTypeFilter = '';
  searchFilter = '';

  // Status options
  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'action_taken', label: 'Action Taken' }
  ];

  // Reason type options
  reasonTypeOptions = [
    { value: '', label: 'All Reasons' },
    { value: 'scam', label: 'Scam/Fraud' },
    { value: 'fake product', label: 'Fake Product' },
    { value: 'spam', label: 'Spam' },
    { value: 'inappropriate content', label: 'Inappropriate Content' },
    { value: 'misleading information', label: 'Misleading Information' },
    { value: 'stolen item', label: 'Stolen Item' },
    { value: 'others', label: 'Others' }
  ];

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private profileImageService: ProfileImageService
  ) {}

  // Handle keyboard navigation in proof modal
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.showProofModal) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closeProofModal();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.previousProofFile();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextProofFile();
        break;
    }
  }

  ngOnInit(): void {
    this.loadReports();
    
    // Expose debug method to window for easy debugging
    if (typeof window !== 'undefined') {
      (window as any).debugReportProof = (reportId: number) => this.debugProofData(reportId);
    }
  }

  ngAfterViewInit(): void {
    // Set up paginator and sort after view initializes
    // Will be reconnected when data loads due to *ngIf condition
    this.connectPaginatorAndSort();
    this.setupCustomFilter();
  }

  private connectPaginatorAndSort(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  loadReports(): void {
    this.loading = true;
    this.error = null;


    this.apiService.getAllReports().subscribe({
      next: (response) => {
        this.loading = false;
        
        if (response.status === 'success') {
          this.dataSource.data = response.data || [];
          
          // Reconnect paginator after data loads and view updates
          setTimeout(() => this.connectPaginatorAndSort(), 0);
          
          // Debug proof data in reports
          const reportsWithProof = this.dataSource.data.filter(report => report.proof);
          reportsWithProof.forEach((report, index) => {
            // Test the getProofFileUrls method for this report
            const urls = this.getProofFileUrls(report.proof);
          });
        } else {
          this.error = response.message || 'Failed to load reports';
          this.showSnackBar('Failed to load reports', 'error');
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error loading reports';
        this.showSnackBar('Error loading reports', 'error');
      }
    });
  }

  setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Report, filter: string) => {
      const searchTerm = this.searchFilter.toLowerCase();
      const statusMatch = !this.statusFilter || data.status === this.statusFilter;
      const reasonMatch = !this.reasonTypeFilter || this.getReasonType(data) === this.reasonTypeFilter;
      
      const searchMatch = !searchTerm || 
        data.reporter_name?.toLowerCase().includes(searchTerm) ||
        data.reported_user_name?.toLowerCase().includes(searchTerm) ||
        data.product_name?.toLowerCase().includes(searchTerm) ||
        data.reason_details?.toLowerCase().includes(searchTerm) ||
        data.report_id.toString().includes(searchTerm);

      return statusMatch && reasonMatch && searchMatch;
    };
  }

  applyFilter(): void {
    // Trigger filter by updating filter string
    this.dataSource.filter = Math.random().toString();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.reasonTypeFilter = '';
    this.searchFilter = '';
    this.applyFilter();
  }

  get totalReportsCount(): number {
    return this.dataSource.filteredData.length;
  }

  get pendingReportsCount(): number {
    return this.dataSource.filteredData.filter(report => report.status === 'pending').length;
  }

  get reviewedReportsCount(): number {
    return this.dataSource.filteredData.filter(report => report.status === 'reviewed').length;
  }

  get actionTakenReportsCount(): number {
    return this.dataSource.filteredData.filter(report => report.status === 'action_taken').length;
  }

  updateReportStatus(report: Report, newStatus: string): void {
    const adminId = this.getAdminId();
    
    // Debug logging
    
    if (!adminId) {
      this.showSnackBar('Admin authentication required. Please log in again.', 'error');
      return;
    }

    const updateData = {
      report_id: report.report_id,
      status: newStatus,
      reviewed_by: adminId
    };


    this.apiService.updateReportStatus(updateData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.showSnackBar(`Report status updated to ${newStatus}`, 'success');
          this.loadReports(); // Reload to get updated data
        } else {
          this.showSnackBar(response.message || 'Failed to update status', 'error');
        }
      },
      error: (error) => {
        this.showSnackBar('Error updating report status', 'error');
      }
    });
  }

  getAdminId(): number | null {
    // First try to get from direct admin_id localStorage
    const adminIdString = localStorage.getItem('admin_id');
    if (adminIdString) {
      const adminId = parseInt(adminIdString);
      if (!isNaN(adminId)) {
        return adminId;
      }
    }

    // Fallback to parsing from admin_user JSON
    const adminUser = localStorage.getItem('admin_user');
    if (adminUser) {
      try {
        const parsed = JSON.parse(adminUser);
        if (parsed && (parsed.admin_id || parsed.id)) {
          return parsed.admin_id || parsed.id;
        }
      } catch (e) {
      }
    }

    return null;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'reviewed':
        return 'status-reviewed';
      case 'action_taken':
        return 'status-action-taken';
      default:
        return '';
    }
  }

  getReasonTypeIcon(reasonType: string): string {
    const icons: { [key: string]: string } = {
      'scam': 'warning',
      'fake product': 'block',
      'spam': 'mail',
      'inappropriate content': 'visibility_off',
      'misleading information': 'error',
      'stolen item': 'security',
      'others': 'help'
    };
    return icons[reasonType] || 'help';
  }

  getProductImageUrl(productImages: string | null): string {
    if (!productImages) {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }

    try {
      let images: any;
      
      if (Array.isArray(productImages)) {
        images = productImages;
      } else if (typeof productImages === 'string') {
        if (productImages.trim().startsWith('[')) {
          images = JSON.parse(productImages);
        } else {
          images = [productImages];
        }
      }
      
      if (Array.isArray(images) && images.length > 0) {
        const firstImage = images[0];
        const cleanImageName = firstImage.replace(/^uploads[\/\\]/, '');
        return `${environment.apiUploadsBaseUrl}${cleanImageName}`;
      }
    } catch (e) {
    }

    return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  truncateText(text: string | null, maxLength: number = 50): string {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  showSnackBar(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  refreshReports(): void {
    this.loadReports();
  }

  exportReports(): void {
    // TODO: Implement export functionality
    this.showSnackBar('Export feature coming soon!', 'info');
  }

  onImageError(event: any): void {
    if (event.target) {
      event.target.src = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }
  }

  // Handle reporter profile image errors
  onReporterImageError(event: any): void {
    this.profileImageService.onImageError(event, 'reporter');
  }

  // Get user profile image URL
  getUserProfileImageUrl(profileImage: string | null | undefined): string {
    return this.profileImageService.getUserProfileImageUrl(profileImage, 'R');
  }

  // Action button functions
  markAsReviewed(report: Report): void {
    if (report.status === 'reviewed') {
      this.showSnackBar('Report is already marked as reviewed', 'info');
      return;
    }
    this.updateReportStatus(report, 'reviewed');
  }

  markAsActionTaken(report: Report): void {
    if (report.status === 'action_taken') {
      this.showSnackBar('Action has already been taken on this report', 'info');
      return;
    }
    this.updateReportStatus(report, 'action_taken');
  }

  resetToPending(report: Report): void {
    if (report.status === 'pending') {
      this.showSnackBar('Report is already in pending status', 'info');
      return;
    }
    this.updateReportStatus(report, 'pending');
  }

  // Proof file handling methods
  
  private validateProofData(proof: string | null | undefined): string | null {
    if (!proof || typeof proof !== 'string' || proof.trim().length === 0) {
      return null;
    }
    
    // Remove any potential null characters or invalid characters
    return proof.trim().replace(/\0/g, '');
  }
  
  getProofFileUrls(proof: string | null | undefined): string[] {
    const validatedProof = this.validateProofData(proof);
    if (!validatedProof) return [];
    
    try {
      // First, try to parse as JSON
      const proofArray = JSON.parse(validatedProof);
      if (Array.isArray(proofArray)) {
        const urls = proofArray.map(path => {
          // Ensure path is a string and clean it
          let cleanPath = typeof path === 'string' ? path.trim() : String(path);
          
          // Check if it's a base64 data URL - return as-is
          if (cleanPath.startsWith('data:')) {
            return cleanPath;
          }
          
          // Remove any escaped slashes that might come from JSON encoding
          cleanPath = cleanPath.replace(/\\\//g, '/');
          
          // Check if path already includes the full URL or just needs the base URL
          if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
            return cleanPath;
          }
          const normalized = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
          return `${environment.apiUploadsBaseUrl}${normalized}`;
        });
        return urls;
      } else if (typeof proofArray === 'string') {
        // Handle case where JSON contains a single string
        let cleanPath = proofArray.trim();
        
        // Check if it's a base64 data URL
        if (cleanPath.startsWith('data:')) {
          return [cleanPath];
        }
        
        cleanPath = cleanPath.replace(/\\\//g, '/');
        // const singleUrl = cleanPath.startsWith('http://') || cleanPath.startsWith('https://') ? 
        //                  cleanPath : 
        //                  `http://api.cyclemart.shop/CycleMart-api/api${cleanPath}`;
        
         const singleUrl = cleanPath.startsWith('http://') || cleanPath.startsWith('https://') ? 
               cleanPath : 
               `${environment.apiUploadsBaseUrl}${cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath}`;

        return [singleUrl];
      } else {
      }
    } catch (error) {
      
      // If JSON parsing fails, check if it's a plain string path
      if (validatedProof.length > 0) {
        
        // Handle case where proof might be a single file path or comma-separated paths
        const paths = validatedProof.split(',').map(p => p.trim()).filter(p => p.length > 0);
        if (paths.length > 0) {
          const urls = paths.map(path => {
            // Check if path already includes the full URL
            if (path.startsWith('http://') || path.startsWith('https://')) {
              return path;
            }
            // Ensure the path starts with uploads/ if it doesn't already have a full URL
            const cleanPath = path.startsWith('uploads/') ? path : `uploads/proof/${path}`;
            const normalized = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
            return `${environment.apiUploadsBaseUrl}${normalized}`;
          });
          return urls;
        }
      }
    }
    
    return [];
  }

  isProofImage(url: string): boolean {
    if (!url) return false;
    
    // Check if it's a base64 image data URL
    if (url.startsWith('data:image/')) {
      return true;
    }
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  isProofVideo(url: string): boolean {
    if (!url) return false;
    
    // Check if it's a base64 video data URL
    if (url.startsWith('data:video/')) {
      return true;
    }
    
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  getProofFileIcon(url: string): string {
    if (!url) return 'â“';
    if (this.isProofImage(url)) return 'ðŸ–¼ï¸';
    if (this.isProofVideo(url)) return 'ðŸŽ¥';
    return 'ðŸ“';
  }

  getProofFileType(url: string): string {
    if (!url) return 'Unknown';
    if (this.isProofImage(url)) return 'Image';
    if (this.isProofVideo(url)) return 'Video';
    return 'File';
  }

  openProofFile(url: string): void {
    if (!url) {
      this.showSnackBar('Invalid file URL', 'error');
      return;
    }
    
    try {
      // Check if it's a base64 data URL
      if (url.startsWith('data:')) {
        // For base64 data URLs, we need to download them as files
        this.downloadBase64File(url);
      } else {
        // For regular URLs, open in new tab
        window.open(url, '_blank');
      }
    } catch (error) {
      this.showSnackBar('Error opening file', 'error');
    }
  }

  // Download base64 data URL as a file
  private downloadBase64File(dataUrl: string): void {
    try {
      // Extract file type from data URL
      const matches = dataUrl.match(/^data:([^;]+);base64,/);
      if (!matches) {
        this.showSnackBar('Invalid file format', 'error');
        return;
      }

      const mimeType = matches[1];
      const extension = this.getExtensionFromMimeType(mimeType);
      const fileName = `proof_file_${Date.now()}.${extension}`;

      // Create a link element and trigger download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showSnackBar('File download started', 'success');
    } catch (error) {
      this.showSnackBar('Error downloading file', 'error');
    }
  }

  // Get file extension from MIME type
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogg',
      'application/pdf': 'pdf'
    };
    return mimeMap[mimeType] || 'file';
  }

  // Get the appropriate reason type based on report type
  getReasonType(report: Report): string {
    if (report.report_type === 'product') {
      return report.product_reason_type || 'Not specified';
    } else {
      return report.user_reason_type || 'Not specified';
    }
  }

  // Safe method to get reason type class name
  getReasonTypeClass(report: Report): string {
    const reasonType = this.getReasonType(report);
    return 'reason-' + reasonType.toLowerCase().replace(/\s+/g, '-');
  }

  // New method to view proof files in modal
  viewProofFiles(report: Report): void {
    const proofUrls = this.getProofFileUrls(report.proof);
    if (proofUrls.length === 0) {
      this.showSnackBar('No proof files available', 'info');
      return;
    }

    this.currentProofFiles = proofUrls;
    this.currentProofIndex = 0;
    this.currentReportId = report.report_id;
    this.showProofModal = true;
    
  }

  // Navigate through proof files
  previousProofFile(): void {
    if (this.currentProofIndex > 0) {
      this.currentProofIndex--;
    }
  }

  nextProofFile(): void {
    if (this.currentProofIndex < this.currentProofFiles.length - 1) {
      this.currentProofIndex++;
    }
  }

  // Close proof modal
  closeProofModal(): void {
    this.showProofModal = false;
    this.currentProofFiles = [];
    this.currentProofIndex = 0;
    this.currentReportId = null;
  }

  // Get current proof file
  getCurrentProofFile(): string {
    return this.currentProofFiles[this.currentProofIndex] || '';
  }

  // Check if current file is an image
  isCurrentFileImage(): boolean {
    return this.isProofImage(this.getCurrentProofFile());
  }

  // Check if current file is a video
  isCurrentFileVideo(): boolean {
    return this.isProofVideo(this.getCurrentProofFile());
  }

  // Handle image load error in modal
  onModalImageError(event: any): void {
    if (event.target) {
      event.target.src = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
      this.showSnackBar('Failed to load proof image', 'error');
    }
  }

  // Helper method to check if proof data has integrity issues
  hasProofDataIssues(proof: string | null | undefined): boolean {
    if (!proof) return false;
    
    const validatedProof = this.validateProofData(proof);
    if (!validatedProof) return false;
    
    try {
      JSON.parse(validatedProof);
      return false; // No issues if JSON is valid
    } catch (error) {
      // Check if it looks like corrupted JSON
      const trimmed = validatedProof.trim();
      const looksLikePartialJson = trimmed.startsWith('[') || trimmed.startsWith('{') || 
                                  trimmed.includes('uploads/') || trimmed.includes('.jpg') || 
                                  trimmed.includes('.png') || trimmed.includes('.mp4');
      return looksLikePartialJson;
    }
  }

  // Debug method to help identify data issues (can be called from browser console)
  debugProofData(reportId: number): void {
    const report = this.dataSource.data.find(r => r.report_id === reportId);
    if (!report) {
      this.showSnackBar('Report not found.', 'error');
      return;
    }

    const hasProof = !!report.proof;
    const hasIssues = hasProof ? this.hasProofDataIssues(report.proof) : false;
    const proofCount = hasProof ? this.getProofFileUrls(report.proof).length : 0;

    this.showSnackBar(
      `Report ${reportId}: proof=${hasProof ? 'yes' : 'no'}, files=${proofCount}, integrity_issues=${hasIssues ? 'yes' : 'no'}`,
      'info'
    );
  }

  // Debug all proof data in current reports
  debugAllProofData(): void {
    const reportsWithProof = this.dataSource.data.filter(report => report.proof);

    this.showSnackBar(`Debugged ${reportsWithProof.length} reports with proof. Check console for details.`, 'info');
  }
}
