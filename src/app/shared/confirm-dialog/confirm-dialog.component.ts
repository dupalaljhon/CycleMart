import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'warn' | 'accent';
}

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Please confirm' }}</h2>
    <mat-dialog-content class="mat-typography">{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>{{ data.cancelText || 'Cancel' }}</button>
      <button
        mat-flat-button
        [mat-dialog-close]="true"
        class="confirm-btn"
        [class.confirm-green]="data.confirmColor === 'primary'"
        [class.confirm-red]="data.confirmColor === 'warn'"
        [class.confirm-accent]="data.confirmColor === 'accent'"
      >
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  styles: [
    `.confirm-btn { font-weight: 700; color: #fff; border-radius: 8px; padding: 0.5rem 0.9rem; }
     .confirm-green { background: linear-gradient(180deg,#1f6b3f 0%,#155a32 100%); }
     .confirm-green:hover { background: linear-gradient(180deg,#185a37 0%,#114f2d 100%); }
     .confirm-red { background: linear-gradient(180deg,#d94343 0%,#b91c1c 100%); }
     .confirm-red:hover { background: linear-gradient(180deg,#c33d3d 0%,#a01414 100%); }
     .confirm-accent { background: linear-gradient(180deg,#7c3aed 0%,#5b21b6 100%); }
     mat-dialog-content { padding-top: 12px; padding-bottom: 12px; color: #374151; }
     h2 { margin: 0; padding: 12px 20px; font-weight: 700; border-top-left-radius: 12px; border-top-right-radius: 12px; }
     :host { display:block; }
     ::ng-deep .mat-dialog-container { border-radius: 12px !important; box-shadow: 0 18px 48px rgba(2,6,23,0.12) !important; }
     mat-dialog-actions { padding: 14px 18px; }
    `
  ]
})
export class ConfirmDialogComponent {
  dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
}
