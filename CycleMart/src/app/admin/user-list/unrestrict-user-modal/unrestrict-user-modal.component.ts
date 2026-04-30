import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

interface UnrestrictDialogData {
  userName: string;
}

@Component({
  selector: 'app-unrestrict-user-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './unrestrict-user-modal.component.html',
  styleUrl: './unrestrict-user-modal.component.css'
})
export class UnrestrictUserModalComponent {
  reason = 'Restriction period completed and account restored';

  constructor(
    public dialogRef: MatDialogRef<UnrestrictUserModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UnrestrictDialogData
  ) {}

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    const trimmed = this.reason.trim();
    if (trimmed.length < 5) {
      return;
    }
    this.dialogRef.close({ reason: trimmed });
  }
}
