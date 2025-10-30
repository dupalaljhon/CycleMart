import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../api/auth.service';

@Component({
  selector: 'app-admin-sidenav',
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-sidenav.component.html',
  styleUrl: './admin-sidenav.component.css'
})
export class AdminSidenavComponent implements OnInit {
  adminUser: any = null;
  activeRoute: string = '';
  isMobile: boolean = false;
  isSidebarOpen: boolean = false;
  isCollapsed: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Get admin user info from localStorage
    const adminUserData = localStorage.getItem('admin_user');
    if (adminUserData) {
      this.adminUser = JSON.parse(adminUserData);
    }

    // Set initial active route
    this.activeRoute = this.router.url;
    
    // Check initial screen size
    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  checkScreenSize() {
    const previousIsMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768; // md breakpoint
    
    // If switching from mobile to desktop, close the mobile sidebar
    if (previousIsMobile && !this.isMobile) {
      this.isSidebarOpen = false;
    }
    
    // If switching from desktop to mobile, reset collapsed state
    if (!previousIsMobile && this.isMobile) {
      this.isCollapsed = false;
    }
  }

  toggleSidebar() {
    if (this.isMobile) {
      this.isSidebarOpen = !this.isSidebarOpen;
      // Force DOM update
      setTimeout(() => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          if (this.isSidebarOpen) {
            sidebar.classList.remove('mobile-closed');
            sidebar.classList.add('mobile-open');
          } else {
            sidebar.classList.remove('mobile-open');
            sidebar.classList.add('mobile-closed');
          }
        }
      }, 0);
    } else {
      this.isCollapsed = !this.isCollapsed;
    }
  }

  expandSidebar() {
    if (!this.isMobile) {
      this.isCollapsed = false;
    }
  }

  collapseSidebar() {
    if (!this.isMobile) {
      this.isCollapsed = true;
    }
  }

  closeSidebar() {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }

  navigateToAdminDashboard() {
    this.activeRoute = '/admin-dashboard';
    this.router.navigate(['/admin-dashboard']);
    this.closeSidebar();
  }

  navigateToListingMonitoring() {
    this.activeRoute = '/listing-monitoring';
    this.router.navigate(['/listing-monitoring']);
    this.closeSidebar();
  }

  navigateToUserList() {
    this.activeRoute = '/user-list';
    this.router.navigate(['/user-list']);
    this.closeSidebar();
  }

  navigateToAdminMonitoring() {
    this.activeRoute = '/admin-monitoring';
    this.router.navigate(['/admin-monitoring']);
    this.closeSidebar();
  }

  navigateToReportMonitoring() {
    this.activeRoute = '/report-monitoring';
    this.router.navigate(['/report-monitoring']);
    this.closeSidebar();
  }

  logout() {
    // Clear admin session data
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    
    // Navigate to login page
    this.router.navigate(['/login']);
    this.closeSidebar();
  }

  isActiveRoute(route: string): boolean {
    return this.activeRoute === route;
  }
}
