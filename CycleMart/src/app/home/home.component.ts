import { Component } from '@angular/core';
import { SidenavComponent } from "../sidenav/sidenav.component";
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, SidenavComponent], // ✅ Only standalone pieces
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

 items = [
    {
      image: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
      price: 99999,
      saleType: 'For sale or trade',
      category: 'Bike parts',
      seller: 'John Doe',
      location: 'Olongapo City',
      rating: 4.8,
    },
    {
      image: 'https://img.icons8.com/?size=100&id=15128&format=png&color=000000',
      price: 99999,
      saleType: 'For trade',
      category: 'Bike parts',
      seller: 'John Doe',
      location: 'Olongapo City',
      rating: 4.8,
    },
    // ➕ add more items here
  ];
}
