import { Component } from '@angular/core';
import { ListingComponent } from '../listing.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sold-items',
  imports: [ListingComponent, CommonModule],
  templateUrl: './sold-items.component.html',
  styleUrl: './sold-items.component.css'
})
export class SoldItemsComponent {

}
