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
import { SoldItemsComponent } from './listing/sold-items/sold-items.component';
import { AdminLoginComponent } from './admin/admin-login/admin-login.component';
import { AdminSidenavComponent } from './admin/admin-sidenav/admin-sidenav.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { UserListComponent } from './admin/user-list/user-list.component';
import { ListingMonitoringComponent } from './admin/listing-monitoring/listing-monitoring.component';
import { AdminMonitoringComponent } from './admin/admin-monitoring/admin-monitoring.component';
import { SocketDemoComponent } from './socket-demo/socket-demo.component';
import { EmailVerificationComponent } from './email-verification/email-verification.component';
import { ResendVerificationComponent } from './resend-verification/resend-verification.component';
import { ReportsComponent } from './reports/reports.component';
import { ReportMonitoringComponent } from './admin/report-monitoring/report-monitoring.component';
import { RatingModalComponent } from './messages/rating-modal/rating-modal.component';

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
    {path: 'sold-items', component: SoldItemsComponent},
    {path: 'admin-monitoring', component: AdminMonitoringComponent},
    {path: 'socket-demo', component: SocketDemoComponent},
    {path: 'email-verification', component: EmailVerificationComponent},
    {path: 'resend-verification', component: ResendVerificationComponent},
    {path: 'reports', component: ReportsComponent},
    {path: 'report-monitoring', component: ReportMonitoringComponent},
    {path: 'rating-modal', component: RatingModalComponent}

    // { path: '', redirectTo: '/home', pathMatch: 'full' }

];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true}), FormsModule],
    exports: [RouterModule],
  })

export class AppRoutes{}