import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // 🔹 made public so it can be used in components (for image paths)
  public baseUrl = 'http://localhost/CycleMart/CycleMart/CycleMart-api/api/';
  
  constructor(private http: HttpClient) {}

  // 🔹 Login request
  login(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}login`, data);
  }

  // 🔹 Registration request
  register(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}register`, data);
  }

  // 🔹 Email verification methods
  verifyEmail(token: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}verify-email`, { token });
  }

  // 🔹 Resend verification email
  resendVerificationEmail(email: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}resend-verification`, { email });
  }

  // 🔹 Upload or update profile
  updateProfile(data: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(`${this.baseUrl}upload`, data, { headers });
  }

  // 🔹 Fetch user + profile info
getUser(id: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}user?id=${id}`);
}

// 🔹 Fetch all users for admin
getAllUsers(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}all-users`);
}


// 🔹 Edit profile
editProfile(data: any): Observable<any> {
  const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  return this.http.post<any>(`${this.baseUrl}editprofile`, data, { headers });
}

//fetch all products
getProductsByUser(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}products?uploader_id=${userId}`);
}

// Get single product by ID
getProductById(productId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}products?product_id=${productId}`);
}

// Get all active products for home page
getAllActiveProducts(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}all-products`);
}

// Get all products for admin monitoring
getAllProductsForAdmin(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}admin-products`);
}

// Add product
addProduct(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}addProduct`, data);
}

// Update product
updateProduct(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}updateProduct`, data);
}

// Submit product for approval
submitForApproval(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}submitForApproval`, data);
}

// Delete product
deleteProduct(product_id: number, uploader_id: number): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}deleteProduct`, { product_id, uploader_id });
}

// Update sale status (sold/traded/available)
updateSaleStatus(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}updateSaleStatus`, data);
}

// Archive/Restore product (admin only)
archiveProduct(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}archiveProduct`, data);
}

// 🔹 Notification methods
getAdminNotifications(adminId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}admin-notifications?admin_id=${adminId}`);
}

markNotificationAsRead(notificationId: number, adminId: number): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}markNotificationAsRead`, {
    notification_id: notificationId,
    admin_id: adminId
  });
}

getNotificationCounts(adminId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}notification-counts?admin_id=${adminId}`);
}

getDashboardStats(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}dashboard-stats`);
}

getChartData(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}chart-data`);
}

// 🔹 Admin Management Methods
getAllAdmins(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}all-admins`);
}

getAdminById(adminId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}admin?id=${adminId}`);
}

createAdmin(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}admin/create`, data);
}

updateAdmin(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}admin/update`, data);
}

deleteAdmin(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}admin/delete`, data);
}

// 🔹 Messaging Methods
getUserConversations(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}conversations?user_id=${userId}`);
}

getUserArchivedConversations(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}archived-conversations?user_id=${userId}`);
}

getConversationMessages(conversationId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}messages?conversation_id=${conversationId}`);
}

createConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}create-conversation`, data);
}

sendMessage(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}send-message`, data);
}

markMessagesAsRead(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}mark-messages-read`, data);
}

// 🔹 Conversation Management Methods
archiveConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}archive-conversation`, data);
}

restoreConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}restore-conversation`, data);
}

deleteConversation(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}delete-conversation`, data);
}

// 🔹 Report Methods
submitReport(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}submit-report`, data);
}

getUserReports(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}user-reports?user_id=${userId}`);
}

getAllReports(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}all-reports`);
}

updateReportStatus(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}update-report-status`, data);
}

// 🔹 User Management Methods
deleteUser(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}delete-user`, data);
}

// 🔹 Rating Methods
submitRating(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}submit-rating`, data);
}

getUserRatings(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}user-ratings?user_id=${userId}`);
}

getConversationRating(conversationId: number, ratedBy: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}conversation-rating?conversation_id=${conversationId}&rated_by=${ratedBy}`);
}

getUserAverageRatings(userId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}user-average-ratings?user_id=${userId}`);
}

getAllSellersWithRatings(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}sellers-with-ratings`);
}

// 🔹 Product Specifications Methods
// Note: Individual specification management methods removed
// Specifications are now managed as JSON through addProduct and updateProduct methods
getProductSpecifications(productId: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}product-specifications?product_id=${productId}`);
}

}
