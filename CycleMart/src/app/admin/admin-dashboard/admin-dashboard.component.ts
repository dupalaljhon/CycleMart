import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

interface Notification {
  notification_id: number;
  type: string;
  title: string;
  message: string;
  reference_id?: number;
  created_at: string;
  created_by?: number;
  created_by_name?: string;
  is_read: boolean;
  read_at?: string;
}

interface DashboardStats {
  total_users: number;
  total_listings: number;
  total_products: number;
  total_reports: number;
}

interface DashboardChartData {
  monthly_growth: any[];
  product_categories: any[];
  reports_by_reason: any[];
  top_sellers: any[];
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, AdminSidenavComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('monthlyGrowthCanvas', { static: false }) monthlyGrowthCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoriesCanvas', { static: false }) categoriesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('reportsCanvas', { static: false }) reportsCanvas!: ElementRef<HTMLCanvasElement>;

  dashboardStats: DashboardStats = {
    total_users: 0,
    total_listings: 0,
    total_products: 0,
    total_reports: 0
  };
  
  recentNotifications: Notification[] = [];
  isLoading = true;
  adminId: number = 0;
  chartData: DashboardChartData = {
    monthly_growth: [],
    product_categories: [],
    reports_by_reason: [],
    top_sellers: []
  };

  // Chart instances
  monthlyGrowthChart: Chart | null = null;
  categoriesChart: Chart | null = null;
  reportsChart: Chart | null = null;

  constructor(private apiService: ApiService) {
    // Get admin ID from localStorage
    const storedId = localStorage.getItem('id');
    const adminUserData = localStorage.getItem('admin_user');
    
    if (storedId) {
      this.adminId = parseInt(storedId);
    } else if (adminUserData) {
      const adminUser = JSON.parse(adminUserData);
      this.adminId = adminUser.id || 0;
    } else {
      this.adminId = 0;
    }
  }

  ngOnInit() {
    this.loadDashboardData();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  }

  ngAfterViewInit() {
    // Charts will be initialized after data is loaded
  }

  loadDashboardData() {
    this.isLoading = true;
    
    // Load dashboard statistics
    this.apiService.getDashboardStats().subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.dashboardStats = response.data;
        }
      },
      error: (error: any) => {
        console.error('Error loading dashboard stats:', error);
      }
    });

    // Load chart data
    this.apiService.getChartData().subscribe({
      next: (response: any) => {
        if (response.status === 'success') {
          this.updateCharts(response.data);
        }
      },
      error: (error: any) => {
        console.error('Error loading chart data:', error);
      }
    });

    // Load recent notifications
    if (this.adminId) {
      this.apiService.getAdminNotifications(this.adminId).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.status === 'success') {
            this.recentNotifications = response.data;
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          console.error('Error loading notifications:', error);
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  updateCharts(chartData: DashboardChartData) {
    // Chart data is now stored in this.chartData for future use
    this.chartData = chartData;
    console.log('Chart data loaded:', chartData);
    
    // Initialize charts after data is available
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  initializeCharts() {
    this.initMonthlyGrowthChart();
    this.initCategoriesChart();
    this.initReportsChart();
  }

  initMonthlyGrowthChart() {
    if (!this.monthlyGrowthCanvas || !this.chartData.monthly_growth) return;

    // Destroy existing chart
    if (this.monthlyGrowthChart) {
      this.monthlyGrowthChart.destroy();
    }

    const ctx = this.monthlyGrowthCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.chartData.monthly_growth.map(item => 
      this.getMonthName(item.month)
    );
    const usersData = this.chartData.monthly_growth.map(item => parseInt(item.users));
    const productsData = this.chartData.monthly_growth.map(item => parseInt(item.products));

    this.monthlyGrowthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'New Users',
            data: usersData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'New Products',
            data: productsData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Monthly Growth - Users & Products',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  initCategoriesChart() {
    if (!this.categoriesCanvas || !this.chartData.product_categories) return;

    // Destroy existing chart
    if (this.categoriesChart) {
      this.categoriesChart.destroy();
    }

    const ctx = this.categoriesCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.chartData.product_categories.map(item => 
      item.category.charAt(0).toUpperCase() + item.category.slice(1)
    );
    const data = this.chartData.product_categories.map(item => parseInt(item.count));
    
    this.categoriesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', 
            '#10b981', '#f97316', '#ec4899', '#6366f1'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Product Categories Distribution',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'right',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          }
        }
      }
    });
  }

  initReportsChart() {
    if (!this.reportsCanvas || !this.chartData.reports_by_reason) return;

    // Destroy existing chart
    if (this.reportsChart) {
      this.reportsChart.destroy();
    }

    const ctx = this.reportsCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.chartData.reports_by_reason.map(item => 
      item.reason_type.replace('_', ' ').toUpperCase()
    );
    const data = this.chartData.reports_by_reason.map(item => parseInt(item.count));
    
    this.reportsChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#ef4444', '#f97316', '#f59e0b', '#eab308', 
            '#84cc16', '#22c55e', '#10b981', '#14b8a6'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Reports by Reason Type',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          }
        }
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'new_user': return 'U';
      case 'new_listing': return 'L';
      case 'system': return 'S';
      default: return 'N';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'new_user': return 'bg-blue-500';
      case 'new_listing': return 'bg-green-500';
      case 'system': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  }

  getTimeAgo(dateString: string): string {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  // Chart helper methods
  getMonthName(monthString: string): string {
    const date = new Date(monthString + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  ngOnDestroy() {
    // Clean up chart instances to prevent memory leaks
    if (this.monthlyGrowthChart) {
      this.monthlyGrowthChart.destroy();
    }
    if (this.categoriesChart) {
      this.categoriesChart.destroy();
    }
    if (this.reportsChart) {
      this.reportsChart.destroy();
    }
  }

}
