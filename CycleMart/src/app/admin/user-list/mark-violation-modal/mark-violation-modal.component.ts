import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../api/api.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface User {
  id: number;
  full_name: string;
  email: string;
  violation_count: number;
  account_status: string;
}

@Component({
  selector: 'app-mark-violation-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './mark-violation-modal.component.html',
  styleUrls: ['./mark-violation-modal.component.css']
})
export class MarkViolationModalComponent {
  violationLevel: number = 1;
  reason: string = '';
  isSubmitting: boolean = false;
  errorMessage: string = '';
  showSanctionGuide: boolean = true;
  openGuidelineIndex: number | null = 0;

  violationLevels = [
    { value: 1, label: 'Level 1 - Warning ', status: 'active', description: 'User receives a warning, account remains active' },
    { value: 2, label: 'Level 2 - Restricted ', status: 'restricted', description: 'User account will be restricted with limited access' },
    { value: 3, label: 'Level 3 - Suspended ', status: 'suspended', description: 'User account will be temporarily suspended' },
    { value: 4, label: 'Level 4 - Permanently Banned ', status: 'banned', description: 'User account will be permanently banned' }
  ];

  sanctionGuidelines = [
    {
      title: 'Level 1 - Warning (Minor, First Offense)',
      summary: 'Use for incomplete details, misleading captions, or low-impact rule slips.',
      points: [
        'Apply when the issue appears unintentional and has limited marketplace impact.',
        'Require correction and remind the user of the specific violated policy.',
        'Escalate only if the same behavior repeats after warning.'
      ]
    },
    {
      title: 'Level 2 - Restricted (Repeated or Moderate Offense)',
      summary: 'Use for repeated minor violations or moderate misconduct affecting trust.',
      points: [
        'Apply when a user repeats warned behavior or posts prohibited listing content.',
        'Restrict posting and interaction privileges for a clear corrective period.',
        'Explain what must change before full privileges are restored.'
      ]
    },
    {
      title: 'Level 3 - Suspended (Serious or Continuous Abuse)',
      summary: 'Use for severe misconduct, harassment, fraud indicators, or repeated defiance.',
      points: [
        'Apply when user actions materially harm buyers, sellers, or platform safety.',
        'Suspend account access while final review is documented by moderators.',
        'Reinstate only when evidence supports compliance and risk is controlled.'
      ]
    },
    {
      title: 'Level 4 - Permanent Ban (Critical Abuse)',
      summary: 'Use for confirmed scams, repeated severe abuse, or irreversible trust breach.',
      points: [
        'Apply when violation patterns indicate sustained malicious behavior.',
        'Document complete evidence trail before finalizing permanent ban.',
        'Use only when lower sanctions are no longer effective or risk is unacceptable.'
      ]
    }
  ];

  constructor(
    public dialogRef: MatDialogRef<MarkViolationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user: User },
    private apiService: ApiService
  ) {}

  getSelectedLevelInfo() {
    return this.violationLevels.find(level => level.value === this.violationLevel);
  }

  toggleSanctionGuide(): void {
    this.showSanctionGuide = !this.showSanctionGuide;
  }

  toggleGuideline(index: number): void {
    this.openGuidelineIndex = this.openGuidelineIndex === index ? null : index;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    // Validation
    if (!this.reason || this.reason.trim().length === 0) {
      this.errorMessage = 'Please provide a reason for the violation';
      return;
    }

    if (this.reason.trim().length < 10) {
      this.errorMessage = 'Reason must be at least 10 characters long';
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    const violationData = {
      user_id: this.data.user.id,
      level: this.violationLevel,
      reason: this.reason.trim()
    };

    this.apiService.markUserViolation(violationData).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.status === 'success') {
          this.dialogRef.close({ 
            success: true, 
            data: response.data,
            message: response.message
          });
        } else {
          this.errorMessage = response.message || 'Failed to mark violation';
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error.error?.message || error.message || 'An error occurred while marking violation';
      }
    });
  }

  getViolationIcon(level: number): string {
    switch(level) {
      case 1: return 'Warning ';
      case 2: return 'Block ';
      case 3: return 'Do Not Disturb ';
      case 4: return 'Gavel ';
      default: return 'Warning ';
    }
  }

  // getViolationColor(level: number): string {
  //   switch(level) {
  //     case 1: return 'text-yellow-600';
  //     case 2: return 'text-orange-600';
  //     case 3: return 'text-red-600';
  //     case 4: return 'text-red-800';
  //     default: return 'text-gray-600';
  //   }
  // }
}
