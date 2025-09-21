import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../api/api.service';

interface SoldProduct {
  product_id: number;
  product_name: string;
  product_images: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand_new' | 'second_hand';
  category: string;
  quantity: number;
  status: 'active' | 'archived';
  sale_status: 'sold';
  created_at: string;
  uploader_id: number;
}

@Component({
  selector: 'app-sold-items',
  imports: [CommonModule],
  templateUrl: './sold-items.component.html',
  styleUrl: './sold-items.component.css'
})
export class SoldItemsComponent implements OnInit, OnChanges {
  @Input() userId: number = 0;
  @Input() isVisible: boolean = false;

  soldItems: SoldProduct[] = [];
  isLoading = false;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    if (this.userId && this.isVisible) {
      this.loadSoldItems();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible'] && this.isVisible && this.userId) {
      this.loadSoldItems();
    }
  }

  loadSoldItems() {
    if (!this.userId) {
      console.error('No user ID provided');
      return;
    }

    this.isLoading = true;
    this.apiService.getProductsByUser(this.userId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.status === 'success') {
          // Filter only sold items
          this.soldItems = response.data
            .filter((product: any) => product.sale_status === 'sold')
            .map((product: any) => ({
              ...product,
              product_images: typeof product.product_images === 'string' 
                ? JSON.parse(product.product_images) 
                : product.product_images
            }));
        } else {
          console.error('Failed to load sold items:', response.message);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading sold items:', error);
      }
    });
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('data:')) {
      return imagePath; // Base64 image
    }
    return `${this.apiService.baseUrl}${imagePath}`;
  }

  getSaleTypeText(forType: string): string {
    switch (forType) {
      case 'sale':
        return 'Sold';
      case 'trade':
        return 'Traded';
      case 'both':
        return 'Sold/Traded';
      default:
        return 'Sold';
    }
  }

  markAsAvailable(product: SoldProduct) {
    if (confirm('Mark this item as available again?')) {
      const updateData = {
        product_id: product.product_id,
        sale_status: 'available',
        uploader_id: this.userId,
        for_type: product.for_type
      };

      this.apiService.updateSaleStatus(updateData).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            // Remove from sold items list
            this.soldItems = this.soldItems.filter(item => item.product_id !== product.product_id);
            alert('Item marked as available again!');
          } else {
            alert('Failed to update item status: ' + response.message);
          }
        },
        error: (error) => {
          console.error('Error updating item status:', error);
          alert('Failed to update item status. Please try again.');
        }
      });
    }
  }
}
