import { Component } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  openMenu: string | null = null;

  // Optional user and profile image state to satisfy template/build
  user?: { profile_image?: string | null };
  profileImageUrl: string | null = null;

  constructor() {
    // If a user object is later injected, this block can be removed
    // Keep defensive init to avoid build-time property errors when templates evolve
    if (this.user?.profile_image) {
      this.profileImageUrl = this.getProfileImageUrl(this.user.profile_image);
    }
  }

  toggleMenu(menu: string) {
    this.openMenu = this.openMenu === menu ? null : menu;
  }

  getProfileImageUrl(imagePath: string | null): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const stripped = imagePath.replace(/^\/?uploads[\\/]/, '');
    return `${environment.apiUploadsBaseUrl}${stripped}`;
  }
}
