import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, AdminSidenavComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent {

}
