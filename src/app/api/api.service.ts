import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // 🔹 made public so it can be used in components (for image paths)
  public baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // 🔹 Login request
  login(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/login`, data);
  }

  // 🔹 Registration request
  register(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/register`, data);
  }

  // 🔹 Email verification methods
  verifyEmail(token: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/verify-email`, { token });
  }

  // 🔹 Resend verification email
  resendVerificationEmail(email: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/resend-verification`, { email });
  }

  // 🔹 Upload or update profile
  updateProfile(data: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(`${this.baseUrl}/upload`, data, { headers });
  }

  // 🔹 Fetch user + profile info
getUser(id: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/user?id=${id}`);
}

// 🔹 Fetch all users for admin
getAllUsers(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/all-users`);
}

// 🔹 Fetch user violation/report details for admin modal
getUserViolationDetails(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/user-violation-details?user_id=${userId}`);
}


// 🔹 Edit profile
editProfile(data: any): Observable<any> {
  const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  return this.http.post<any>(`${this.baseUrl}/editprofile`, data, { headers });
}

//fetch all products
getProductsByUser(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/products?uploader_id=${userId}`);
}

// Get all sold/traded products purchased by user
getProductsBoughtByUser(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/purchased-products?buyer_id=${userId}`);
}

// Get single product by ID
getProductById(productId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/products?product_id=${productId}`);
}

// Get all active products for home page
getAllActiveProducts(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/all-products`);
}

// Get all products for admin monitoring
getAllProductsForAdmin(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/admin-products`);
}

// Get pending products for approval
getPendingProducts(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/pending-products`);
}

// Get listing auto-approval configuration
getListingAutoApprovalConfig(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/listing-auto-approval-config`);
}

// Update listing auto-approval configuration
updateListingAutoApprovalConfig(isEnabled: boolean): Observable<any> {
  const adminData = this.getAdminData();
  return this.http.post<any>(`${this.baseUrl}/listing-auto-approval-config`, {
    enabled: isEnabled,
    admin_id: adminData.admin_id,
    admin_role: adminData.role
  });
}

// Approve product
approveProduct(productId: number): Observable<any> {
  const adminData = this.getAdminData();
  return this.http.post<any>(`${this.baseUrl}/approve-product`, {
    product_id: productId,
    admin_id: adminData.admin_id,
    admin_role: adminData.role
  });
}

// Reject product
rejectProduct(productId: number, reason: string, violationCode: string = 'other'): Observable<any> {
  const adminData = this.getAdminData();
  return this.http.post<any>(`${this.baseUrl}/reject-product`, {
    product_id: productId,
    admin_id: adminData.admin_id,
    admin_role: adminData.role,
    rejection_reason: reason,
    violation_code: violationCode
  });
}

private getAdminData() {
  const token = localStorage.getItem('admin_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        admin_id: payload.admin_id,
        role: payload.role
      };
    } catch (e) {
      return { admin_id: null, role: null };
    }
  }

  // Fallback for moderators using normal user login (no admin JWT)
  const adminId = localStorage.getItem('admin_id');
  const role = localStorage.getItem('role');
  if (adminId) {
    const parsedId = parseInt(adminId, 10);
    return {
      admin_id: isNaN(parsedId) ? null : parsedId,
      role: role || 'moderator'
    };
  }

  return { admin_id: null, role: null };
}

// Add product
addProduct(data: any): Observable<any> {
  const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');
  const headers = token
    ? new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      })
    : new HttpHeaders({ 'Content-Type': 'application/json' });

  return this.http.post<any>(`${this.baseUrl}/addProduct`, data, { headers });
}

// Update product
updateProduct(data: any): Observable<any> {
  const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');
  const headers = token
    ? new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      })
    : new HttpHeaders({ 'Content-Type': 'application/json' });

  return this.http.post<any>(`${this.baseUrl}/updateProduct`, data, { headers });
}

// Submit product for approval
submitForApproval(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/submitForApproval`, data);
}

// Delete product
deleteProduct(product_id: number, uploader_id: number): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/deleteProduct`, { product_id, uploader_id });
}

// Update sale status (sold/traded/available)
updateSaleStatus(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/updateSaleStatus`, data);
}

// Archive/Restore product (admin only)
archiveProduct(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/archiveProduct`, data);
}

// 🔹 Notification methods
getAdminNotifications(adminId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/admin-notifications?admin_id=${adminId}`);
}

markNotificationAsRead(notificationId: number, adminId: number): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/markNotificationAsRead`, {
    notification_id: notificationId,
    admin_id: adminId
  });
}

getNotificationCounts(adminId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/notification-counts?admin_id=${adminId}`);
}

getDashboardStats(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/dashboard-stats`);
}

getChartData(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/chart-data`);
}

getRecentActivities(
  limit: number = 50,
  filters?: { startDate?: string; endDate?: string }
): Observable<any> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));

  if (filters?.startDate) {
    params.set('start_date', filters.startDate);
  }

  if (filters?.endDate) {
    params.set('end_date', filters.endDate);
  }

  return this.http.get<any>(`${this.baseUrl}/recent-activities?${params.toString()}`);
}

// 🔹 Admin Management Methods
getAllAdmins(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/all-admins`);
}

getAdminById(adminId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/admin?id=${adminId}`);
}

createAdmin(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/admin/create`, data);
}

updateAdmin(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/admin/update`, data);
}

deleteAdmin(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/admin/delete`, data);
}

// 🔹 Messaging Methods
getUserConversations(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/conversations?user_id=${userId}`);
}

getUserArchivedConversations(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/archived-conversations?user_id=${userId}`);
}

getConversationMessages(conversationId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/messages?conversation_id=${conversationId}`);
}

createConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/create-conversation`, data);
}

sendMessage(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/send-message`, data);
}

markMessagesAsRead(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/mark-messages-read`, data);
}

// 🔹 Conversation Management Methods
archiveConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/archive-conversation`, data);
}

restoreConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/restore-conversation`, data);
}

deleteConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/delete-conversation`, data);
}

// 🔹 Report Methods
submitReport(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/submit-report`, data);
}

submitUserReport(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/submit-user-report`, data);
}

getUserReports(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/user-reports?user_id=${userId}`);
}

getAllReports(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/all-reports`);
}

getAllUserReports(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/all-user-reports`);
}

updateReportStatus(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/update-report-status`, data);
}

updateUserReportStatus(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/update-user-report-status`, data);
}

// 🔹 User Management Methods
deleteUser(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/delete-user`, data);
}

// 🔹 Rating Methods
submitRating(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/submit-rating`, data);
}

getUserRatings(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/user-ratings?user_id=${userId}`);
}

getConversationRating(conversationId: number, ratedBy: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/conversation-rating?conversation_id=${conversationId}&rated_by=${ratedBy}`);
}

getUserAverageRatings(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/user-average-ratings?user_id=${userId}`);
}

getAllSellersWithRatings(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/sellers-with-ratings`);
}

// 🔹 Product Specifications Methods
// Note: Individual specification management methods removed
// Specifications are now managed as JSON through addProduct and updateProduct methods
getProductSpecifications(productId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/product-specifications?product_id=${productId}`);
}

// 🔹 User Notification Methods
getUserNotifications(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/user-notifications?user_id=${userId}`);
}

markUserNotificationAsRead(notificationId: number): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/markUserNotificationAsRead`, { notification_id: notificationId });
}

markAllUserNotificationsAsRead(userId: number): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/markAllUserNotificationsAsRead`, { user_id: userId });
}

deleteUserNotification(notificationId: number): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/deleteUserNotification`, { notification_id: notificationId });
}

  // 🔹 Get unread counts for messages and notifications
  getUnreadCounts(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/unread-counts?user_id=${userId}`);
  }

  // 🔹 Admin User Violation Methods
  markUserViolation(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/mark-user-violation`, data);
  }

  // 🔹 Check User Restriction
  checkUserRestriction(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/user-restriction?user_id=${userId}`);
  }

  // 🔹 Dynamic Dropdown: Get all active bicycle brands
  getBicycleBrands(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/bicycle-brands`);
  }

  // 🔹 Dynamic Dropdown: Get bicycle parts filtered by brand
  getBicyclePartsByBrand(brandId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/bicycle-parts?brand_id=${brandId}`);
  }

  // 🔹 Dynamic Dropdown: Get part specifications (max 5 shown)
  getPartSpecifications(partId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/part-specifications?part_id=${partId}`);
  }

  /**
   * ================================================================================================
   * RESERVATION SYSTEM API METHODS
   * ================================================================================================
   */

  // 🔹 Check for expired reservations (called on listing page load)
  checkExpiredReservations(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/check-expired-reservations`);
  }

  // 🔹 Reserve a product
  reserveProduct(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/reserve-product`, data);
  }

  // 🔹 Cancel a reservation
  cancelReservation(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/cancel-reservation`, data);
  }

  // 🔹 Get reservation details for a product
  getReservationDetails(productId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/reservation-details`, { product_id: productId });
  }

  // 🔹 Get reservation history (for a product or user)
  getReservationHistory(productId?: number, userId?: number): Observable<any> {
    const data: any = {};
    if (productId) data.product_id = productId;
    if (userId) data.user_id = userId;
    return this.http.post<any>(`${this.baseUrl}/reservation-history`, data);
  }

  /**
   * ================================================================================================
   * TRANSACTION/BUYER INFORMATION API METHODS
   * ================================================================================================
   */

  // 🔹 Get buyer information for a sold/traded product
  getProductBuyer(productId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}product-buyer?product_id=${productId}`);
  }

  /**
   * ================================================================================================
   * MODERATOR APPLICATION API METHODS
   * ================================================================================================
   */

  // 🔹 Submit moderator application
  submitModeratorApplication(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/moderator-application/submit`, data);
  }

  // 🔹 Get user's moderator application
  getUserModeratorApplication(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/moderator-application?user_id=${userId}`);
  }

  // 🔹 Get all moderator applications (admin)
  getAllModeratorApplications(status?: string): Observable<any> {
    const url = status 
      ? `${this.baseUrl}/moderator-applications?status=${status}`
      : `${this.baseUrl}/moderator-applications`;
    return this.http.get<any>(url);
  }

  // 🔹 Get moderator application by ID
  getModeratorApplicationById(applicationId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/moderator-application?id=${applicationId}`);
  }

  // 🔹 Review moderator application (approve/reject)
  reviewModeratorApplication(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/moderator-application/review`, data);
  }

  // 🔹 Get pending moderator applications count
  getPendingModeratorApplicationsCount(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/pending-moderator-applications-count`);
  }

  // 🔹 Landing page visit counter
  incrementLandingPageVisit(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/landing-visit-counter?action=increment`);
  }

}
