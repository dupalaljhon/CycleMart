import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { AuthService } from '../api/auth.service';
import { ApiService } from '../api/api.service';
import { ThemeService } from '../services/theme.service';
import { filter } from 'rxjs/operators';

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
      console.log('🔔 Notification update event received');
      this.loadUnreadCounts();
    };

    // Listen for notification updates from notification component
    window.addEventListener('notificationsUpdated', this.notificationUpdateHandler);
  }
  
  ngOnDestroy() {
    // Clear interval when component is destroyed
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Remove event listener with the same handler reference
    if (this.notificationUpdateHandler) {
      window.removeEventListener('notificationsUpdated', this.notificationUpdateHandler);
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

      console.log('🔍 Checking localStorage for user ID...');
      console.log('🔍 id:', localStorage.getItem('id'));
      console.log('🔍 userID:', localStorage.getItem('userID'));
      console.log('🔍 user_id:', localStorage.getItem('user_id'));
      console.log('🔍 userId:', localStorage.getItem('userId'));
      console.log('🔍 email:', localStorage.getItem('email'));
      console.log('🔍 authToken:', localStorage.getItem('authToken'));
      console.log('🔍 All localStorage keys:', Object.keys(localStorage));

      if (userIdStr) {
        this.userId = parseInt(userIdStr, 10);
        console.log('✅ Found user ID:', this.userId);
        
        // Fetch user data from API
        this.apiService.getUser(this.userId).subscribe({
          next: (response) => {
            console.log('✅ API Response received:', response);
            if (response && response.status === 'success' && response.data && response.data.length > 0) {
              const userData = response.data[0];
              console.log('✅ User data:', userData);
              this.userName = userData.full_name;
              this.userProfileImage = userData.profile_image;
              console.log('✅ Set userName:', this.userName);
              console.log('✅ Set userProfileImage:', this.userProfileImage);
            } else {
              console.warn('⚠️ No user data in response or invalid format:', response);
            }
            this.isLoadingProfile = false;
          },
          error: (error) => {
            console.error('❌ Failed to load user profile by ID:', error);
            console.error('❌ Error details:', error.message);
            // Try to get all users and find by email as fallback
            this.tryLoadByEmail();
          }
        });
      } else {
        console.warn('⚠️ No user ID found in localStorage');
        console.warn('⚠️ Available keys:', Object.keys(localStorage));
        // Try to get by email if ID is not available
        this.tryLoadByEmail();
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      this.isLoadingProfile = false;
    }
  }

  // Get profile image URL
  getProfileImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    
    console.log('🖼️ Building image URL for:', imagePath);
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      console.log('🖼️ Full URL detected:', imagePath);
      return imagePath;
    }
    
    // Serve profile images from images.cyclemart.shop (uploads root)
    const stripped = imagePath.replace(/^\/?uploads[\/]/, '');
    const fullUrl = `http://images.cyclemart.shop/${stripped}`;
    console.log('🖼️ Constructed URL (images subdomain):', fullUrl);
    return fullUrl;
  }

  // Try to load user profile by email as fallback
  tryLoadByEmail() {
    const email = localStorage.getItem('email');
    if (email) {
      console.log('🔄 Trying to load user by email:', email);
      this.apiService.getAllUsers().subscribe({
        next: (response) => {
          console.log('✅ All users response:', response);
          if (response && response.status === 'success' && response.data && Array.isArray(response.data)) {
            const user = response.data.find((u: any) => u.email === email);
            if (user) {
              console.log('✅ Found user by email:', user);
              this.userId = user.id;
              this.userName = user.full_name;
              this.userProfileImage = user.profile_image;
              // Save the user ID for future use
              localStorage.setItem('id', user.id.toString());
            } else {
              console.warn('⚠️ User not found with email:', email);
            }
          } else {
            console.warn('⚠️ Invalid getAllUsers response:', response);
          }
          this.isLoadingProfile = false;
        },
        error: (error) => {
          console.error('❌ Failed to load users by email:', error);
          this.isLoadingProfile = false;
        }
      });
    } else {
      console.warn('⚠️ No email found in localStorage either');
      this.isLoadingProfile = false;
    }
  }

  // Manual reload function for debugging
  reloadProfile() {
    console.log('🔄 Manual profile reload triggered');
    this.isLoadingProfile = true;
    this.loadUserProfile();
  }

  // Handle profile image error (fallback to default icon)
  onProfileImageError(event: any) {
    console.warn('⚠️ Profile image failed to load, falling back to default icon');
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
    
    console.log('📊 Loading unread counts for user:', userId);
    
    this.apiService.getUnreadCounts(parseInt(userId)).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          const prevMessages = this.unreadMessagesCount;
          const prevNotifications = this.unreadNotificationsCount;
          
          this.unreadMessagesCount = response.data.unread_messages || 0;
          this.unreadNotificationsCount = response.data.unread_notifications || 0;
          
          console.log('📊 Updated counts - Messages:', this.unreadMessagesCount, '(was:', prevMessages + '), Notifications:', this.unreadNotificationsCount, '(was:', prevNotifications + ')');
        }
      },
      error: (error) => {
        console.error('Error loading unread counts:', error);
      }
    });
  }
}
