import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { ApiService } from '../../api/api.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';

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
  new_users_week: number;
  new_users_day: number;
  total_products: number;
  active_listings: number;
  new_listings_week: number;
  new_listings_day: number;
  pending_products: number;
  total_reports: number;
  product_reports: number;
  user_reports: number;
  pending_reports: number;
}

interface RecentActivity {
  activity_type: string;
  reference_id: number;
  user_name: string;
  product_name: string | null;
  report_type: string | null;
  activity_time: string;
  activity_message: string;
}

interface DashboardChartData {
  monthly_growth: any[];
  product_categories: any[];
  reports_by_reason: any[];
  top_sellers: any[];
  most_reported_accounts: any[];
}

type MonthFilterMode = 'current' | 'previous' | 'custom';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, FormsModule, AdminSidenavComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('monthlyGrowthCanvas', { static: false }) monthlyGrowthCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoriesCanvas', { static: false }) categoriesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('reportsCanvas', { static: false }) reportsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('listingStatusCanvas', { static: false }) listingStatusCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('reportPipelineCanvas', { static: false }) reportPipelineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('activityTypeCanvas', { static: false }) activityTypeCanvas!: ElementRef<HTMLCanvasElement>;

  dashboardStats: DashboardStats = {
    total_users: 0,
    new_users_week: 0,
    new_users_day: 0,
    total_products: 0,
    active_listings: 0,
    new_listings_week: 0,
    new_listings_day: 0,
    pending_products: 0,
    total_reports: 0,
    product_reports: 0,
    user_reports: 0,
    pending_reports: 0
  };
  
  recentActivities: RecentActivity[] = [];
  isLoading = true;
  isActivitiesLoading = false;
  adminId: number = 0;
  private refreshInterval: any;
  chartData: DashboardChartData = {
    monthly_growth: [],
    product_categories: [],
    reports_by_reason: [],
    top_sellers: [],
    most_reported_accounts: []
  };

  // Chart instances
  monthlyGrowthChart: Chart | null = null;
  categoriesChart: Chart | null = null;
  reportsChart: Chart | null = null;
  listingStatusChart: Chart | null = null;
  reportPipelineChart: Chart | null = null;
  activityTypeChart: Chart | null = null;

  heatmapDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  heatmapBuckets: Array<{ key: string; label: string; startHour: number; endHour: number }> = [
    { key: 'morning', label: 'Morning', startHour: 6, endHour: 11 },
    { key: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 17 },
    { key: 'evening', label: 'Evening', startHour: 18, endHour: 23 },
    { key: 'night', label: 'Night', startHour: 0, endHour: 5 }
  ];
  activityHeatmap: Record<string, Record<string, number>> = {};
  maxHeatmapValue = 0;
  compareActivityHeatmap: Record<string, Record<string, number>> = {};
  compareMaxHeatmapValue = 0;

  monthFilterMode: MonthFilterMode = 'current';
  customMonth = this.getCurrentMonthInputValue();
  compareMode = false;
  heatmapTitle = '';
  compareHeatmapTitle = '';
  heatmapEventDelta = 0;
  heatmapEventDeltaPercent = 0;

  constructor(private apiService: ApiService) {
    this.activityHeatmap = this.createEmptyHeatmapGrid();
    this.compareActivityHeatmap = this.createEmptyHeatmapGrid();

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
    this.loadRecentActivities();
    
    // Auto-refresh dashboard stats every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
      this.loadRecentActivities();
    }, 15000); // Refresh every 15 seconds for near real-time updates
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

          // These two charts are derived from dashboardStats directly.
          setTimeout(() => {
            this.initListingStatusChart();
            this.initReportPipelineChart();
          }, 100);
        }
      },
      error: (error: any) => {
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
      }
    });

    this.isLoading = false;
  }

  loadRecentActivities() {
    this.isActivitiesLoading = true;

    const primaryRange = this.getSelectedRange();
    this.heatmapTitle = this.getRangeTitle(primaryRange.startDate, primaryRange.endDate);

    const primaryRequest = this.apiService.getRecentActivities(500, primaryRange);

    if (!this.compareMode) {
      this.compareHeatmapTitle = '';
      this.heatmapEventDelta = 0;
      this.heatmapEventDeltaPercent = 0;

      primaryRequest.subscribe({
        next: (response: any) => {
          this.isActivitiesLoading = false;
          this.recentActivities = response?.status === 'success' ? (response.data || []) : [];

          const primaryHeatmap = this.computeHeatmap(this.recentActivities);
          this.activityHeatmap = primaryHeatmap.grid;
          this.maxHeatmapValue = primaryHeatmap.max;
          this.compareActivityHeatmap = this.createEmptyHeatmapGrid();
          this.compareMaxHeatmapValue = 0;

          setTimeout(() => this.initActivityTypeChart(), 100);
        },
        error: (error: any) => {
          this.isActivitiesLoading = false;
          this.recentActivities = [];
          const empty = this.computeHeatmap([]);
          this.activityHeatmap = empty.grid;
          this.maxHeatmapValue = empty.max;
        }
      });

      return;
    }

    const compareRange = this.getPreviousRange(primaryRange.startDate, primaryRange.endDate);
    this.compareHeatmapTitle = this.getRangeTitle(compareRange.startDate, compareRange.endDate);

    forkJoin([
      primaryRequest,
      this.apiService.getRecentActivities(500, compareRange)
    ]).subscribe({
      next: ([primaryResponse, compareResponse]) => {
        this.isActivitiesLoading = false;

        this.recentActivities = primaryResponse?.status === 'success' ? (primaryResponse.data || []) : [];
        const compareActivities = compareResponse?.status === 'success' ? (compareResponse.data || []) : [];

        const primaryHeatmap = this.computeHeatmap(this.recentActivities);
        const previousHeatmap = this.computeHeatmap(compareActivities);

        this.activityHeatmap = primaryHeatmap.grid;
        this.maxHeatmapValue = primaryHeatmap.max;
        this.compareActivityHeatmap = previousHeatmap.grid;
        this.compareMaxHeatmapValue = previousHeatmap.max;

        const primaryTotal = primaryHeatmap.total;
        const previousTotal = previousHeatmap.total;
        this.heatmapEventDelta = primaryTotal - previousTotal;
        this.heatmapEventDeltaPercent = previousTotal > 0
          ? ((primaryTotal - previousTotal) / previousTotal) * 100
          : (primaryTotal > 0 ? 100 : 0);

        setTimeout(() => this.initActivityTypeChart(), 100);
      },
      error: (error: any) => {
        this.isActivitiesLoading = false;
        this.recentActivities = [];
        const empty = this.computeHeatmap([]);
        this.activityHeatmap = empty.grid;
        this.maxHeatmapValue = empty.max;
        this.compareActivityHeatmap = empty.grid;
        this.compareMaxHeatmapValue = empty.max;
      }
    });
  }

  updateCharts(chartData: DashboardChartData) {
    // Chart data is now stored in this.chartData for future use
    this.chartData = chartData;
    
    // Initialize charts after data is available
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  initializeCharts() {
    this.initMonthlyGrowthChart();
    this.initCategoriesChart();
    this.initReportsChart();
    this.initListingStatusChart();
    this.initReportPipelineChart();
    this.initActivityTypeChart();
  }

  initListingStatusChart() {
    if (!this.listingStatusCanvas) return;

    if (this.listingStatusChart) {
      this.listingStatusChart.destroy();
    }

    const ctx = this.listingStatusCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const total = this.dashboardStats.total_products || 0;
    const active = this.dashboardStats.active_listings || 0;
    const pending = this.dashboardStats.pending_products || 0;
    const other = Math.max(total - active - pending, 0);

    this.listingStatusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Active', 'Pending', 'Other'],
        datasets: [{
          label: 'Listings',
          data: [active, pending, other],
          backgroundColor: ['#16a34a', '#f59e0b', '#64748b'],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Listing Status Snapshot',
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  initReportPipelineChart() {
    if (!this.reportPipelineCanvas) return;

    if (this.reportPipelineChart) {
      this.reportPipelineChart.destroy();
    }

    const ctx = this.reportPipelineCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const total = this.dashboardStats.total_reports || 0;
    const pending = this.dashboardStats.pending_reports || 0;
    const resolved = Math.max(total - pending, 0);

    this.reportPipelineChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Pending', 'Resolved'],
        datasets: [{
          data: [pending, resolved],
          backgroundColor: ['#f97316', '#16a34a'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Report Pipeline',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, padding: 16 }
          }
        }
      }
    });
  }

  initActivityTypeChart() {
    if (!this.activityTypeCanvas) return;

    if (this.activityTypeChart) {
      this.activityTypeChart.destroy();
    }

    const ctx = this.activityTypeCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const typeCounts: Record<string, number> = {
      new_user: 0,
      new_listing: 0,
      new_report: 0,
      new_user_report: 0,
      other: 0
    };

    for (const activity of this.recentActivities) {
      const key = activity.activity_type || 'other';
      if (typeCounts[key] === undefined) {
        typeCounts['other'] += 1;
      } else {
        typeCounts[key] += 1;
      }
    }

    this.activityTypeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['New Users', 'New Listings', 'Product Reports', 'User Reports', 'Other'],
        datasets: [{
          data: [
            typeCounts['new_user'],
            typeCounts['new_listing'],
            typeCounts['new_report'],
            typeCounts['new_user_report'],
            typeCounts['other']
          ],
          backgroundColor: ['#3b82f6', '#16a34a', '#f59e0b', '#ef4444', '#64748b'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Activity Type Mix (Recent Feed)',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, padding: 12 }
          }
        }
      }
    });
  }

  createEmptyHeatmapGrid(): Record<string, Record<string, number>> {
    const baseGrid: Record<string, Record<string, number>> = {};
    for (const day of this.heatmapDays) {
      baseGrid[day] = {};
      for (const bucket of this.heatmapBuckets) {
        baseGrid[day][bucket.key] = 0;
      }
    }
    return baseGrid;
  }

  computeHeatmap(activities: RecentActivity[]) {
    const grid = this.createEmptyHeatmapGrid();

    for (const activity of activities) {
      const date = new Date(activity.activity_time);
      if (Number.isNaN(date.getTime())) continue;

      const day = this.heatmapDays[date.getDay()];
      const hour = date.getHours();
      const bucket = this.heatmapBuckets.find(b => hour >= b.startHour && hour <= b.endHour)?.key;

      if (day && bucket) {
        grid[day][bucket] += 1;
      }
    }

    const values = this.heatmapDays.flatMap(day => this.heatmapBuckets.map(bucket => grid[day][bucket.key] || 0));
    return {
      grid,
      max: Math.max(0, ...values),
      total: values.reduce((sum, value) => sum + value, 0)
    };
  }

  getHeatmapCellStyle(day: string, bucketKey: string): Record<string, string> {
    const value = this.activityHeatmap?.[day]?.[bucketKey] || 0;
    const ratio = this.maxHeatmapValue > 0 ? value / this.maxHeatmapValue : 0;

    // Green intensity scale from very light to strong for quick scan.
    const alpha = 0.12 + ratio * 0.78;
    return {
      backgroundColor: `rgba(22, 163, 74, ${alpha.toFixed(2)})`,
      color: ratio > 0.58 ? '#ffffff' : '#14532d'
    };
  }

  getCompareHeatmapCellStyle(day: string, bucketKey: string): Record<string, string> {
    const value = this.compareActivityHeatmap?.[day]?.[bucketKey] || 0;
    const ratio = this.compareMaxHeatmapValue > 0 ? value / this.compareMaxHeatmapValue : 0;

    const alpha = 0.12 + ratio * 0.78;
    return {
      backgroundColor: `rgba(59, 130, 246, ${alpha.toFixed(2)})`,
      color: ratio > 0.58 ? '#ffffff' : '#1e3a8a'
    };
  }

  onMonthFilterModeChange(mode: MonthFilterMode) {
    this.monthFilterMode = mode;
    this.loadRecentActivities();
  }

  onCustomMonthChange() {
    if (this.monthFilterMode !== 'custom') {
      this.monthFilterMode = 'custom';
    }
    this.loadRecentActivities();
  }

  onCompareModeChange() {
    this.loadRecentActivities();
  }

  getSelectedRange() {
    const now = new Date();
    let year = now.getFullYear();
    let monthIndex = now.getMonth();

    if (this.monthFilterMode === 'previous') {
      monthIndex -= 1;
    } else if (this.monthFilterMode === 'custom' && this.customMonth) {
      const [yearText, monthText] = this.customMonth.split('-');
      const parsedYear = Number(yearText);
      const parsedMonth = Number(monthText);
      if (!Number.isNaN(parsedYear) && !Number.isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
        year = parsedYear;
        monthIndex = parsedMonth - 1;
      }
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    return {
      startDate: this.formatAsDateInput(start),
      endDate: this.formatAsDateInput(end)
    };
  }

  getPreviousRange(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    const isFullMonthRange =
      start.getDate() === 1 &&
      end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() &&
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth();

    if (isFullMonthRange) {
      const previousMonthStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      const previousMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);

      return {
        startDate: this.formatAsDateInput(previousMonthStart),
        endDate: this.formatAsDateInput(previousMonthEnd)
      };
    }

    const inclusiveDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - (inclusiveDays - 1));

    return {
      startDate: this.formatAsDateInput(previousStart),
      endDate: this.formatAsDateInput(previousEnd)
    };
  }

  getRangeTitle(startDate: string, endDate: string): string {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === 1 &&
      end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
    ) {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }

  getCurrentMonthInputValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  formatAsDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDeltaBadgeClass() {
    if (this.heatmapEventDelta > 0) return 'delta-positive';
    if (this.heatmapEventDelta < 0) return 'delta-negative';
    return 'delta-neutral';
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

  getActivityIcon(type: string): string {
    switch (type) {
      case 'new_user': return 'ðŸ‘¤';
      case 'new_listing': return 'ðŸ“¦';
      case 'new_report': return 'âš ï¸';
      case 'new_user_report': return 'ðŸš¨';
      default: return 'ðŸ“‹';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'new_user': return 'bg-blue-500';
      case 'new_listing': return 'bg-green-500';
      case 'new_report': return 'bg-orange-500';
      case 'new_user_report': return 'bg-red-500';
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
    // Clear refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
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
    if (this.listingStatusChart) {
      this.listingStatusChart.destroy();
    }
    if (this.reportPipelineChart) {
      this.reportPipelineChart.destroy();
    }
    if (this.activityTypeChart) {
      this.activityTypeChart.destroy();
    }
  }

}
