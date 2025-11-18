import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ApiService } from '../api/api.service';
import { NotificationService } from '../services/notification.service';

interface UserReport {
  user_report_id: number;
  reporter_id: number;
  reported_user_id: number;
  conversation_id?: number;
  product_id?: number;
  report_type: 'user_behavior' | 'post_purchase_concern';
  reason_type: string;
  reason_details?: string;
  explanation?: string;
  message_reference?: number[];
  proof_files?: string[];
  status: 'pending' | 'reviewed' | 'action_taken';
  created_at: string;
  reviewed_by?: number;
  reviewed_at?: string;
  reported_user_name?: string;
  product_name?: string;
}

@Component({
  selector: 'app-user-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, SidenavComponent],
  templateUrl: './user-reports.component.html',
  styleUrl: './user-reports.component.css'
})
export class UserReportsComponent implements OnInit {
  reports: UserReport[] = [];
  isLoading: boolean = true;
  currentUserId: number = 0;

  // User Report Modal Properties
  showUserReportModal: boolean = false;
  reportedUser: any = null;
  conversationId: number = 0;
  productId: number | null = null;
  productName: string = '';

  // User Report Form
  userReportForm = {
    report_type: 'user_behavior' as 'user_behavior' | 'post_purchase_concern',
    user_reason_type: '',
    explanation: '',
    proof_files: [] as File[]
  };

  // Form Options
  reportTypeOptions = [
    { value: 'user_behavior', label: 'User Behavior' },
    { value: 'post_purchase_concern', label: 'Post-Purchase Concern' }
  ];

  userBehaviorReasons = [
    'rude behavior',
    'harassment', 
    'threats',
    'scamming attempt',
    'not cooperative',
    'others'
  ];

  postPurchaseReasons = [
    'refund issue',
    'item not as described',
    'damaged item', 
    'post purchase issue',
    'others'
  ];

  // File handling
  selectedProofFiles: File[] = [];
  proofPreviews: { file: File, url: string, type: 'image' | 'video' }[] = [];
  maxProofFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB
  allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/mov'];
  isSubmitting: boolean = false;

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.currentUserId = parseInt(localStorage.getItem('id') || '0');
    this.loadUserReports();
  }

  /**
   * Load user reports
   */
  loadUserReports() {
    this.isLoading = true;
    
    this.apiService.getUserReports(this.currentUserId).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.reports = response.data || [];
        } else {
          this.notificationService.showError(
            'Error Loading Reports',
            response.message || 'Failed to load your reports'
          );
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user reports:', error);
        this.notificationService.showError(
          'Error Loading Reports',
          'Unable to load your reports. Please try again later.'
        );
        this.isLoading = false;
      }
    });
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'action_taken':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Format date
   */
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

  /**
   * Get report type display text
   */
  getReportTypeText(reportType: string): string {
    return reportType === 'user_behavior' ? 'User Behavior' : 'Post-Purchase Concern';
  }

  /**
   * Get reason type display text
   */
  getReasonTypeText(reasonType: string): string {
    return reasonType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Track by function for performance
   */
  trackByReportId(index: number, report: UserReport): number {
    return report.user_report_id;
  }

  /**
   * Open user report modal (called from messages component)
   */
  openUserReportModal(reportedUser: any, conversationId: number, productId?: number, productName?: string) {
    this.reportedUser = reportedUser;
    this.conversationId = conversationId;
    this.productId = productId || null;
    this.productName = productName || '';
    this.showUserReportModal = true;
    this.resetUserReportForm();
  }

  /**
   * Close user report modal
   */
  closeUserReportModal() {
    this.showUserReportModal = false;
    this.resetUserReportForm();
  }

  /**
   * Reset user report form
   */
  resetUserReportForm() {
    this.userReportForm = {
      report_type: 'user_behavior' as 'user_behavior' | 'post_purchase_concern',
      user_reason_type: '',
      explanation: '',
      proof_files: [] as File[]
    };
    this.selectedProofFiles = [];
    this.proofPreviews = [];
    this.isSubmitting = false;
  }

  /**
   * Get current reason options based on report type
   */
  getCurrentReasonOptions(): string[] {
    return this.userReportForm.report_type === 'user_behavior' 
      ? this.userBehaviorReasons 
      : this.postPurchaseReasons;
  }

  /**
   * Handle report type change
   */
  onReportTypeChange() {
    this.userReportForm.user_reason_type = ''; // Reset reason type when report type changes
  }

  /**
   * Handle proof file selection
   */
  onProofFilesSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    
    for (const file of files) {
      // Check file count limit
      if (this.selectedProofFiles.length >= this.maxProofFiles) {
        this.notificationService.showWarning(
          'File Limit Reached',
          `You can only upload up to ${this.maxProofFiles} files.`
        );
        break;
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        this.notificationService.showError(
          'File Too Large',
          `${file.name} is too large. Maximum size is 10MB.`
        );
        continue;
      }

      // Check file type
      if (!this.allowedFileTypes.includes(file.type)) {
        this.notificationService.showError(
          'Invalid File Type',
          `${file.name} is not a supported file type.`
        );
        continue;
      }

      // Add file
      this.selectedProofFiles.push(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = {
          file: file,
          url: e.target?.result as string,
          type: file.type.startsWith('image/') ? 'image' as const : 'video' as const
        };
        this.proofPreviews.push(preview);
      };
      reader.readAsDataURL(file);
    }
    
    // Reset input
    event.target.value = '';
  }

  /**
   * Remove proof file
   */
  removeProofFile(index: number) {
    this.selectedProofFiles.splice(index, 1);
    this.proofPreviews.splice(index, 1);
  }

  /**
   * Validate user report form
   */
  validateUserReportForm(): boolean {
    if (!this.userReportForm.report_type) {
      this.notificationService.showError('Validation Error', 'Please select a report type.');
      return false;
    }

    if (!this.userReportForm.user_reason_type) {
      this.notificationService.showError('Validation Error', 'Please select a reason.');
      return false;
    }

    if (!this.userReportForm.explanation || this.userReportForm.explanation.trim().length < 10) {
      this.notificationService.showError('Validation Error', 'Please provide a detailed explanation (at least 10 characters).');
      return false;
    }

    return true;
  }

  /**
   * Convert files to base64
   */
  private async convertProofFilesToBase64(): Promise<string[]> {
    const base64Files: string[] = [];
    
    for (const file of this.selectedProofFiles) {
      try {
        const base64 = await this.fileToBase64(file);
        base64Files.push(base64);
      } catch (error) {
        console.error('Error converting file to base64:', error);
      }
    }
    
    return base64Files;
  }

  /**
   * Convert file to base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Submit user report
   */
  async submitUserReport() {
    if (!this.validateUserReportForm()) {
      return;
    }

    this.isSubmitting = true;

    try {
      // Convert proof files to base64
      const proofBase64Array = await this.convertProofFilesToBase64();

      // Prepare report data
      const reportData = {
        reporter_id: this.currentUserId,
        reported_user_id: this.reportedUser.id,
        conversation_id: this.conversationId,
        // Don't send product_id for user reports
        report_type: this.userReportForm.report_type,
        user_reason_type: this.userReportForm.user_reason_type,
        product_reason_type: null, // Always null for user reports
        reason_details: this.userReportForm.explanation,
        proof: proofBase64Array.length > 0 ? JSON.stringify(proofBase64Array) : null,
        status: 'pending'
      };

      console.log('Submitting user report:', reportData);

      // Submit report via API
      this.apiService.submitReport(reportData).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.notificationService.showSuccess(
              'Report Submitted',
              'Your report has been submitted successfully. We will review it shortly.'
            );
            this.closeUserReportModal();
            this.loadUserReports(); // Refresh the reports list
          } else {
            this.notificationService.showError(
              'Submission Failed',
              response.message || 'Failed to submit report. Please try again.'
            );
          }
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error submitting user report:', error);
          this.notificationService.showError(
            'Submission Failed',
            'An error occurred while submitting your report. Please try again.'
          );
          this.isSubmitting = false;
        }
      });

    } catch (error) {
      console.error('Error preparing report data:', error);
      this.notificationService.showError(
        'Submission Failed',
        'An error occurred while preparing your report. Please try again.'
      );
      this.isSubmitting = false;
    }
  }
}
