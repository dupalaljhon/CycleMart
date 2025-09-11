import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileComponent } from './profile/profile.component';
import { NotificationComponent } from './notification/notification.component';
import { MessagesComponent } from './messages/messages.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { HomeComponent } from './home/home.component';
import { ListingComponent } from './listing/listing.component';
import { EmailVerificationComponent } from './email-verification/email-verification.component';
import { MarketProductsComponent } from './listing/market-products/market-products.component';
import { SoldItemsComponent } from './listing/sold-items/sold-items.component';

// Admin components
import { LoginComponent as AdminLoginComponent } from './admin/login/login.component';
import { DashboardComponent as AdminDashboardComponent } from './admin/dashboard/dashboard.component';
import { PostApprovalComponent } from './admin/post-approval/post-approval.component';

export const routes: Routes = [
    {path: '', component: LoginComponent},
    {path: 'dashboard', component: DashboardComponent},
    {path: 'sidenav', component: SidenavComponent},
    {path: 'home', component: HomeComponent},
    {path: 'profile', component: ProfileComponent},
    {path: 'messages', component: MessagesComponent},
    {path: 'notification', component: NotificationComponent},
    {path: 'login', component: LoginComponent},
    {path: 'listing', component: ListingComponent},
    {path: 'verify-email', component: EmailVerificationComponent},
    {path: 'market-products', component: MarketProductsComponent},
    {path: 'sold-items', component: SoldItemsComponent},
    
    // Admin routes
    {path: 'admin/login', component: AdminLoginComponent},
    {path: 'admin/dashboard', component: AdminDashboardComponent},
    {path: 'admin/post-approval', component: PostApprovalComponent},
    
    // { path: '', redirectTo: '/home', pathMatch: 'full' }

];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true}), FormsModule],
    exports: [RouterModule],
  })

export class AppRoutes{}