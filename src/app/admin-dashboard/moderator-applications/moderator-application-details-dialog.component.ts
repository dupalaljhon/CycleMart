import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-moderator-application-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatCardModule, MatChipsModule, MatDividerModule],
  templateUrl: './moderator-application-details-dialog.component.html',
  styleUrls: ['./moderator-application-details-dialog.component.css']
})
export class ModeratorApplicationDetailsDialogComponent {
  dialogRef = inject(MatDialogRef<ModeratorApplicationDetailsDialogComponent>);
  data: any = inject(MAT_DIALOG_DATA);

  close(): void {
    this.dialogRef.close();
  }

  approve(): void {
    this.dialogRef.close({ action: 'approve' });
  }

  reject(): void {
    this.dialogRef.close({ action: 'reject' });
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  }
}
