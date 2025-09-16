import { Component, HostListener, OnInit } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { AuthService } from '../api/auth.service';
import { ThemeService } from '../services/theme.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterModule, NgIf, NgClass],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.css'
})
export class SidenavComponent implements OnInit {
  isCollapsed = false;   // for desktop shrink/expand
  isSidebarOpen = false; // for mobile open/close
  isMobile = false;      // detects screen size
  activeRoute = '';      // track current route

  constructor(
    private authService: AuthService, 
    private router: Router,
    private themeService: ThemeService
  ) {
    this.checkScreenSize();
    
    // Track route changes for active state
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.activeRoute = event.url;
      });
  }

  ngOnInit() {
    // Set initial active route
    this.activeRoute = this.router.url;
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    this.isMobile = window.innerWidth < 1024; // lg breakpoint for better mobile detection
    if (!this.isMobile) {
      this.isSidebarOpen = true; // always open on desktop
      this.isCollapsed = false; // reset collapse state on desktop
    } else {
      this.isSidebarOpen = false; // closed by default on mobile
      this.isCollapsed = false; // not applicable on mobile
    }
  }

  toggleCollapse() {
    if (!this.isMobile) {
      this.isCollapsed = !this.isCollapsed;
    }
  }

  toggleSidebar() {
    if (this.isMobile) {
      this.isSidebarOpen = !this.isSidebarOpen;
      
      // Prevent body scroll when sidebar is open on mobile
      if (this.isSidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    }
  }

  toggleTheme() {
    // Theme toggle disabled - always light mode
  }

  // Close sidebar when navigating on mobile
  closeSidebarOnNavigate() {
    if (this.isMobile && this.isSidebarOpen) {
      this.toggleSidebar();
    }
  }

  logout() {
    // Add confirmation dialog
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  // Check if route is active
  isRouteActive(route: string): boolean {
    return this.activeRoute === route || this.activeRoute.startsWith(route + '/');
  }
}
