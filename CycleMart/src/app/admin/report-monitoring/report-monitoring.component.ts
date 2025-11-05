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
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';
import { ProfileImageService } from '../../services/profile-image.service';

export interface Report {
  report_id: number;
  reporter_id: number;
  reported_user_id?: number;
  product_id?: number;
  product_images?: string;
  product_description?: string;
  reason_type: 'scam' | 'fake product' | 'spam' | 'inappropriate content' | 'misleading information' | 'stolen item' | 'others';
  reason_details?: string;
  proof?: string | null; // JSON string of proof files from database or plain string paths
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
  reviewed_by_name?: string;
}

@Component({
  selector: 'app-report-monitoring',
  imports: [
    CommonModule,
    AdminSidenavComponent,
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
    'reason_type',
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
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.setupCustomFilter();
  }

  loadReports(): void {
    this.loading = true;
    this.error = null;

    console.log('🔄 Loading reports...');

    this.apiService.getAllReports().subscribe({
      next: (response) => {
        this.loading = false;
        console.log('📥 Received API response:', response);
        
        if (response.status === 'success') {
          this.dataSource.data = response.data || [];
          console.log('✅ Reports loaded successfully:', this.dataSource.data.length, 'reports');
          
          // Debug proof data in reports
          const reportsWithProof = this.dataSource.data.filter(report => report.proof);
          console.log('🔍 Reports with proof data:', reportsWithProof.length);
          
          reportsWithProof.forEach((report, index) => {
            console.log(`📎 Report ${report.report_id} proof:`, {
              type: typeof report.proof,
              value: report.proof,
              length: report.proof?.length || 0,
              firstChars: typeof report.proof === 'string' ? report.proof.substring(0, 100) : 'Not a string'
            });
            
            // Test the getProofFileUrls method for this report
            const urls = this.getProofFileUrls(report.proof);
            console.log(`🔗 Generated URLs for report ${report.report_id}:`, urls);
          });
        } else {
          this.error = response.message || 'Failed to load reports';
          this.showSnackBar('Failed to load reports', 'error');
          console.error('❌ API returned error:', response);
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error loading reports';
        console.error('❌ HTTP Error loading reports:', error);
        this.showSnackBar('Error loading reports', 'error');
      }
    });
  }

  setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Report, filter: string) => {
      const searchTerm = this.searchFilter.toLowerCase();
      const statusMatch = !this.statusFilter || data.status === this.statusFilter;
      const reasonMatch = !this.reasonTypeFilter || data.reason_type === this.reasonTypeFilter;
      
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

  updateReportStatus(report: Report, newStatus: string): void {
    const adminId = this.getAdminId();
    
    // Debug logging
    console.log('Admin authentication check:');
    console.log('- admin_id from localStorage:', localStorage.getItem('admin_id'));
    console.log('- admin_user from localStorage:', localStorage.getItem('admin_user'));
    console.log('- Extracted admin ID:', adminId);
    
    if (!adminId) {
      this.showSnackBar('Admin authentication required. Please log in again.', 'error');
      return;
    }

    const updateData = {
      report_id: report.report_id,
      status: newStatus,
      reviewed_by: adminId
    };

    console.log('Sending update request:', updateData);

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
        console.error('Error updating report status:', error);
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
        console.error('Error parsing admin_user from localStorage:', e);
      }
    }

    console.error('No admin ID found in localStorage');
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
        return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
      }
    } catch (e) {
      console.error('Error parsing product images:', e);
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
    
    // Enhanced debug logging
    console.log('Processing proof data:', { 
      originalType: typeof proof, 
      originalValue: proof,
      validatedValue: validatedProof,
      length: validatedProof.length,
      firstChars: validatedProof.substring(0, 100) + (validatedProof.length > 100 ? '...' : '')
    });
    
    try {
      // First, try to parse as JSON
      const proofArray = JSON.parse(validatedProof);
      if (Array.isArray(proofArray)) {
        const urls = proofArray.map(path => {
          // Ensure path is a string and clean it
          let cleanPath = typeof path === 'string' ? path.trim() : String(path);
          
          // Remove any escaped slashes that might come from JSON encoding
          cleanPath = cleanPath.replace(/\\\//g, '/');
          
          // Check if path already includes the full URL or just needs the base URL
          if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
            return cleanPath;
          }
          return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/${cleanPath}`;
        });
        console.log('Successfully parsed as JSON array:', urls);
        return urls;
      } else if (typeof proofArray === 'string') {
        // Handle case where JSON contains a single string
        let cleanPath = proofArray.trim().replace(/\\\//g, '/');
        const singleUrl = cleanPath.startsWith('http://') || cleanPath.startsWith('https://') ? 
                         cleanPath : 
                         `http://localhost/CycleMart/CycleMart/CycleMart-api/api/${cleanPath}`;
        console.log('Parsed as single string:', [singleUrl]);
        return [singleUrl];
      } else {
        console.warn('Proof data is not an array or string after JSON parse:', proofArray);
      }
    } catch (error) {
      console.error('Error parsing proof JSON:', error);
      console.error('Raw proof data causing error:', {
        value: validatedProof,
        charCodes: Array.from(validatedProof).map(char => char.charCodeAt(0)).slice(0, 20)
      });
      
      // If JSON parsing fails, check if it's a plain string path
      if (validatedProof.length > 0) {
        console.log('Attempting to handle as plain string path(s)');
        
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
            return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/${cleanPath}`;
          });
          console.log('Converted string paths to URLs:', urls);
          return urls;
        }
      }
    }
    
    console.log('No valid proof URLs found');
    return [];
  }

  isProofImage(url: string): boolean {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  isProofVideo(url: string): boolean {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  getProofFileIcon(url: string): string {
    if (!url) return '❓';
    if (this.isProofImage(url)) return '🖼️';
    if (this.isProofVideo(url)) return '🎥';
    return '📁';
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
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening proof file:', error);
      this.showSnackBar('Error opening file', 'error');
    }
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
    
    console.log('Opening proof modal for report:', report.report_id, 'with files:', proofUrls);
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
      console.log('Report not found');
      return;
    }

    console.log('=== PROOF DATA DEBUG ===');
    console.log('Report ID:', reportId);
    console.log('Raw proof data:', report.proof);
    console.log('Proof data type:', typeof report.proof);
    console.log('Proof data length:', report.proof?.length || 0);
    
    if (report.proof) {
      console.log('Character codes (first 50):', 
        Array.from(report.proof.substring(0, 50)).map((char, i) => 
          `${i}: '${char}' (${char.charCodeAt(0)})`
        )
      );
      
      console.log('Has integrity issues:', this.hasProofDataIssues(report.proof));
      console.log('Parsed URLs:', this.getProofFileUrls(report.proof));
    }
    console.log('=========================');
  }

  // Debug all proof data in current reports
  debugAllProofData(): void {
    console.log('🔍 DEBUGGING ALL PROOF DATA');
    const reportsWithProof = this.dataSource.data.filter(report => report.proof);
    console.log(`Found ${reportsWithProof.length} reports with proof data`);
    
    reportsWithProof.forEach(report => {
      console.log(`\n--- Report ${report.report_id} ---`);
      console.log('Proof data:', report.proof);
      console.log('Data type:', typeof report.proof);
      console.log('Generated URLs:', this.getProofFileUrls(report.proof));
      console.log('Has issues:', this.hasProofDataIssues(report.proof));
    });
    
    this.showSnackBar(`Debugged ${reportsWithProof.length} reports with proof. Check console for details.`, 'info');
  }
}
