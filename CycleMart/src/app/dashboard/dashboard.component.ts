import { Component } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  openMenu: string | null = null;

  toggleMenu(menu: string) {
    this.openMenu = this.openMenu === menu ? null : menu;
  }
}
