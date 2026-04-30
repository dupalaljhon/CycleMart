import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { LandingPageComponent } from './landing-page/landing-page.component';
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
import { ListingMonitoringComponent as AdminListingMonitoringComponent } from './admin/listing-monitoring/listing-monitoring.component';
import { AdminMonitoringComponent } from './admin/admin-monitoring/admin-monitoring.component';
import { SocketDemoComponent } from './socket-demo/socket-demo.component';
import { EmailVerificationComponent } from './email-verification/email-verification.component';
import { ResendVerificationComponent } from './resend-verification/resend-verification.component';
import { ReportsComponent } from './reports/reports.component';
import { ReportMonitoringComponent as AdminReportMonitoringComponent } from './admin/report-monitoring/report-monitoring.component';
import { RatingModalComponent } from './messages/rating-modal/rating-modal.component';
import { AuthGuard } from './api/auth.guard';
import { accountStatusGuard } from './api/account-status.guard';
import { adminAuthGuard } from './api/admin-auth.guard';
import { staffGuard } from './api/staff.guard';
import { UserReportsComponent } from './user-reports/user-reports.component';
import { UserReportMonitoringComponent } from './admin/user-report-monitoring/user-report-monitoring.component';
import { SuspendedComponent } from './suspended/suspended.component';
import { BannedComponent } from './banned/banned.component';
import { ListingApprovalComponent as AdminListingApprovalComponent } from './admin/listing-approval/listing-approval.component';
import { ListingApprovalComponent as ModeratorListingApprovalComponent } from './listing-approval/listing-approval.component';
import { ListingMonitoringComponent as ModeratorListingMonitoringComponent } from './listing-monitoring/listing-monitoring.component';
import { ReportMonitoringComponent as ModeratorReportMonitoringComponent } from './report-monitoring/report-monitoring.component';
import { ListingGuidelinesComponent } from './listing-guidelines/listing-guidelines.component';
import { ListingGuidelinesPageComponent } from './listing-guidelines/listing-guidelines-page.component';
import { BuyingGuidelinesPageComponent } from './buying-guidelines/buying-guidelines-page.component';
import { ApplyModeratorComponent } from './user-dashboard/apply-moderator/apply-moderator.component';
import { ModeratorApplicationsComponent } from './admin-dashboard/moderator-applications/moderator-applications.component';

export const routes: Routes = [
  {path: '', component: LandingPageComponent},
    {path: 'suspended', component: SuspendedComponent},
    {path: 'banned', component: BannedComponent},
    {path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'sidenav', component: SidenavComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'admin-sidenav', component: AdminSidenavComponent, canActivate: [adminAuthGuard]},
    {path: 'admin-dashboard', component: AdminDashboardComponent, canActivate: [adminAuthGuard]},
    {path: 'listing-approval', component: ModeratorListingApprovalComponent, canActivate: [staffGuard]},
    {path: 'listing-monitoring', component: ModeratorListingMonitoringComponent, canActivate: [staffGuard]},
    {path: 'admin-listing-approval', component: AdminListingApprovalComponent, canActivate: [adminAuthGuard]},
    {path: 'admin-listing-monitoring', component: AdminListingMonitoringComponent, canActivate: [adminAuthGuard]},
    {path: 'user-list', component: UserListComponent, canActivate: [adminAuthGuard]},
    {path: 'home', component: HomeComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'profile', component: ProfileComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'messages', component: MessagesComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'notification', component: NotificationComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'apply-moderator', component: ApplyModeratorComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'login', component: LoginComponent},
    {path: 'landing', component: LandingPageComponent},
    {path: 'admin-login', component: AdminLoginComponent},
    {path: 'listing', component: ListingComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'sold-items', component: SoldItemsComponent},
    {path: 'admin-monitoring', component: AdminMonitoringComponent, canActivate: [adminAuthGuard]},
    {path: 'moderator-applications', component: ModeratorApplicationsComponent, canActivate: [adminAuthGuard]},
    {path: 'socket-demo', component: SocketDemoComponent},
    {path: 'email-verification', component: EmailVerificationComponent},
    {path: 'resend-verification', component: ResendVerificationComponent},
    {path: 'reports', component: ReportsComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'report-monitoring', component: ModeratorReportMonitoringComponent, canActivate: [staffGuard]},
    {path: 'admin-report-monitoring', component: AdminReportMonitoringComponent, canActivate: [adminAuthGuard]},
    {path: 'rating-modal', component: RatingModalComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'user-reports', component: UserReportsComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'user-report-monitoring', component: UserReportMonitoringComponent, canActivate: [adminAuthGuard]},
    {path: 'listing-guidelines', component: ListingGuidelinesPageComponent, canActivate: [AuthGuard, accountStatusGuard]},
    {path: 'buying-guidelines', component: BuyingGuidelinesPageComponent, canActivate: [AuthGuard, accountStatusGuard]},
   
    // { path: '', redirectTo: '/home', pathMatch: 'full' }

];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true}), FormsModule],
    exports: [RouterModule],
  })

export class AppRoutes{}