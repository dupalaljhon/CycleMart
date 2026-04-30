import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { AuthService } from '../api/auth.service';
import { ApiService } from '../api/api.service';
import { ThemeService } from '../services/theme.service';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterModule, NgIf, NgClass],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.css'
})
export class SidenavComponent implements OnInit, OnDestroy {
  isCollapsed = false;   // for desktop shrink/expand
  isSidebarOpen = false; // for mobile open/close
  isMobile = false;      // detects screen size
  activeRoute = '';      // track current route
  showLogoutModal = false; // for logout confirmation modal
  
  // User profile properties
  userName: string | null = null;
  userProfileImage: string | null = null;
  userId: number | null = null;
  userRole: string = 'user'; // 'user', 'moderator', or 'admin'
  isLoadingProfile: boolean = true;
  
  // Badge counts
  unreadMessagesCount: number = 0;
  unreadNotificationsCount: number = 0;
  private refreshInterval: any;
  private notificationUpdateHandler: any;

  constructor(
    private authService: AuthService, 
    private apiService: ApiService,
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
    
    // Load user profile data
    this.loadUserProfile();
    
    // Load unread counts
    this.loadUnreadCounts();
    
    // Refresh counts every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadUnreadCounts();
    }, 30000);

    // Create bound handler for notification updates
    this.notificationUpdateHandler = () => {
      this.loadUnreadCounts();
    };

    // Listen for notification updates from notification component
    // window.addEventListener('notificationsUpdated', this.notificationUpdateHandler);
  }
  
  ngOnDestroy() {
    // Clear interval when component is destroyed
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Remove event listener with the same handler reference
    if (this.notificationUpdateHandler) {
      // window.removeEventListener('notificationsUpdated', this.notificationUpdateHandler);
    }
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
    // Show logout modal instead of alert
    this.showLogoutModal = true;
  }

  // Confirm logout and proceed
  confirmLogout() {
    this.showLogoutModal = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Cancel logout and close modal
  cancelLogout() {
    this.showLogoutModal = false;
  }

  // Check if route is active
  isRouteActive(route: string): boolean {
    return this.activeRoute === route || this.activeRoute.startsWith(route + '/');
  }

  // Load user profile data
  loadUserProfile() {
    try {
      // Check multiple possible localStorage keys for user ID
      let userIdStr = localStorage.getItem('id'); // This is what AuthService saves
      if (!userIdStr) {
        userIdStr = localStorage.getItem('userID'); // Check for this format too
      }
      if (!userIdStr) {
        userIdStr = localStorage.getItem('user_id'); // Legacy format
      }
      if (!userIdStr) {
        userIdStr = localStorage.getItem('userId'); // Alternative format
      }


      if (userIdStr) {
        this.userId = parseInt(userIdStr, 10);
        
        // Get user role from localStorage (saved during login)
        this.userRole = (localStorage.getItem('user_role') || 'user').toLowerCase();

        // Seed profile data from localStorage for immediate display
        this.userName = localStorage.getItem('full_name') || localStorage.getItem('username');
        this.userProfileImage = localStorage.getItem('profile_image');

        this.isLoadingProfile = false;
        
        // Fetch user data from API
        // this.apiService.getUser(this.userId).subscribe({
        //   next: (response) => {
        //     if (response && response.status === 'success' && response.data && response.data.length > 0) {
        //       const userData = response.data[0];
        //       this.userName = userData.full_name;
        //       this.userProfileImage = userData.profile_image;
        //     } else {
        //     }
        //     this.isLoadingProfile = false;
        //   },
        //   error: (error) => {
        //     // Try to get all users and find by email as fallback
        //     this.tryLoadByEmail();
        //   }
        // });
      } else {
        // Try to get by email if ID is not available
        this.tryLoadByEmail();
      }
    } catch (error) {
      this.isLoadingProfile = false;
    }
  }

  // Get profile image URL
  getProfileImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    const stripped = imagePath
      .replace(/^\/?api\/uploads[\/\\]/, '')
      .replace(/^\/?uploads[\/\\]/, '');
    return `${environment.apiUploadsBaseUrl}${stripped}`;
    
    // ðŸ”’ PRODUCTION - Use when deploying (comment out localhost above)
    // const stripped = imagePath.replace(/^\/?uploads[\/]/, '');
    // const fullUrl = `http://images.cyclemart.shop/${stripped}`;
    // return fullUrl;
  }

  // Try to load user profile by email as fallback
  tryLoadByEmail() {
    const email = localStorage.getItem('email');
    if (email) {
      this.apiService.getAllUsers().subscribe({
        next: (response) => {
          if (response && response.status === 'success' && response.data && Array.isArray(response.data)) {
            const user = response.data.find((u: any) => u.email === email);
            if (user) {
              this.userId = user.id;
              this.userName = user.full_name;
              this.userProfileImage = user.profile_image;
              // Save the user ID for future use
              localStorage.setItem('id', user.id.toString());
            } else {
            }
          } else {
          }
          this.isLoadingProfile = false;
        },
        error: (error) => {
          this.isLoadingProfile = false;
        }
      });
    } else {
      this.isLoadingProfile = false;
    }
  }

  // Manual reload function for debugging
  reloadProfile() {
    this.isLoadingProfile = true;
    this.loadUserProfile();
  }

  // Handle profile image error (fallback to default icon)
  onProfileImageError(event: any) {
    this.userProfileImage = null;
  }

  // Extract first name from full name
  getFirstName(fullName: string): string {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  }
  
  // Load unread counts for messages and notifications
  loadUnreadCounts() {
    const userId = localStorage.getItem('id');
    if (!userId) return;
    
    
    this.apiService.getUnreadCounts(parseInt(userId)).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          const prevMessages = this.unreadMessagesCount;
          const prevNotifications = this.unreadNotificationsCount;
          
          this.unreadMessagesCount = response.data.unread_messages || 0;
          this.unreadNotificationsCount = response.data.unread_notifications || 0;
          
        }
      },
      error: (error) => {
      }
    });
  }
}
