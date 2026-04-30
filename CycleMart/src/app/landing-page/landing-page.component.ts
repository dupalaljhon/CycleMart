import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../api/api.service';

@Component({
  selector: 'app-landing-page',
  imports: [],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent implements OnInit {
  currentYear = 2026; // You can edit this year manually
  visitCount = 0;

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.apiService.incrementLandingPageVisit().subscribe({
      next: (response: any) => {
        if (response?.status === 'success' && response?.data?.visit_count !== undefined) {
          this.visitCount = Number(response.data.visit_count) || 0;
        }
      },
      error: () => {
        this.visitCount = 0;
      }
    });
  }

  goToLogin(mode: 'login' | 'signup' = 'login') {
    this.router.navigate(['/login'], { queryParams: { mode } });
  }
}
