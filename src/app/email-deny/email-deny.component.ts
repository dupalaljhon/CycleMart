import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

const API_BASE_URL = 'https://cyclemart.shop/api';

@Component({
  selector: 'app-email-deny',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-deny.component.html',
  styleUrl: './email-deny.component.css'
})
export class EmailDenyComponent implements OnInit, OnDestroy {
  isLoading = true;
  status: 'loading' | 'success' | 'error' = 'loading';
  message = '';
  token = '';
  email = '';
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
        this.setError('This link is invalid or already used.');
        return;
      }

      this.denyEmail();
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  private denyEmail(): void {
    this.isLoading = true;
    this.status = 'loading';
    this.message = '';

    this.http
      .post<{ status?: string; message?: string }>(`${API_BASE_URL}/deny`, {
        token: this.token,
        email: this.email
      })
      .subscribe({
        next: response => {
          this.isLoading = false;
          if (response?.status === 'success') {
            this.status = 'success';
            this.message = 'Account registration has been cancelled.';
          } else {
            this.setError('This link is invalid or already used.');
          }
        },
        error: () => {
          this.setError('This link is invalid or already used.');
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
