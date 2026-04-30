import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../api/api.service';
import { Router } from '@angular/router';
import { SidenavComponent } from "../sidenav/sidenav.component";
import { environment } from '../../environments/environment';

export interface Report {
  report_id: number;
  reporter_id: number;
  reported_user_id?: number | null;
  product_id?: number | null;
  conversation_id?: number | null;
  
  // Report type classification
  report_type: 'product' | 'user_behavior' | 'post_purchase_concern';
  
  // Product-specific reasons
  product_reason_type?: 'scam' | 'fake product' | 'spam' | 'inappropriate content' | 'misleading information' | 'stolen item' | 'others' | null;
  
  // User behavior / Post-purchase reasons
  user_reason_type?: 'rude behavior' | 'harassment' | 'threats' | 'scamming attempt' | 'not cooperative' | 'refund issue' | 'item not as described' | 'damaged item' | 'post purchase issue' | 'others' | null;
  
  reason_details?: string | null;
  explanation?: string | null;
  
  // Message reference for conversation-related reports
  message_reference?: string | null;  // JSON string of message references
  
  proof?: string | null;  // JSON string of proof files (images/videos) from database (longtext with json_valid check)
  status: 'pending' | 'reviewed' | 'action_taken';
  created_at: string;  // timestamp from database
  reviewed_by?: number | null;
  reviewed_at?: string | null;  // timestamp from database
  
  // Extended fields from JOINs (not in actual reports table)
  reporter_name?: string;
  reporter_email?: string;
  reporter_profile_image?: string;
  reported_user_name?: string;
  reported_user_email?: string;
  reported_user_profile_image?: string;
  product_name?: string;
  product_price?: number;
  product_images?: string | null;  // Product images from JOIN
  product_description?: string | null;  // Product description from JOIN
  product_location?: string | null;
  reviewed_by_name?: string;
}

export interface ReportForm {
  reported_user_id?: number | null;
  product_id?: number | null;
  conversation_id?: number | null;
  
  // Report type classification
  report_type: 'product' | 'user_behavior' | 'post_purchase_concern';
  
  // Product-specific reasons
  product_reason_type?: 'scam' | 'fake product' | 'spam' | 'inappropriate content' | 'misleading information' | 'stolen item' | 'others' | null;
  
  // User behavior / Post-purchase reasons
  user_reason_type?: 'rude behavior' | 'harassment' | 'threats' | 'scamming attempt' | 'not cooperative' | 'refund issue' | 'item not as described' | 'damaged item' | 'post purchase issue' | 'others' | null;
  
  reason_details: string;
  
  // Legacy fields for compatibility
  target_type?: 'user' | 'product';
  target_identifier?: string;
  
  proof_files?: File[];  // Array of proof files (images/videos)
  proof?: string[];  // Array of base64 strings for proof files
}

@Component({
  selector: 'app-reports',
  imports: [
    CommonModule, 
    FormsModule, 
    SidenavComponent,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent implements OnInit {
  
  // Modal inputs and outputs
  @Input() isModal = false;
  @Input() prefilledProduct: any = null;
  @Input() prefilledUser: any = null;
  @Output() modalClosed = new EventEmitter<void>();
  @Output() reportSubmitted = new EventEmitter<any>();
  
  // Component State
  reports: Report[] = [];
  loading = false;
  currentUser: any = null;
  
  // Material Table Configuration (kept for backward compatibility)
  displayedColumns: string[] = ['product_image', 'reason_type', 'target', 'proof', 'status', 'created_at', 'actions'];
  
  // Modal State
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'success' | 'error' | 'info' = 'info';
  
  // Report Details Modal State
  showReportDetailsModal = false;
  selectedReport: Report | null = null;
  
  // Proof Modal State
  showProofModal = false;
  currentProofFiles: string[] = [];
  currentProofIndex = 0;
  currentReportId: number | null = null;
  
  // Form Data (for modal mode only)
  reportForm: ReportForm = {
    report_type: 'product',  // Default to product reporting
    product_reason_type: null,
    user_reason_type: null,
    reason_details: '',
    reported_user_id: null,
    product_id: null,
    conversation_id: null,
    target_type: 'product',  // Legacy field for compatibility
    target_identifier: '',
    proof_files: [],
    proof: []
  };
  
  // Proof file handling
  selectedProofFiles: File[] = [];
  proofPreviews: { file: File, url: string, type: 'image' | 'video' }[] = [];
  maxProofFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB
  allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/mov'];
  
  // Track product sale status for conditional post-purchase concern display
  productSaleStatus: string | null = null;
  
  // Product Report Types
  productReasonTypes = [
  { value: 'scam', label: 'Scam/Fraud', icon: '⚠️' },
  { value: 'fake product', label: 'Fake Product', icon: '🚫' },
  { value: 'spam', label: 'Spam', icon: '📧' },
  { value: 'inappropriate content', label: 'Inappropriate Content', icon: '🔞' },
  { value: 'misleading information', label: 'Misleading Information', icon: '❌' },
  { value: 'stolen item', label: 'Stolen Item', icon: '🚨' },
  { value: 'others', label: 'Others', icon: '📝' }
];

// User Behavior Report Types
userReasonTypes = [
  { value: 'rude behavior', label: 'Rude Behavior', icon: '😠' },
  { value: 'harassment', label: 'Harassment', icon: '🚨' },
  { value: 'threats', label: 'Threats', icon: '⚠️' },
  { value: 'scamming attempt', label: 'Scamming Attempt', icon: '🚫' },
  { value: 'not cooperative', label: 'Not Cooperative', icon: '❌' },
  { value: 'refund issue', label: 'Refund Issue', icon: '💰' },
  { value: 'item not as described', label: 'Item Not As Described', icon: '📝' },
  { value: 'damaged item', label: 'Damaged Item', icon: '💔' },
  { value: 'post purchase issue', label: 'Post Purchase Issue', icon: '📦' },
  { value: 'others', label: 'Others', icon: '📝' }
];
  
  // Legacy reportTypes for backward compatibility
  get reportTypes() {
    return this.productReasonTypes;
  }

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    
    this.loadCurrentUser();
    
    // If modal mode and prefilled data provided, set form accordingly
    if (this.isModal && this.prefilledProduct) {
      
      this.reportForm.report_type = 'product';
      this.reportForm.product_id = this.prefilledProduct.product_id || this.prefilledProduct.id || null;
      // Legacy compatibility
      this.reportForm.target_type = 'product';
      this.reportForm.target_identifier = this.prefilledProduct.product_id?.toString() || this.prefilledProduct.id?.toString() || '';
      
      // Store product sale_status for conditional post-purchase concern display
      this.productSaleStatus = this.prefilledProduct.sale_status || this.prefilledProduct.saleStatus || null;
      
      // Test the image URL generation immediately
      const testImageUrl = this.getProductImageUrl(this.prefilledProduct.product_images || this.prefilledProduct.productImages);
    } else if (this.isModal && this.prefilledUser) {
      this.reportForm.report_type = 'user_behavior';
      this.reportForm.reported_user_id = this.prefilledUser.id || null;
      // Legacy compatibility
      this.reportForm.target_type = 'user';
      this.reportForm.target_identifier = this.prefilledUser.id?.toString() || '';
    }
    
    // Load reports only if not in modal mode
    if (!this.isModal) {
      this.loadUserReports();
    }
    
  }

  // Load current user from localStorage
  loadCurrentUser(): void {
    
    // Check all possible localStorage keys
    const userData = localStorage.getItem('currentUser');
    const userId = localStorage.getItem('id');
    const userEmail = localStorage.getItem('email');
    const userName = localStorage.getItem('full_name');
    
    
    if (userData) {
      this.currentUser = JSON.parse(userData);
    } else {
      // Try alternative storage keys that might be used in your app
      if (userId) {
        // Create a minimal user object if we have basic info
        this.currentUser = {
          id: parseInt(userId),
          email: userEmail,
          full_name: userName
        };
      } else if (this.isModal) {
        // In modal mode, don't redirect to login, just show an error
        this.showErrorMessage('Please login to report content');
        return;
      } else {
        // Only redirect to login if not in modal mode
        this.router.navigate(['/login']);
      }
    }
    
  }

  // Submit Report (for modal mode only)
  submitReport(): void {
    
    // First check: ensure we're in modal mode (only submit in modal mode)
    if (!this.isModal) {
      return;
    }
    
    // Check if user is logged in
    if (!this.currentUser || !this.currentUser.id) {
      this.showErrorMessage('Please login to submit a report');
      return;
    }

    if (!this.validateReportForm()) {
      return;
    }

    this.loading = true;
    
    // Convert proof files to base64 if any
    this.convertProofFilesToBase64().then(proofBase64Array => {
      // Prepare report data based on new database schema
      const reportData: any = {
        reporter_id: this.currentUser.id,
        report_type: this.reportForm.report_type,
        reason_details: this.reportForm.reason_details || null,
        proof: proofBase64Array.length > 0 ? JSON.stringify(proofBase64Array) : null,  // JSON string as per database schema
        status: 'pending'  // Default status as per database
      };

      // Set reason type based on report type
      if (this.reportForm.report_type === 'product') {
        reportData.product_reason_type = this.reportForm.product_reason_type;
        reportData.user_reason_type = null;
        reportData.product_id = this.reportForm.product_id;
        reportData.reported_user_id = null;
        reportData.conversation_id = null;
      } else if (this.reportForm.report_type === 'user_behavior' || this.reportForm.report_type === 'post_purchase_concern') {
        reportData.user_reason_type = this.reportForm.user_reason_type;
        reportData.product_reason_type = null;
        reportData.reported_user_id = this.reportForm.reported_user_id;
        reportData.product_id = null;
        reportData.conversation_id = this.reportForm.conversation_id || null;
      }

      // Handle legacy target_identifier if no direct IDs are set
      if (!reportData.product_id && !reportData.reported_user_id && this.reportForm.target_identifier) {
        if (this.reportForm.target_type === 'user' || this.reportForm.report_type === 'user_behavior') {
          reportData.reported_user_id = parseInt(this.reportForm.target_identifier);
        } else {
          reportData.product_id = parseInt(this.reportForm.target_identifier);
        }
      }


    // Validate database constraints before submission
    if (!this.validateDatabaseConstraints(reportData)) {
      this.loading = false;
      this.showErrorMessage('Invalid report data. Please check your input and try again.');
      return;
    }

    this.apiService.submitReport(reportData).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.status === 'success') {
          this.showSuccessMessage('Report submitted successfully! We will review it soon.');
          this.resetForm();
          
          // Emit event for parent component
          this.reportSubmitted.emit(response.data);
          
          // If not in modal mode, refresh the reports list
          if (!this.isModal) {
            this.loadUserReports();
          } else {
            // In modal mode, close after a short delay
            setTimeout(() => {
              this.closeReportModal();
            }, 2000);
          }
        } else {
          this.showErrorMessage(response.message || 'Failed to submit report');
        }
      },
      error: (error) => {
        this.loading = false;
        let errorMessage = 'Error submitting report';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        }
        
        this.showErrorMessage(errorMessage);
      }
    });
    }).catch(error => {
      this.loading = false;
      this.showErrorMessage('Error processing proof files. Please try again.');
    });
  }

  // Form Validation (for modal mode only)
  validateReportForm(): boolean {
    
    // Check report type
    if (!this.reportForm.report_type) {
      this.showErrorMessage('Please select a report type');
      return false;
    }

    // Check reason type based on report type
    if (this.reportForm.report_type === 'product') {
      if (!this.reportForm.product_reason_type) {
        this.showErrorMessage('Please select a reason for reporting this product');
        return false;
      }
    } else if (this.reportForm.report_type === 'user_behavior' || this.reportForm.report_type === 'post_purchase_concern') {
      if (!this.reportForm.user_reason_type) {
        this.showErrorMessage('Please select a reason for reporting this user');
        return false;
      }
    }

    // Validate target identifier only if not prefilled
    if (!this.prefilledProduct && !this.prefilledUser) {
      if (!this.reportForm.target_identifier || this.reportForm.target_identifier.trim() === '') {
        this.showErrorMessage(`Please enter a ${this.reportForm.target_type} ID`);
        return false;
      }

      if (isNaN(parseInt(this.reportForm.target_identifier))) {
        this.showErrorMessage(`${this.reportForm.target_type} ID must be a number`);
        return false;
      }
    }

    if (!this.reportForm.reason_details || this.reportForm.reason_details.trim() === '') {
      this.showErrorMessage('Please provide details about your report');
      return false;
    }

    if (this.reportForm.reason_details.trim().length < 10) {
      this.showErrorMessage('Please provide more detailed information (at least 10 characters)');
      return false;
    }

    return true;
  }

  // Reset Form (for modal mode only)
  resetForm(): void {
    this.reportForm = {
      report_type: 'product',
      product_reason_type: null,
      user_reason_type: null,
      reason_details: '',
      reported_user_id: null,
      product_id: null,
      conversation_id: null,
      target_type: 'product',  // Legacy field
      target_identifier: '',
      proof_files: [],
      proof: []
    };
    this.selectedProofFiles = [];
    this.proofPreviews = [];
  }

  // Load user's reports
  loadUserReports(): void {
    if (!this.currentUser?.id) return;
    
    
    this.loading = true;
    this.apiService.getUserReports(this.currentUser.id).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.status === 'success') {
          this.reports = response.data || [];
        } else {
          this.showErrorMessage('Failed to load reports');
        }
      },
      error: (error) => {
        this.loading = false;
        this.showErrorMessage('Error loading reports');
      }
    });
  }

  // Modal Management
  showSuccessMessage(message: string): void {
    this.modalTitle = 'âœ… Success';
    this.modalMessage = message;
    this.modalType = 'success';
    this.showModal = true;
  }

  showErrorMessage(message: string): void {
    this.modalTitle = 'âŒ Error';
    this.modalMessage = message;
    this.modalType = 'error';
    this.showModal = true;
  }

  showInfoMessage(message: string): void {
    this.modalTitle = 'â„¹ï¸ Information';
    this.modalMessage = message;
    this.modalType = 'info';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  // Proof Modal Methods
  viewProofFiles(report: Report): void {
    const proofUrls = this.getProofFileUrls(report.proof || null);
    if (proofUrls.length === 0) {
      this.showErrorMessage('No proof files available');
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

  // Handle modal image errors
  onModalImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }
  }

  // Get file type for display
  getProofFileType(url: string): string {
    if (this.isProofImage(url)) {
      if (url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg')) return 'JPEG Image';
      if (url.toLowerCase().includes('.png')) return 'PNG Image';
      if (url.toLowerCase().includes('.gif')) return 'GIF Image';
      return 'Image';
    }
    if (this.isProofVideo(url)) {
      if (url.toLowerCase().includes('.mp4')) return 'MP4 Video';
      if (url.toLowerCase().includes('.webm')) return 'WebM Video';
      if (url.toLowerCase().includes('.mov')) return 'MOV Video';
      return 'Video';
    }
    return 'File';
  }

  // Close modal for parent component
  closeReportModal(): void {
    this.modalClosed.emit();
  }

  // Utility Methods
  getReasonTypeLabel(reasonType: string): string {
    // Try product reasons first
    let type = this.productReasonTypes.find(t => t.value === reasonType);
    if (type) return type.label;
    
    // Try user reasons
    type = this.userReasonTypes.find(t => t.value === reasonType);
    return type ? type.label : reasonType;
  }

  getReasonTypeIcon(reasonType: string): string {
    // Try product reasons first
    let type = this.productReasonTypes.find(t => t.value === reasonType);
    if (type) return type.icon;
    
    // Try user reasons
    type = this.userReasonTypes.find(t => t.value === reasonType);
    return type ? type.icon : 'ðŸ“';
  }

  // Get current reason options based on report type
  getCurrentReasonOptions() {
    if (this.reportForm.report_type === 'product') {
      return this.productReasonTypes;
    } else if (this.reportForm.report_type === 'user_behavior' || this.reportForm.report_type === 'post_purchase_concern') {
      return this.userReasonTypes;
    }
    return [];
  }

  // Get current selected reason type
  getCurrentReasonType() {
    if (this.reportForm.report_type === 'product') {
      return this.reportForm.product_reason_type;
    } else if (this.reportForm.report_type === 'user_behavior' || this.reportForm.report_type === 'post_purchase_concern') {
      return this.reportForm.user_reason_type;
    }
    return null;
  }

  // Set current reason type
  setCurrentReasonType(value: string) {
    if (this.reportForm.report_type === 'product') {
      this.reportForm.product_reason_type = value as any;
      this.reportForm.user_reason_type = null;
    } else if (this.reportForm.report_type === 'user_behavior' || this.reportForm.report_type === 'post_purchase_concern') {
      this.reportForm.user_reason_type = value as any;
      this.reportForm.product_reason_type = null;
    }
  }

  // Check if post-purchase concern option should be shown
  // Only show when product is sold or traded
  canShowPostPurchaseConcern(): boolean {
    const canShow = this.productSaleStatus === 'sold' || this.productSaleStatus === 'traded';
    return canShow;
  }

  // Fetch product sale status when target identifier changes
  async checkProductSaleStatus(productId: number): Promise<void> {
    if (!productId) {
      this.productSaleStatus = null;
      return;
    }

    
    try {
      // Fetch product details from API
      this.apiService.getProductById(productId).subscribe({
        next: (response) => {
          if (response.status === 'success' && response.data) {
            this.productSaleStatus = response.data.sale_status || response.data.saleStatus || null;
            
            // If post-purchase concern was selected but product is not sold/traded, reset to product report
            if (this.reportForm.report_type === 'post_purchase_concern' && !this.canShowPostPurchaseConcern()) {
              this.reportForm.report_type = 'product';
              this.showInfoMessage('Post-purchase concerns are only available for sold or traded products.');
            }
          } else {
            this.productSaleStatus = null;
          }
        },
        error: (error) => {
          this.productSaleStatus = null;
        }
      });
    } catch (error) {
      this.productSaleStatus = null;
    }
  }

  // Handle target identifier change (when user manually enters product/user ID)
  onTargetIdentifierChange(): void {
    
    // If reporting a product, check its sale status
    if (this.reportForm.report_type === 'product' && this.reportForm.target_identifier) {
      const productId = parseInt(this.reportForm.target_identifier);
      if (!isNaN(productId)) {
        this.checkProductSaleStatus(productId);
      }
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-gray-300 text-black';
      case 'reviewed':
        return 'bg-gray-600 text-white';
      case 'action_taken':
        return 'bg-black text-white';
      default:
        return 'bg-gray-200 text-black';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'reviewed': return 'Reviewed';
      case 'action_taken': return 'Action Taken';
      default: return status;
    }
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

  // Truncate description for display
  truncateDescription(description: string | null | undefined, maxLength: number = 100): string {
    if (!description) return 'No description available';
    return description.length > maxLength 
      ? description.substring(0, maxLength) + '...' 
      : description;
  }



  // Test method to verify API base URL
  testApiImageUrl(): string {
    const testImageName = 'test-image.jpg';
    return `${environment.apiUploadsBaseUrl}${testImageName}`;
  }

  // Get type of data for debugging
  getTypeOf(data: any): string {
    if (data === null) return 'null';
    if (data === undefined) return 'undefined';
    if (Array.isArray(data)) return 'array';
    return typeof data;
  }

  // View Report Details
  viewReportDetails(report: Report): void {
    let detailsMessage = `Report Details:\n\n`;
    detailsMessage += `ID: #${report.report_id}\n`;
    const reasonType = report.product_reason_type || report.user_reason_type;
    if (reasonType) {
      detailsMessage += `Reason: ${this.getReasonTypeLabel(reasonType)}\n`;
    }
    detailsMessage += `Status: ${this.getStatusText(report.status)}\n`;
    detailsMessage += `Date: ${this.formatDate(report.created_at)}\n`;
    
    if (report.reason_details) {
      detailsMessage += `\nDetails: ${report.reason_details}\n`;
    }
    
    if (report.product_id) {
      detailsMessage += `\nTarget: Product #${report.product_id}`;
      if (report.product_name) {
        detailsMessage += ` (${report.product_name})`;
      }
    } else if (report.reported_user_id) {
      detailsMessage += `\nTarget: User #${report.reported_user_id}`;
      if (report.reported_user_name) {
        detailsMessage += ` (${report.reported_user_name})`;
      }
    }
    
    this.showInfoMessage(detailsMessage);
  }

  // Navigation
  goBack(): void {
    if (this.isModal) {
      this.closeReportModal();
    } else {
      this.router.navigate(['/home']);
    }
  }

  // Debug function for testing
  debugSubmit(): void {
    const isValid = this.validateReportForm();
    if (isValid) {
      // Test actual submit for debugging
      this.submitReport();
    }
  }

  // Handle dropdown selection changes
  onReasonTypeChange(event: any): void {
    this.setCurrentReasonType(event.value);
  }

  // Test function to check if dropdown opens
  testDropdownClick(): void {
  }

  // Database validation helpers
  
  // Validate JSON string for product images (matching database CHECK constraint)
  private isValidJsonString(str: string): boolean {
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) || typeof parsed === 'object';
    } catch (e) {
      return false;
    }
  }



  // Validate report data before submission (matches database constraints)
  private validateDatabaseConstraints(reportData: any): boolean {
    // Check required fields
    if (!reportData.reporter_id) {
      return false;
    }

    // Validate report_type enum
    const validReportTypes = ['product', 'user_behavior', 'post_purchase_concern'];
    if (!validReportTypes.includes(reportData.report_type)) {
      return false;
    }

    // Validate reason types based on report type
    if (reportData.report_type === 'product') {
      if (!reportData.product_reason_type) {
        return false;
      }
      const validProductReasons = ['scam', 'fake product', 'spam', 'inappropriate content', 'misleading information', 'stolen item', 'others'];
      if (!validProductReasons.includes(reportData.product_reason_type)) {
        return false;
      }
    }

    // Validate user_reason_type if report is about user behavior
    if (reportData.report_type === 'user_behavior' || reportData.report_type === 'post_purchase_concern') {
      if (!reportData.user_reason_type) {
        return false;
      }
      const validUserReasons = ['rude behavior', 'harassment', 'threats', 'scamming attempt', 'not cooperative', 'refund issue', 'item not as described', 'damaged item', 'post purchase issue', 'others'];
      if (!validUserReasons.includes(reportData.user_reason_type)) {
        return false;
      }
    }

    // Validate status enum
    const validStatuses = ['pending', 'reviewed', 'action_taken'];
    if (reportData.status && !validStatuses.includes(reportData.status)) {
      return false;
    }

    // Validate product_images JSON if present
    if (reportData.product_images !== null && reportData.product_images !== undefined) {
      if (typeof reportData.product_images === 'string' && !this.isValidJsonString(reportData.product_images)) {
        return false;
      }
    }

    // Must have either reported_user_id or product_id, but not both
    const hasUser = reportData.reported_user_id !== null && reportData.reported_user_id !== undefined;
    const hasProduct = reportData.product_id !== null && reportData.product_id !== undefined;
    
    if (!hasUser && !hasProduct) {
      return false;
    }

    if (hasUser && hasProduct) {
      return false;
    }

    return true;
  }

  // Proof File Upload Methods
  
  onProofFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleProofFiles(Array.from(input.files));
    }
  }

  onProofFilesDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      this.handleProofFiles(Array.from(event.dataTransfer.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  private handleProofFiles(files: File[]): void {
    for (const file of files) {
      if (this.selectedProofFiles.length >= this.maxProofFiles) {
        this.showErrorMessage(`Maximum ${this.maxProofFiles} proof files allowed`);
        break;
      }

      if (!this.validateProofFile(file)) {
        continue;
      }

      this.selectedProofFiles.push(file);
      this.createProofPreview(file);
    }
    
    this.reportForm.proof_files = this.selectedProofFiles;
  }

  private validateProofFile(file: File): boolean {
    // Check file size
    if (file.size > this.maxFileSize) {
      this.showErrorMessage(`File "${file.name}" is too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB`);
      return false;
    }

    // Check file type
    if (!this.allowedFileTypes.includes(file.type)) {
      this.showErrorMessage(`File "${file.name}" has unsupported format. Allowed: images (JPEG, PNG, GIF) and videos (MP4, WebM, MOV)`);
      return false;
    }

    // Check if file already selected
    if (this.selectedProofFiles.some(f => f.name === file.name && f.size === file.size)) {
      this.showErrorMessage(`File "${file.name}" is already selected`);
      return false;
    }

    return true;
  }

  private createProofPreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'video';
      this.proofPreviews.push({ file, url, type });
    };
    reader.readAsDataURL(file);
  }

  removeProofFile(index: number): void {
    this.selectedProofFiles.splice(index, 1);
    this.proofPreviews.splice(index, 1);
    this.reportForm.proof_files = this.selectedProofFiles;
  }

  private async convertProofFilesToBase64(): Promise<string[]> {
    const base64Files: string[] = [];
    
    for (const file of this.selectedProofFiles) {
      try {
        const base64 = await this.fileToBase64(file);
        base64Files.push(base64);
      } catch (error) {
        throw new Error(`Failed to process file: ${file.name}`);
      }
    }
    
    return base64Files;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Get proof file URLs for display
  getProofFileUrls(proof: string | null): string[] {
    // Handle null, undefined, empty string cases
    if (!proof || proof === null || proof === undefined || proof === '' || proof === 'null') {
      return [];
    }
    
    try {
      // If it's already an array, return it
      if (Array.isArray(proof)) {
        return proof.map(path => this.buildImageUrl(path));
      }
      
      // Try to parse as JSON
      const proofArray = JSON.parse(proof);
      
      if (Array.isArray(proofArray)) {
        // Filter out empty or null items
        const validPaths = proofArray.filter(path => path && path !== null && path !== '');
        // Check if items are base64 data URLs or file paths
        return validPaths.map(path => {
          if (typeof path === 'string' && path.startsWith('data:')) {
            return path; // Return base64 as-is
          }
          return this.buildImageUrl(path);
        });
      } else if (proofArray && typeof proofArray === 'string') {
        // Single file as string
        return [this.buildImageUrl(proofArray)];
      }
    } catch (error) {
      
      // If JSON parsing fails, try to treat as a single string path
      if (typeof proof === 'string' && proof.trim().length > 0 && proof !== 'null' && proof !== '[]') {
        return [this.buildImageUrl(proof.trim())];
      }
    }
    
    return [];
  }

  // Check if proof file is image
  isProofImage(url: string): boolean {
    if (!url) return false;
    
    // Check if it's a base64 image data URL
    if (url.startsWith('data:image/')) {
      return true;
    }
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  // Check if proof file is video
  isProofVideo(url: string): boolean {
    if (!url) return false;
    
    // Check if it's a base64 video data URL
    if (url.startsWith('data:video/')) {
      return true;
    }
    
    const videoExtensions = ['.mp4', '.webm', '.mov', '.ogg', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  // Get file icon for proof files
  getProofFileIcon(url: string): string {
    if (this.isProofImage(url)) return 'ðŸ–¼ï¸';
    if (this.isProofVideo(url)) return 'ðŸŽ¥';
    return 'ðŸ“';
  }

  // Open proof file in new tab
  openProofFile(url: string): void {
    if (!url) {
      return;
    }
    
    try {
      // Check if it's a base64 data URL
      if (url.startsWith('data:')) {
        // For base64 data URLs, download them as files instead
        this.downloadBase64File(url);
      } else {
        // For regular URLs, open in new tab
        window.open(url, '_blank');
      }
    } catch (error) {
    }
  }

  // Download base64 data URL as a file
  private downloadBase64File(dataUrl: string): void {
    try {
      // Extract file type from data URL
      const matches = dataUrl.match(/^data:([^;]+);base64,/);
      if (!matches) {
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

    } catch (error) {
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

  // Helper method to build proper image URL
  private buildImageUrl(
    imagePath: unknown,
    fallback = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png'
  ): string {
    if (!imagePath) {
      return fallback;
    }

    let resolvedPath = imagePath;
    if (typeof resolvedPath === 'object' && resolvedPath !== null) {
      const candidate = (resolvedPath as any).path || (resolvedPath as any).url || (resolvedPath as any).name;
      if (!candidate) {
        return fallback;
      }
      resolvedPath = candidate;
    }

    if (typeof resolvedPath !== 'string') {
      return fallback;
    }

    const normalized = resolvedPath.trim();
    if (!normalized) {
      return fallback;
    }

    // Handle full URLs and base64
    if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:')) {
      return normalized;
    }

    // Remove api/uploads or uploads prefixes to avoid duplicated segments.
    const cleanImagePath = normalized
      .replace(/^\/+/, '')
      .replace(/^api\/uploads[\/\\]/i, '')
      .replace(/^uploads[\/\\]/i, '');

    return `${environment.apiUploadsBaseUrl}${cleanImagePath}`;
  }

  // Get product image URL for display
  getProductImageUrl(productImages: string | null | undefined): string {
    const callId = Math.random().toString(36).substr(2, 9);
    // Handle null, undefined, empty string cases
    if (!productImages || productImages === null || productImages === undefined || productImages === '') {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }

    try {
      let images: any;
      
      // If it's already an array, use it directly
      if (Array.isArray(productImages)) {
        images = productImages;
      } else if (typeof productImages === 'string') {
        
        // Check if string is empty array
        if (productImages.trim() === '[]') {
          return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
        }
        
        // Check if it looks like JSON
        if (productImages.trim().startsWith('[') || productImages.trim().startsWith('"')) {
          try {
            images = JSON.parse(productImages);
            
            // Check if parsed result is empty array
            if (Array.isArray(images) && images.length === 0) {
              return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
            }
          } catch (jsonError) {
            // Treat as single image path if JSON parsing fails
            images = [productImages];
          }
        } else {
          images = [productImages];
        }
      }
      
      
      if (Array.isArray(images) && images.length > 0) {
        const firstImage = images[0];
        
        if (firstImage && typeof firstImage === 'string' && firstImage.trim() !== '') {
          const imageUrl = this.buildImageUrl(firstImage);
          return imageUrl;
        }
      }
    } catch (e) {
      
      // If processing failed but we have a string, try to use it directly
      if (typeof productImages === 'string' && productImages.length > 0 && productImages.trim() !== '') {
        const imageUrl = this.buildImageUrl(productImages.trim());
        return imageUrl;
      }
    }

    return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
  }

  // Get all product image URLs for gallery view
  getProductImageUrls(productImages: string | null | undefined): string[] {
    // Handle null, undefined, empty string cases
    if (!productImages || productImages === null || productImages === undefined || productImages === '') {
      return ['https://cdn-icons-png.flaticon.com/512/2972/2972185.png'];
    }

    try {
      let images: any;
      
      // If it's already an array, use it directly
      if (Array.isArray(productImages)) {
        images = productImages;
      } else if (typeof productImages === 'string') {
        // Check if it looks like JSON
        if (productImages.trim().startsWith('[') || productImages.trim().startsWith('"')) {
          images = JSON.parse(productImages);
        } else {
          images = [productImages];
        }
      }
      
      if (Array.isArray(images) && images.length > 0) {
        return images.map(image => this.buildImageUrl(image));
      }
    } catch (e) {
      
      // If JSON parsing failed but we have a string, try to use it as a direct path
      if (typeof productImages === 'string' && productImages.length > 0) {
        return [this.buildImageUrl(productImages)];
      }
    }

    return ['https://cdn-icons-png.flaticon.com/512/2972/2972185.png'];
  }



  // Handle image loading errors
  onImageError(event: any): void {
    const img = event.target as HTMLImageElement;
    const failedSrc = img?.src || 'unknown';
    
    if (img && failedSrc !== 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png') {
      img.src = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }
  }

  // Handle successful image loading
  onImageLoad(event: any): void {
    const img = event.target as HTMLImageElement;
  }

  // ==================== CARD LAYOUT METHODS ====================
  
  // Open report details modal
  openReportDetails(report: Report): void {
    this.selectedReport = report;
    this.showReportDetailsModal = true;
  }

  // Close report details modal
  closeReportDetails(): void {
    this.showReportDetailsModal = false;
    this.selectedReport = null;
  }

  // Get first proof file thumbnail for card preview
  getFirstProofThumbnail(proof: string | null | undefined): string | null {
    if (!proof) return null;
    
    try {
      const proofFiles = JSON.parse(proof);
      if (Array.isArray(proofFiles) && proofFiles.length > 0) {
        const firstFile = proofFiles[0];
        // Only return if it's an image
        if (this.isImageFile(firstFile)) {
          return this.buildProofFileUrl(firstFile);
        }
      }
    } catch (e) {
    }
    return null;
  }

  // Get all proof files for modal display
  getProofFiles(proof: string | null | undefined): string[] {
    if (!proof) return [];
    
    try {
      const proofFiles = JSON.parse(proof);
      if (Array.isArray(proofFiles)) {
        return proofFiles.map(file => this.buildProofFileUrl(file));
      }
    } catch (e) {
    }
    return [];
  }

  // Build proof file URL
  buildProofFileUrl(filePath: string): string {
    if (!filePath) return '';
    
    // If already a full URL or base64, return as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
      return filePath;
    }
    
    // Build URL from base path
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  // Check if file is an image
  isImageFile(filePath: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerPath = filePath.toLowerCase();
    return imageExtensions.some(ext => lowerPath.endsWith(ext)) || lowerPath.includes('data:image');
  }

  // Check if file is a video
  isVideoFile(filePath: string): boolean {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const lowerPath = filePath.toLowerCase();
    return videoExtensions.some(ext => lowerPath.endsWith(ext)) || lowerPath.includes('data:video');
  }

  // Get reason type display (combines product and user reason types)
  getReasonTypeDisplay(report: Report): string {
    if (report.report_type === 'product' && report.product_reason_type) {
      return report.product_reason_type;
    }
    if ((report.report_type === 'user_behavior' || report.report_type === 'post_purchase_concern') && report.user_reason_type) {
      return report.user_reason_type;
    }
    return 'Not specified';
  }

  // Get target name (product or user name)
  getTargetName(report: Report): string {
    if (report.report_type === 'product' && report.product_name) {
      return report.product_name;
    }
    if (report.reported_user_name) {
      return report.reported_user_name;
    }
    return 'Unknown';
  }

  // Get report type display with icon
  getReportTypeDisplay(reportType: string): string {
    switch (reportType) {
        case 'product':
          return '🛍️ Product Report';
        case 'user_behavior':
          return '👤 User Behavior';
        case 'post_purchase_concern':
          return '📦 Post-Purchase';
        default:
          return reportType;
      }
  }

  // Parse message reference JSON
  getMessageReferences(messageReference: string | null | undefined): any[] {
    if (!messageReference) return [];
    
    try {
      const messages = JSON.parse(messageReference);
      return Array.isArray(messages) ? messages : [];
    } catch (e) {
      return [];
    }
  }

  // Format relative time
  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return this.formatDate(dateString);
  }

  // Get profile image URL
  getProfileImageUrl(profileImage: string | null | undefined): string {
    const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    return this.buildImageUrl(profileImage, defaultAvatar);
  }

  // Handle profile image errors
  onProfileImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    }
  }
}
