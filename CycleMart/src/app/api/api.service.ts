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

  // 🔹 Upload or update profile
  updateProfile(data: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(`${this.baseUrl}upload`, data, { headers });
  }

  // 🔹 Fetch user + profile info
getUser(id: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}user&id=${id}`);
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

// 🔹 Email verification
verifyEmail(token: string): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}verify-email`, { token });
}

// 🔹 Resend verification email
resendVerificationEmail(email: string): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}resend-verification`, { email });
}

// 🔹 Generate new verification token
generateVerificationToken(email: string): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}generate-verification`, { email });
}



}
