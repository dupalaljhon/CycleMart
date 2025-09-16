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
import { AdminLoginComponent } from './admin/admin-login/admin-login.component';
import { AdminSidenavComponent } from './admin/admin-sidenav/admin-sidenav.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { UserListComponent } from './admin/user-list/user-list.component';
import { ListingMonitoringComponent } from './admin/listing-monitoring/listing-monitoring.component';

export const routes: Routes = [
    {path: '', component: LoginComponent},
    {path: 'dashboard', component: DashboardComponent},
    {path: 'sidenav', component: SidenavComponent},
    {path: 'admin-sidenav', component: AdminSidenavComponent},
    {path: 'admin-dashboard', component: AdminDashboardComponent},
    {path: 'listing-monitoring', component: ListingMonitoringComponent},
    {path: 'user-list', component: UserListComponent},
    {path: 'home', component: HomeComponent},
    {path: 'profile', component: ProfileComponent},
    {path: 'messages', component: MessagesComponent},
    {path: 'notification', component: NotificationComponent},
    {path: 'login', component: LoginComponent},
    {path: 'admin-login', component: AdminLoginComponent},
    {path: 'listing', component: ListingComponent},
    {path: 'verify-email', component: EmailVerificationComponent},
    {path: 'market-products', component: MarketProductsComponent},
    {path: 'sold-items', component: SoldItemsComponent},
    // { path: '', redirectTo: '/home', pathMatch: 'full' }

];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true}), FormsModule],
    exports: [RouterModule],
  })

export class AppRoutes{}