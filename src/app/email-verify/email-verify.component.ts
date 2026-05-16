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
      .get<{ status?: string; message?: string }>(url)
      .subscribe({
        next: response => {
          this.isLoading = false;
          this.status = 'success';
          this.message = 'Your account has been verified! Redirecting to login...';
          this.redirectTimer = setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        },
        error: () => {
          this.setError('Verification failed. The link may be expired or already used.');
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