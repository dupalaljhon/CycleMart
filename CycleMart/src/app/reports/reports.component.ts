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

export interface Report {
  report_id: number;
  reporter_id: number;
  reported_user_id?: number | null;
  product_id?: number | null;
  product_images?: string | null;  // JSON string of product images from database (longtext with json_valid check)
  product_description?: string | null;  // Product description from database (text field)
  reason_type: 'scam' | 'fake product' | 'spam' | 'inappropriate content' | 'misleading information' | 'stolen item' | 'others';
  reason_details?: string | null;
  proof?: string | null;  // JSON string of proof files (images/videos) from database (longtext with json_valid check)
  status: 'pending' | 'reviewed' | 'action_taken';
  created_at: string;  // timestamp from database
  reviewed_by?: number | null;
  reviewed_at?: string | null;  // timestamp from database
  // Extended fields from JOINs (not in actual reports table)
  reported_user_name?: string;
  reported_user_email?: string;
  product_name?: string;
  product_price?: number;
  reviewed_by_name?: string;
}

export interface ReportForm {
  reported_user_id?: number | null;
  product_id?: number | null;
  reason_type: 'scam' | 'fake product' | 'spam' | 'inappropriate content' | 'misleading information' | 'stolen item' | 'others' | 'test' | '' | null;
  reason_details: string;
  target_type: 'user' | 'product';
  target_identifier: string;
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
  
  // Material Table Configuration
  displayedColumns: string[] = ['product_image', 'reason_type', 'target', 'proof', 'status', 'created_at', 'actions'];
  
  // Modal State
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'success' | 'error' | 'info' = 'info';
  
  // Proof Modal State
  showProofModal = false;
  currentProofFiles: string[] = [];
  currentProofIndex = 0;
  currentReportId: number | null = null;
  
  // Form Data (for modal mode only)
  reportForm: ReportForm = {
    reason_type: null,  // Start with null for better type checking
    reason_details: '',
    target_type: 'product',  // Default to product reporting
    target_identifier: '',
    reported_user_id: null,
    product_id: null,
    proof_files: [],
    proof: []
  };
  
  // Proof file handling
  selectedProofFiles: File[] = [];
  proofPreviews: { file: File, url: string, type: 'image' | 'video' }[] = [];
  maxProofFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB
  allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/mov'];
  
  // Report Types (for display purposes)
  reportTypes = [
    { value: 'scam', label: 'Scam/Fraud', icon: '⚠️' },
    { value: 'fake product', label: 'Fake Product', icon: '🚫' },
    { value: 'spam', label: 'Spam', icon: '📧' },
    { value: 'inappropriate content', label: 'Inappropriate Content', icon: '🔞' },
    { value: 'misleading information', label: 'Misleading Information', icon: '❌' },
    { value: 'stolen item', label: 'Stolen Item', icon: '🚨' },
    { value: 'others', label: 'Others', icon: '📝' }
  ];

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('🟢 REPORTS: Component initialized');
    console.log('🟢 REPORTS: isModal:', this.isModal);
    console.log('🟢 REPORTS: prefilledProduct:', this.prefilledProduct);
    console.log('🟢 REPORTS: prefilledUser:', this.prefilledUser);
    
    this.loadCurrentUser();
    
    // If modal mode and prefilled data provided, set form accordingly
    if (this.isModal && this.prefilledProduct) {
      console.log('🟢 REPORTS: Setting form for prefilled product');
      this.reportForm.target_type = 'product';
      this.reportForm.target_identifier = this.prefilledProduct.product_id?.toString() || this.prefilledProduct.id?.toString() || '';
      console.log('🟢 REPORTS: Set target_identifier to:', this.reportForm.target_identifier);
    } else if (this.isModal && this.prefilledUser) {
      console.log('🟢 REPORTS: Setting form for prefilled user');
      this.reportForm.target_type = 'user';
      this.reportForm.target_identifier = this.prefilledUser.id?.toString() || '';
      console.log('🟢 REPORTS: Set target_identifier to:', this.reportForm.target_identifier);
    }
    
    // Load reports only if not in modal mode
    if (!this.isModal) {
      console.log('🟢 REPORTS: Loading user reports');
      this.loadUserReports();
    }
    
    console.log('🟢 REPORTS: Final reportForm state:', this.reportForm);
  }

  // Load current user from localStorage
  loadCurrentUser(): void {
    console.log('🔍 REPORTS: Loading current user...');
    
    // Check all possible localStorage keys
    const userData = localStorage.getItem('currentUser');
    const userId = localStorage.getItem('id');
    const userEmail = localStorage.getItem('email');
    const userName = localStorage.getItem('full_name');
    
    console.log('🔍 REPORTS: localStorage data check:');
    console.log('- currentUser:', userData);
    console.log('- id:', userId);
    console.log('- email:', userEmail);
    console.log('- full_name:', userName);
    
    if (userData) {
      this.currentUser = JSON.parse(userData);
      console.log('🔍 REPORTS: User loaded from currentUser:', this.currentUser);
    } else {
      // Try alternative storage keys that might be used in your app
      if (userId) {
        // Create a minimal user object if we have basic info
        this.currentUser = {
          id: parseInt(userId),
          email: userEmail,
          full_name: userName
        };
        console.log('🔍 REPORTS: User created from individual keys:', this.currentUser);
      } else if (this.isModal) {
        // In modal mode, don't redirect to login, just show an error
        console.log('🔍 REPORTS: No user found in modal mode');
        this.showErrorMessage('Please login to report content');
        return;
      } else {
        // Only redirect to login if not in modal mode
        console.log('🔍 REPORTS: No user found, redirecting to login');
        this.router.navigate(['/login']);
      }
    }
    
    console.log('🔍 REPORTS: Final current user:', this.currentUser);
  }

  // Submit Report (for modal mode only)
  submitReport(): void {
    console.log('🔵 REPORTS: submitReport called');
    console.log('🔵 REPORTS: isModal:', this.isModal);
    console.log('🔵 REPORTS: currentUser:', this.currentUser);
    console.log('🔵 REPORTS: reportForm:', this.reportForm);
    console.log('🔵 REPORTS: prefilledProduct:', this.prefilledProduct);
    
    // First check: ensure we're in modal mode (only submit in modal mode)
    if (!this.isModal) {
      console.log('🔵 REPORTS: Not in modal mode, should not submit');
      return;
    }
    
    // Check if user is logged in
    if (!this.currentUser || !this.currentUser.id) {
      console.log('🔵 REPORTS: User not logged in, showing error');
      this.showErrorMessage('Please login to submit a report');
      return;
    }

    console.log('🔵 REPORTS: Validating form...');
    if (!this.validateReportForm()) {
      console.log('🔵 REPORTS: Form validation failed');
      return;
    }

    console.log('🔵 REPORTS: Form validation passed, preparing data...');
    this.loading = true;
    
    // Convert proof files to base64 if any
    this.convertProofFilesToBase64().then(proofBase64Array => {
      // Prepare report data based on database table structure
      const reportData: any = {
        reporter_id: this.currentUser.id,
        reason_type: this.reportForm.reason_type,
        reason_details: this.reportForm.reason_details || null,
        proof: proofBase64Array.length > 0 ? proofBase64Array : null,  // Array of base64 strings
        status: 'pending'  // Default status as per database
      };

    // Add target information based on type
    if (this.reportForm.target_type === 'user') {
      reportData.reported_user_id = parseInt(this.reportForm.target_identifier);
      reportData.product_id = null;
      reportData.product_images = null;
      reportData.product_description = null;
    } else {
      reportData.product_id = parseInt(this.reportForm.target_identifier);
      reportData.reported_user_id = null;
      
      // If reporting a product and we have prefilled product data, include product details
      if (this.prefilledProduct) {
        // Handle product images as JSON string (matching database longtext JSON field)
        if (this.prefilledProduct.productImages || this.prefilledProduct.product_images) {
          const productImages = this.prefilledProduct.productImages || this.prefilledProduct.product_images;
          try {
            // Ensure product images are stored as valid JSON string
            if (Array.isArray(productImages)) {
              reportData.product_images = JSON.stringify(productImages);
            } else if (typeof productImages === 'string') {
              // Try to parse and re-stringify to ensure valid JSON
              const parsedImages = JSON.parse(productImages);
              reportData.product_images = JSON.stringify(parsedImages);
            } else {
              reportData.product_images = JSON.stringify([productImages]);
            }
          } catch (e) {
            console.warn('Failed to process product images as JSON:', e);
            // If JSON parsing fails, store as single image array
            reportData.product_images = JSON.stringify([productImages]);
          }
        } else {
          reportData.product_images = null;
        }
        
        // Include product description if available
        reportData.product_description = this.prefilledProduct.description || 
                                       this.prefilledProduct.product_description || 
                                       null;
      } else {
        reportData.product_images = null;
        reportData.product_description = null;
      }
    }

    console.log('Submitting report with data structure:', reportData);

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
        console.error('Error submitting report:', error);
        let errorMessage = 'Error submitting report';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        }
        
        this.showErrorMessage(errorMessage);
      }
    });
    }).catch(error => {
      this.loading = false;
      console.error('Error converting proof files:', error);
      this.showErrorMessage('Error processing proof files. Please try again.');
    });
  }

  // Form Validation (for modal mode only)
  validateReportForm(): boolean {
    console.log('🔸 REPORTS: Validating form...');
    console.log('🔸 REPORTS: reason_type:', this.reportForm.reason_type);
    console.log('🔸 REPORTS: reason_details:', this.reportForm.reason_details);
    console.log('🔸 REPORTS: target_identifier:', this.reportForm.target_identifier);
    
    // Check if reason_type is not selected (null, empty string, or falsy)
    const reasonType = this.reportForm.reason_type;
    if (!reasonType || reasonType === null) {
      console.log('🔸 REPORTS: No reason type selected');
      this.showErrorMessage('Please select a reason for reporting');
      return false;
    }

    // For testing, make validation more lenient
    if (reasonType === 'test') {
      console.log('🔸 REPORTS: Test mode - skipping other validations');
      return true;
    }

    // Validate target identifier only if not prefilled
    if (!this.prefilledProduct && !this.prefilledUser) {
      console.log('🔸 REPORTS: Checking target identifier (not prefilled)');
      if (!this.reportForm.target_identifier || this.reportForm.target_identifier.trim() === '') {
        console.log('🔸 REPORTS: No target identifier');
        this.showErrorMessage(`Please enter a ${this.reportForm.target_type} ID`);
        return false;
      }

      if (isNaN(parseInt(this.reportForm.target_identifier))) {
        console.log('🔸 REPORTS: Invalid target identifier');
        this.showErrorMessage(`${this.reportForm.target_type} ID must be a number`);
        return false;
      }
    }

    if (!this.reportForm.reason_details || this.reportForm.reason_details.trim() === '') {
      console.log('🔸 REPORTS: No reason details');
      this.showErrorMessage('Please provide details about your report');
      return false;
    }

    if (this.reportForm.reason_details.trim().length < 10) {
      console.log('🔸 REPORTS: Reason details too short');
      this.showErrorMessage('Please provide more detailed information (at least 10 characters)');
      return false;
    }

    console.log('🔸 REPORTS: Form validation passed');
    return true;
  }

  // Reset Form (for modal mode only)
  resetForm(): void {
    this.reportForm = {
      reason_type: null,
      reason_details: '',
      target_type: 'product',
      target_identifier: '',
      reported_user_id: null,
      product_id: null,
      proof_files: [],
      proof: []
    };
    this.selectedProofFiles = [];
    this.proofPreviews = [];
  }

  // Load user's reports
  loadUserReports(): void {
    if (!this.currentUser?.id) return;
    
    console.log('Loading reports for user ID:', this.currentUser.id);
    
    this.loading = true;
    this.apiService.getUserReports(this.currentUser.id).subscribe({
      next: (response) => {
        this.loading = false;
        console.log('=== Full API Response ===');
        console.log('Response:', response);
        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
        
        if (response.status === 'success') {
          this.reports = response.data || [];
          console.log('=== Loaded Reports Analysis ===');
          console.log('Total reports loaded:', this.reports.length);
          
          // Log each report's product image data
          this.reports.forEach((report, index) => {
            console.log(`\n--- Report ${index + 1} (ID: ${report.report_id}) ---`);
            console.log('Product ID:', report.product_id);
            console.log('Product Images (raw):', report.product_images);
            console.log('Product Images type:', typeof report.product_images);
            console.log('Product Images value:', report.product_images);
            console.log('Product Description:', report.product_description);
            console.log('Reason Type:', report.reason_type);
            
            // Test image URL generation
            if (report.product_images) {
              console.log('Generated image URL:', this.getProductImageUrl(report.product_images));
              console.log('Generated image URLs array:', this.getProductImageUrls(report.product_images));
            }
          });
        } else {
          console.error('API returned error status:', response.message);
          this.showErrorMessage('Failed to load reports');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('=== API Error ===');
        console.error('Error loading reports:', error);
        console.error('Error details:', error.error);
        this.showErrorMessage('Error loading reports');
      }
    });
  }

  // Modal Management
  showSuccessMessage(message: string): void {
    this.modalTitle = '✅ Success';
    this.modalMessage = message;
    this.modalType = 'success';
    this.showModal = true;
  }

  showErrorMessage(message: string): void {
    this.modalTitle = '❌ Error';
    this.modalMessage = message;
    this.modalType = 'error';
    this.showModal = true;
  }

  showInfoMessage(message: string): void {
    this.modalTitle = 'ℹ️ Information';
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
    
    console.log('🔍 PROOF MODAL: Opening proof modal for report:', report.report_id, 'with files:', proofUrls);
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
    console.error('🔍 PROOF MODAL: Image load error:', event);
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
    const type = this.reportTypes.find(t => t.value === reasonType);
    return type ? type.label : reasonType;
  }

  getReasonTypeIcon(reasonType: string): string {
    const type = this.reportTypes.find(t => t.value === reasonType);
    return type ? type.icon : '📝';
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

  // Get first product image from JSON string or plain string
  getProductImageUrl(productImages: string | null): string {
    console.log('getProductImageUrl called with:', productImages);
    console.log('getProductImageUrl input type:', typeof productImages);
    
    // Handle null, undefined, empty string cases
    if (!productImages || productImages === null || productImages === undefined || productImages === '') {
      console.log('getProductImageUrl: No images provided, using default');
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
        console.log('First image found:', firstImage);
        
        // Clean the image path and create the correct URL
        const cleanImageName = firstImage.replace(/^uploads[\/\\]/, '');
        const imageUrl = `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
        console.log('Generated image URL:', imageUrl);
        
        return imageUrl;
      }
    } catch (e) {
      console.error('Error parsing product images:', e);
      console.error('Original data:', productImages);
      
      // If JSON parsing failed but we have a string, try to use it as a direct path
      if (typeof productImages === 'string' && productImages.length > 0) {
        console.log('Attempting to use as direct image path:', productImages);
        const cleanImageName = productImages.replace(/^uploads[\/\\]/, '');
        const imageUrl = `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
        console.log('Generated fallback image URL:', imageUrl);
        return imageUrl;
      }
    }

    return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png'; // Fallback
  }

  // Handle image load errors by setting fallback image
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }
  }

  // Get all product images as array for gallery
  getProductImageUrls(productImages: any): string[] {
    console.log('getProductImageUrls called with:', productImages);
    console.log('getProductImageUrls input type:', typeof productImages);
    
    // Handle null, undefined, empty cases
    if (!productImages || productImages === null || productImages === undefined || productImages === '') {
      console.log('getProductImageUrls: No images provided, returning empty array');
      return [];
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
      
      if (Array.isArray(images)) {
        return images.map(image => {
          const cleanImageName = image.replace(/^uploads[\/\\]/, '');
          return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
        });
      }
    } catch (e) {
      console.error('Error parsing product images for gallery:', e);
      console.error('Original data:', productImages);
      
      // If JSON parsing failed but we have a string, try to use it as a direct path
      if (typeof productImages === 'string' && productImages.length > 0) {
        const cleanImageName = productImages.replace(/^uploads[\/\\]/, '');
        return [`http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`];
      }
    }

    return [];
  }

  // Truncate description for display
  truncateDescription(description: string | null, maxLength: number = 100): string {
    if (!description) return 'No description available';
    return description.length > maxLength 
      ? description.substring(0, maxLength) + '...' 
      : description;
  }

  // Handle image loading success
  onImageLoad(event: any): void {
    console.log('Image loaded successfully:', event.target?.src);
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
    detailsMessage += `Reason: ${this.getReasonTypeLabel(report.reason_type)}\n`;
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
    console.log('🔥 DEBUG: Testing submit functionality');
    console.log('🔥 DEBUG: currentUser:', this.currentUser);
    console.log('🔥 DEBUG: reportForm:', this.reportForm);
    console.log('🔥 DEBUG: isModal:', this.isModal);
    console.log('🔥 DEBUG: prefilledProduct:', this.prefilledProduct);
    console.log('🔥 DEBUG: reportTypes:', this.reportTypes);
    console.log('🔥 DEBUG: localStorage check:');
    console.log('- currentUser:', localStorage.getItem('currentUser'));
    console.log('- id:', localStorage.getItem('id'));
    console.log('- email:', localStorage.getItem('email'));
    console.log('- full_name:', localStorage.getItem('full_name'));
    
    // Test dropdown data
    console.log('🔥 DEBUG: Available report types:');
    this.reportTypes.forEach((type, index) => {
      console.log(`  ${index}: ${type.value} - ${type.label} ${type.icon}`);
    });
    
    // Test form validation
    const isValid = this.validateReportForm();
    console.log('🔥 DEBUG: Form validation result:', isValid);
    
    if (isValid) {
      console.log('🔥 DEBUG: Form is valid, would submit now');
      // Test actual submit for debugging
      this.submitReport();
    } else {
      console.log('🔥 DEBUG: Form is invalid, cannot submit');
    }
  }

  // Handle dropdown selection changes
  onReasonTypeChange(event: any): void {
    console.log('🔽 DROPDOWN: Reason type changed to:', event.value);
    console.log('🔽 DROPDOWN: Event object:', event);
    this.reportForm.reason_type = event.value;
    console.log('🔽 DROPDOWN: Form updated:', this.reportForm);
    console.log('🔽 DROPDOWN: Available reportTypes:', this.reportTypes);
  }

  // Test function to check if dropdown opens
  testDropdownClick(): void {
    console.log('🔥 DROPDOWN TEST: Dropdown clicked');
    console.log('🔥 DROPDOWN TEST: reportTypes:', this.reportTypes);
    console.log('🔥 DROPDOWN TEST: reportTypes length:', this.reportTypes.length);
    console.log('🔥 DROPDOWN TEST: Current form state:', this.reportForm);
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

  // Helper method to build proper image URL
  private buildImageUrl(imagePath: string): string {
    if (!imagePath) return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    
    // Handle full URLs
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Handle base64 images
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    // Clean image name and build API path
    const cleanImageName = imagePath.replace(/^uploads[\/\\]/, '');
    return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
  }

  // Validate report data before submission (matches database constraints)
  private validateDatabaseConstraints(reportData: any): boolean {
    // Check required fields
    if (!reportData.reporter_id || !reportData.reason_type) {
      console.error('Missing required fields: reporter_id and reason_type are required');
      return false;
    }

    // Validate reason_type enum
    const validReasonTypes = ['scam', 'fake product', 'spam', 'inappropriate content', 'misleading information', 'stolen item', 'others'];
    if (!validReasonTypes.includes(reportData.reason_type)) {
      console.error('Invalid reason_type:', reportData.reason_type);
      return false;
    }

    // Validate status enum
    const validStatuses = ['pending', 'reviewed', 'action_taken'];
    if (reportData.status && !validStatuses.includes(reportData.status)) {
      console.error('Invalid status:', reportData.status);
      return false;
    }

    // Validate product_images JSON if present
    if (reportData.product_images !== null && reportData.product_images !== undefined) {
      if (typeof reportData.product_images === 'string' && !this.isValidJsonString(reportData.product_images)) {
        console.error('Invalid JSON format for product_images');
        return false;
      }
    }

    // Must have either reported_user_id or product_id, but not both
    const hasUser = reportData.reported_user_id !== null && reportData.reported_user_id !== undefined;
    const hasProduct = reportData.product_id !== null && reportData.product_id !== undefined;
    
    if (!hasUser && !hasProduct) {
      console.error('Either reported_user_id or product_id must be provided');
      return false;
    }

    if (hasUser && hasProduct) {
      console.error('Cannot report both user and product in the same report');
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
        console.error('Error converting file to base64:', error);
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
    console.log('🔍 PROOF: getProofFileUrls called with:', proof);
    console.log('🔍 PROOF: Type:', typeof proof);
    
    // Handle null, undefined, empty string cases
    if (!proof || proof === null || proof === undefined || proof === '' || proof === 'null') {
      console.log('🔍 PROOF: No proof data found');
      return [];
    }
    
    try {
      // If it's already an array, return it
      if (Array.isArray(proof)) {
        console.log('🔍 PROOF: Already an array:', proof);
        return proof.map(path => this.buildImageUrl(path));
      }
      
      // Try to parse as JSON
      const proofArray = JSON.parse(proof);
      console.log('🔍 PROOF: Parsed JSON:', proofArray);
      
      if (Array.isArray(proofArray)) {
        // Filter out empty or null items
        const validPaths = proofArray.filter(path => path && path !== null && path !== '');
        console.log('🔍 PROOF: Valid paths:', validPaths);
        return validPaths.map(path => this.buildImageUrl(path));
      } else if (proofArray && typeof proofArray === 'string') {
        // Single file as string
        console.log('🔍 PROOF: Single file string:', proofArray);
        return [this.buildImageUrl(proofArray)];
      }
    } catch (error) {
      console.error('🔍 PROOF: Error parsing proof JSON:', error);
      console.error('🔍 PROOF: Original data:', proof);
      
      // If JSON parsing fails, try to treat as a single string path
      if (typeof proof === 'string' && proof.trim().length > 0 && proof !== 'null' && proof !== '[]') {
        console.log('🔍 PROOF: Treating as single string path:', proof);
        return [this.buildImageUrl(proof.trim())];
      }
    }
    
    console.log('🔍 PROOF: Returning empty array');
    return [];
  }

  // Check if proof file is image
  isProofImage(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  // Check if proof file is video
  isProofVideo(url: string): boolean {
    const videoExtensions = ['.mp4', '.webm', '.mov'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  // Get file icon for proof files
  getProofFileIcon(url: string): string {
    if (this.isProofImage(url)) return '🖼️';
    if (this.isProofVideo(url)) return '🎥';
    return '📁';
  }

  // Open proof file in new tab
  openProofFile(url: string): void {
    window.open(url, '_blank');
  }
}
