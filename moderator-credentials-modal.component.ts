import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

// Add these properties to your ModeratorApplicationsComponent class

export class ModeratorApplicationsComponent {
  showCredentialsModal = false;
  showPassword = false;
  newAdminCredentials: any = null;

  constructor(private snackBar: MatSnackBar) {}

  // Update your existing reviewApplication method to capture credentials
  private reviewApplication(applicationId: number, action: string, fullName: string): void {
    if (!this.adminId) {
      this.snackBar.open('Admin ID not found', 'Close', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    const data = {
      application_id: applicationId,
      action: action,
      reviewed_by: this.adminId
    };

    this.apiService.reviewModeratorApplication(data).subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          // ðŸ”¹ CHECK IF NEW ADMIN ACCOUNT WAS CREATED
          if (action === 'approve' && response.data.new_admin_account) {
            this.newAdminCredentials = response.data.new_admin_account;
            this.showCredentialsModal = true;
          } else {
            this.snackBar.open(
              action === 'approve' 
                ? `${fullName} approved as moderator successfully!` 
                : `${fullName}'s application has been rejected`,
              'Close',
              { duration: 4000, panelClass: ['success-snackbar'] }
            );
          }
          
          // Reload applications
          if (this.selectedFilter === 'all') {
            this.loadApplications();
          } else {
            this.loadApplications(this.selectedFilter);
          }
        } else {
          this.snackBar.open(response.message || 'Failed to review application', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        const errorMessage = error.error?.message || 'An error occurred while reviewing the application';
        this.snackBar.open(errorMessage, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.isLoading = false;
      }
    });
  }

  // ðŸ”¹ NEW METHODS FOR CREDENTIALS MODAL

  closeCredentialsModal(): void {
    this.showCredentialsModal = false;
    this.showPassword = false;
    this.newAdminCredentials = null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  copyToClipboard(text: string, fieldName: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open(`${fieldName} copied to clipboard!`, 'Close', {
        duration: 2000,
        panelClass: ['success-snackbar']
      });
    }).catch(err => {
      this.snackBar.open('Failed to copy to clipboard', 'Close', {
        duration: 2000,
        panelClass: ['error-snackbar']
      });
    });
  }

  copyAllCredentials(): void {
    if (!this.newAdminCredentials) return;

    const credentialsText = `
CycleMart Moderator Account Credentials
========================================
Full Name: ${this.newAdminCredentials.full_name}
Username: ${this.newAdminCredentials.username}
Email: ${this.newAdminCredentials.email}
Password: ${this.newAdminCredentials.password}
Role: ${this.newAdminCredentials.role}

âš ï¸ IMPORTANT INSTRUCTIONS:
1. Change password immediately after first login
2. Access admin panel at: http://localhost:4200/admin
3. Never share these credentials via plain email
4. This password will not be shown again

Generated: ${new Date().toLocaleString()}
    `.trim();

    navigator.clipboard.writeText(credentialsText).then(() => {
      this.snackBar.open('All credentials copied to clipboard!', 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    }).catch(err => {
      this.snackBar.open('Failed to copy to clipboard', 'Close', {
        duration: 2000,
        panelClass: ['error-snackbar']
      });
    });
  }

  printCredentials(): void {
    if (!this.newAdminCredentials) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackBar.open('Please allow popups to print credentials', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Moderator Credentials - ${this.newAdminCredentials.full_name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .credentials {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .credential-row {
            margin: 15px 0;
            padding: 10px;
            background: white;
            border-left: 4px solid #7c3aed;
          }
          .label {
            font-weight: bold;
            color: #555;
            display: inline-block;
            width: 120px;
          }
          .value {
            font-family: monospace;
            color: #000;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-top: 30px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #777;
            font-size: 12px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CycleMart Moderator Account</h1>
          <h2>Login Credentials</h2>
        </div>
        
        <div class="credentials">
          <div class="credential-row">
            <span class="label">Full Name:</span>
            <span class="value">${this.newAdminCredentials.full_name}</span>
          </div>
          <div class="credential-row">
            <span class="label">Username:</span>
            <span class="value">${this.newAdminCredentials.username}</span>
          </div>
          <div class="credential-row">
            <span class="label">Email:</span>
            <span class="value">${this.newAdminCredentials.email}</span>
          </div>
          <div class="credential-row">
            <span class="label">Password:</span>
            <span class="value">${this.newAdminCredentials.password}</span>
          </div>
          <div class="credential-row">
            <span class="label">Role:</span>
            <span class="value">${this.newAdminCredentials.role.toUpperCase()}</span>
          </div>
        </div>

        <div class="warning">
          <h3>âš ï¸ IMPORTANT SECURITY INSTRUCTIONS</h3>
          <ul>
            <li>Change your password immediately after first login</li>
            <li>Access the admin panel at: <strong>http://localhost:4200/admin</strong></li>
            <li>Never share these credentials with anyone</li>
            <li>Keep this document in a secure location</li>
            <li>This password will not be shown again after closing this window</li>
          </ul>
        </div>

        <div class="footer">
          Generated on ${new Date().toLocaleString()}<br>
          CycleMart Admin Panel
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
}
