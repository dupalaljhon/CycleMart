import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { Observable } from 'rxjs';

export interface QuickReportData {
  reported_user_id?: number;
  product_id?: number;
  reason_type: 'scam' | 'fake product' | 'spam' | 'inappropriate content' | 'misleading information' | 'stolen item' | 'others';
  reason_details: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  constructor(private apiService: ApiService) {}

  // Quick report method for use in other components
  quickReport(reportData: QuickReportData, reporterId: number): Observable<any> {
    const fullReportData = {
      reporter_id: reporterId,
      ...reportData
    };

    return this.apiService.submitReport(fullReportData);
  }

  // Get user reports
  getUserReports(userId: number): Observable<any> {
    return this.apiService.getUserReports(userId);
  }

  // Get all reports (admin only)
  getAllReports(): Observable<any> {
    return this.apiService.getAllReports();
  }

  // Update report status (admin only)
  updateReportStatus(reportId: number, status: string, reviewerId: number): Observable<any> {
    return this.apiService.updateReportStatus({
      report_id: reportId,
      status: status,
      reviewed_by: reviewerId
    });
  }

  // Predefined report reasons with descriptions (matching database enum)
  getReportReasons() {
    return [
      {
        value: 'scam',
        label: 'Scam/Fraud',
        description: 'This user or product appears to be fraudulent',
        icon: '⚠️'
      },
      {
        value: 'fake product',
        label: 'Fake Product',
        description: 'This product appears to be counterfeit or misrepresented',
        icon: '🚫'
      },
      {
        value: 'spam',
        label: 'Spam',
        description: 'This content is spam or unwanted advertising',
        icon: '📧'
      },
      {
        value: 'inappropriate content',
        label: 'Inappropriate Content',
        description: 'This content is inappropriate or offensive',
        icon: '🔞'
      },
      {
        value: 'misleading information',
        label: 'Misleading Information',
        description: 'This contains false or misleading information',
        icon: '❌'
      },
      {
        value: 'stolen item',
        label: 'Stolen Item',
        description: 'This item appears to be stolen or illegally obtained',
        icon: '🚨'
      },
      {
        value: 'others',
        label: 'Others',
        description: 'Other reason not listed above',
        icon: '📝'
      }
    ];
  }
}