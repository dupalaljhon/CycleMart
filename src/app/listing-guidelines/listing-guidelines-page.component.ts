import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { ListingGuidelinesComponent } from './listing-guidelines.component';

@Component({
  selector: 'app-listing-guidelines-page',
  standalone: true,
  imports: [CommonModule, SidenavComponent, ListingGuidelinesComponent],
  template: `
    <div class="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <app-sidenav></app-sidenav>
      
      <div class="flex-1 overflow-y-auto">
        <app-listing-guidelines></app-listing-guidelines>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }
  `]
})
export class ListingGuidelinesPageComponent {}
