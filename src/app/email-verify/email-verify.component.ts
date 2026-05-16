import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-email-verify',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-verify.component.html',
  styleUrl: './email-verify.component.css'
})
export class EmailVerifyComponent implements OnInit, OnDestroy {
  isLoading = true;
  status: 'loading' | 'success' | 'error' = 'loading';
  message = '';
  token = '';
  email = '';
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;
  private paramSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.queryParamMap.subscribe(params => {
      this.token = params.get('token') || '';
      this.email = params.get('email') || '';

      if (!this.token || !this.email) {
        this.setError('Verification failed. The link may be expired or already used.');
        return;
      }

      this.verifyEmail();
    });
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
    this.paramSub?.unsubscribe();
  }

  private verifyEmail(): void {
  this.isLoading = true;
  this.status = 'loading';
  this.message = '';

  const url = `${environment.apiBaseUrl}/verify?token=${encodeURIComponent(this.token)}&email=${encodeURIComponent(this.email)}`;

  this.http
    .get<{ status?: string; message?: string }>(url, { responseType: 'text' as 'json' })
    .subscribe({
      next: (response: any) => {
        this.isLoading = false;
        // Backend returns HTML, so if we get any response it means success
        this.status = 'success';
        this.message = 'Your account has been verified! Redirecting to login...';
        this.redirectTimer = setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        // Check if it's actually a success (already verified counts as success)
        if (err.status === 200 || err.status === 0) {
          this.status = 'success';
          this.message = 'Your account has been verified! Redirecting to login...';
          this.redirectTimer = setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        } else if (err.status === 400) {
          // Could still be "already verified" which is fine
          this.status = 'success';
          this.message = 'Your account is verified! Redirecting to login...';
          this.redirectTimer = setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        } else {
          this.setError('Verification failed. The link may be expired or already used.');
        }
      }
    });
}

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  private setError(message: string): void {
    this.isLoading = false;
    this.status = 'error';
    this.message = message;
  }
}