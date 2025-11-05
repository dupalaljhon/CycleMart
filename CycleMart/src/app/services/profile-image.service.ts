import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileImageService {
  private imageCache = new Map<string, string>();

  constructor(private apiService: ApiService) {}

  /**
   * Get user profile image URL with caching
   * @param profileImage - The profile image path from database
   * @param placeholder - Custom placeholder text (default: 'U')
   * @returns Full URL to the profile image or placeholder
   */
  getUserProfileImageUrl(profileImage: string | null | undefined, placeholder: string = 'U'): string {
    if (!profileImage) {
      return `https://via.placeholder.com/40x40/6366f1/white?text=${placeholder}`;
    }

    // Check cache first
    if (this.imageCache.has(profileImage)) {
      return this.imageCache.get(profileImage)!;
    }

    let imageUrl: string;

    // If it's already a full URL, return as is
    if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
      imageUrl = profileImage;
    } else {
      // Use the same method as the original user-list component
      // The apiService.baseUrl includes '/api/' but uploads is at parent level
      const baseWithoutApi = this.apiService.baseUrl.replace('/api/', '/');
      imageUrl = `${baseWithoutApi}${profileImage}`;
    }

    // Cache the result
    this.imageCache.set(profileImage, imageUrl);
    return imageUrl;
  }

  /**
   * Get a placeholder image URL for specific contexts
   * @param type - Type of placeholder (user, seller, reporter, etc.)
   * @param color - Background color (default: 6366f1)
   * @returns Placeholder image URL
   */
  getPlaceholderImageUrl(type: 'user' | 'seller' | 'reporter' | 'admin' = 'user', color: string = '6366f1'): string {
    const placeholderMap = {
      user: 'U',
      seller: 'S', 
      reporter: 'R',
      admin: 'A'
    };

    return `https://via.placeholder.com/40x40/${color}/white?text=${placeholderMap[type]}`;
  }

  /**
   * Handle image load errors with appropriate fallbacks
   * @param event - Image error event
   * @param type - Type of image for appropriate fallback
   */
  onImageError(event: Event, type: 'user' | 'seller' | 'reporter' | 'admin' = 'user'): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.getPlaceholderImageUrl(type);
    }
  }

  /**
   * Clear the image cache (useful for logout or memory management)
   */
  clearCache(): void {
    this.imageCache.clear();
  }

  /**
   * Preload an image to improve performance
   * @param imageUrl - URL of the image to preload
   */
  preloadImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = imageUrl;
    });
  }
}