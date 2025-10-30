import { Component, OnInit, ViewChild } from '@angular/core';
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

export interface Report {
  report_id: number;
  reporter_id: number;
  reported_user_id?: number;
  product_id?: number;
  product_images?: string;
  product_description?: string;
  reason_type: 'scam' | 'fake product' | 'spam' | 'inappropriate content' | 'misleading information' | 'stolen item' | 'others';
  reason_details?: string;
  status: 'pending' | 'reviewed' | 'action_taken';
  created_at: string;
  reviewed_by?: number;
  reviewed_at?: string;
  // Additional fields from joins
  reporter_name?: string;
  reporter_email?: string;
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
    'report_id',
    'reporter_info',
    'reported_target',
    'reason_type',
    'reason_details',
    'status',
    'created_at',
    'reviewed_info',
    'actions'
  ];

  dataSource = new MatTableDataSource<Report>();
  loading = false;
  error: string | null = null;

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
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadReports();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.setupCustomFilter();
  }

  loadReports(): void {
    this.loading = true;
    this.error = null;

    this.apiService.getAllReports().subscribe({
      next: (response) => {
        this.loading = false;
        if (response.status === 'success') {
          this.dataSource.data = response.data || [];
          console.log('Reports loaded:', this.dataSource.data);
        } else {
          this.error = response.message || 'Failed to load reports';
          this.showSnackBar('Failed to load reports', 'error');
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Error loading reports';
        console.error('Error loading reports:', error);
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
}
