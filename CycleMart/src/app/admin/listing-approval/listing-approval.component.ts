import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';
import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';
import { environment } from '../../../environments/environment';

interface PendingListing {
  product_id: number;
  product_name: string;
  brand_name: string;
  custom_brand?: string;
  price: number;
  description: string;
  location: string;
  product_images: any;
  product_videos: any;
  seller_name: string;
  seller_email: string;
  seller_profile_image?: string;
  created_at: string;
  specifications: any[];
  for_type: string;
  category: string;
  condition: string;
  quantity: number;
  // Bicycle Taxonomy Fields from JOINs
  bicycle_brand_id: number | null;
  bicycle_brand_name: string | null;
  bicycle_brand_description: string | null;
  bicycle_part_id: number | null;
  bicycle_part_name: string | null;
  bicycle_part_category: string | null;
  bicycle_part_description: string | null;
  auto_review_failures?: string[];
  auto_review_summary?: string;
}

@Component({
  selector: 'app-listing-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidenavComponent],
  templateUrl: './listing-approval.component.html',
  styleUrl: './listing-approval.component.css'
})
export class ListingApprovalComponent implements OnInit, OnDestroy {
  pendingListings: PendingListing[] = [];
  selectedListing: PendingListing | null = null;
  rejectionReason: string = '';
  violationCode: string = 'other';
  isLoading = false;
  showRejectModal = false;
  showApproveModal = false;
  currentImageIndex = 0;
  
  // Success modal properties
  showSuccessModal = false;
  successMessage = '';
  successType: 'approved' | 'rejected' = 'approved';
  private autoCloseTimer: any;
  isAutoApprovalEnabled = false;
  isUpdatingAutoApproval = false;

  // Violation codes for dropdown
  violationCodes = [
    { value: 'not_bike_related', label: 'Not Bicycle Related', description: 'Item is not related to bicycles or cycling' },
    { value: 'prohibited_item', label: 'Prohibited Item', description: 'Selling prohibited or illegal items' },
    { value: 'spam', label: 'Spam/Duplicate', description: 'Spam or duplicate listings' },
    { value: 'fraud', label: 'Fraudulent Content', description: 'Suspected fraud or scam' },
    { value: 'inappropriate_content', label: 'Inappropriate Content', description: 'Offensive or inappropriate content' },
    { value: 'misleading_info', label: 'Misleading Information', description: 'False or misleading product information' },
    { value: 'price_manipulation', label: 'Price Manipulation', description: 'Unrealistic or manipulated pricing' },
    { value: 'other', label: 'Other Violation', description: 'Other policy violations' }
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadAutoApprovalConfig();
    this.loadPendingListings();
  }

  loadAutoApprovalConfig() {
    this.apiService.getListingAutoApprovalConfig().subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.isAutoApprovalEnabled = !!response.data.enabled;
        }
      },
      error: (error) => {
      }
    });
  }

  toggleAutoApproval() {
    if (this.isUpdatingAutoApproval) return;

    const nextValue = !this.isAutoApprovalEnabled;
    this.isUpdatingAutoApproval = true;

    this.apiService.updateListingAutoApprovalConfig(nextValue).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.isAutoApprovalEnabled = nextValue;
          this.showSuccess(
            nextValue
              ? 'Auto-approve listing is now ON. Matching listings will be auto-approved and regex violations auto-rejected.'
              : 'Auto-approve listing is now OFF. New listings will go to manual review.',
            'approved'
          );
        } else {
          this.showSuccess('Failed to update auto-approval setting.', 'rejected');
        }
        this.isUpdatingAutoApproval = false;
      },
      error: (error) => {
        this.showSuccess('Failed to update auto-approval setting.', 'rejected');
        this.isUpdatingAutoApproval = false;
      }
    });
  }

  // Format brand name for display (handle Others and No Brand with custom names)
  getBrandDisplay(listing: PendingListing): string {
    // Prioritize bicycle_brand_name from taxonomy
    if (listing.bicycle_brand_name) {
      return listing.bicycle_brand_name;
    }
    
    // Fall back to legacy brand_name
    const brandLower = listing.brand_name?.toLowerCase();
    
    if (brandLower === 'others' || brandLower === 'no brand') {
      if (listing.custom_brand && listing.custom_brand.trim()) {
        return `${this.capitalizeWords(listing.brand_name)} (${listing.custom_brand})`;
      }
      return this.capitalizeWords(listing.brand_name);
    }
    
    return this.capitalizeWords(listing.brand_name);
  }

  // Get bicycle part name display
  getPartDisplay(listing: PendingListing): string | null {
    return listing.bicycle_part_name || null;
  }

  // Get part category display
  getPartCategoryDisplay(listing: PendingListing): string | null {
    return listing.bicycle_part_category || null;
  }

  // Capitalize words helper
  capitalizeWords(str: string): string {
    if (!str) return '';
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  // Format specification names: replace underscores with spaces and capitalize
  formatSpecName(specName: string): string {
    if (!specName) return '';
    return specName
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Format condition for display
  getConditionDisplay(condition: string): string {
    if (condition === 'brand new') return 'Brand New';
    if (condition === 'second hand') return 'Second Hand';
    return this.capitalizeWords(condition);
  }

  // Format category for display
  getCategoryDisplay(category: string): string {
    if (!category) return 'Others';
    return this.capitalizeWords(category.replace(/_/g, ' '));
  }

  // Format for_type for display
  getForTypeDisplay(forType: string): string {
    if (forType === 'sale') return 'For Sale';
    if (forType === 'trade') return 'For Trade';
    if (forType === 'both') return 'Sale/Trade';
    return this.capitalizeWords(forType);
  }

  loadPendingListings() {
    this.isLoading = true;
    this.apiService.getPendingProducts().subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.pendingListings = response.data.map((listing: any) => {
            const parsedVideos = this.parseVideos(listing.product_videos);
            const parsedImages = this.parseImages(listing.product_images);
            const parsedSpecifications = this.parseSpecifications(listing.specifications);

            const enrichedListing: PendingListing = {
              ...listing,
              product_images: parsedImages,
              product_videos: parsedVideos,
              specifications: parsedSpecifications
            };

            const autoReviewFailures = this.getPendingReviewReasons(enrichedListing);
            
            return {
              ...enrichedListing,
              auto_review_failures: autoReviewFailures,
              auto_review_summary: autoReviewFailures.length
                ? autoReviewFailures[0]
                : 'No criteria failure detected (pending may be from earlier rules).'
            };
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  parseImages(images: string): string[] {
    try {
      return JSON.parse(images || '[]');
    } catch {
      return [];
    }
  }

  parseVideos(videos: string): string[] {
    try {
      // If videos is null or undefined, return empty array
      if (!videos) {
        return [];
      }
      
      // If videos is a string, try to parse it
      if (typeof videos === 'string') {
        // Check if it's an empty string
        if (videos.trim() === '') {
          return [];
        }
        
        // Try to parse JSON
        const parsed = JSON.parse(videos);
        return Array.isArray(parsed) ? parsed : [];
      }
      
      // If it's already an array, return it
      if (Array.isArray(videos)) {
        return videos;
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  parseSpecifications(specs: any): any[] {
    try {
      if (!specs) return [];
      if (typeof specs === 'string') {
        return JSON.parse(specs);
      }
      return Array.isArray(specs) ? specs : [];
    } catch {
      return [];
    }
  }

  private getPendingReviewReasons(listing: PendingListing): string[] {
    const failures: string[] = [];

    const name = (listing.product_name || '').trim();
    const description = (listing.description || '').trim();
    const location = (listing.location || '').trim();
    const combinedText = (name + ' ' + description).toLowerCase();
    const images = Array.isArray(listing.product_images) ? listing.product_images : [];
    const specs = Array.isArray(listing.specifications) ? listing.specifications : [];

    const descriptionWordCount = (description.match(/[a-z0-9]+/gi) || []).length;
    const bikeKeywordRegex = /\b(?:bike|bicycle|frame|frameset|wheel|wheelset|groupset|drivetrain|fork|shock|brake|cassette|chain|derailleur|shifter|road|roadbike|mtb|gravel|dropbar|handlebar|stem|saddle|seatpost|tires?|trek|giant|specialized|shimano|sram|campagnolo)\b/i;
    const technicalDetailRegex = /\b(?:\d{2,4}\s?(?:mm|cm|inch|in)|\d{1,2}\s?speed|\d{1,2}x\d{1,2}|xx1|x01|deore|slx|xt|xtr|tiagra|105|ultegra|dura-ace|nx|gx|axs)\b/i;

    const autoRejectPatterns: Array<{ regex: RegExp; reason: string }> = [
      { regex: /\b(?:fake|counterfeit|replica|class a|clone)\b/i, reason: 'Auto-reject regex: counterfeit or replica terms detected' },
      { regex: /\b(?:stolen|smuggled|illegal|prohibited|drugs?|weapon|gun)\b/i, reason: 'Auto-reject regex: illegal or prohibited terms detected' },
      { regex: /(?:https?:\/\/|www\.|t\.me\/|telegram|whatsapp|viber|@gmail\.com|@yahoo\.com|09\d{9})/i, reason: 'Auto-reject regex: off-platform contact details detected' },
      { regex: /\b(?:nude|porn|sex|adult)\b/i, reason: 'Auto-reject regex: inappropriate terms detected' }
    ];

    for (const pattern of autoRejectPatterns) {
      if (pattern.regex.test(combinedText)) {
        failures.push(pattern.reason);
      }
    }

    if (name === '' || name.length < 4) failures.push('Product name is too short');
    if (name.length > 120) failures.push('Product name exceeds 120 characters');
    if (!/[a-z]/i.test(name)) failures.push('Product name must contain readable letters');
    if (description === '' || description.length < 20) failures.push('Description must be at least 20 characters');
    if (description.length > 2000) failures.push('Description must be 2000 characters or less');
    if (descriptionWordCount < 3) failures.push('Description must include at least 3 words');
    if (/\b([a-z]{2,})\b(?:\s+\1){1,}/i.test(description)) failures.push('Description appears repetitive or spam-like');
    if (!bikeKeywordRegex.test(combinedText)) failures.push('Description must include at least one bike-related keyword');
    if (location === '') failures.push('Location is required');
    if (location.length > 120) failures.push('Location must be 120 characters or less');
    if (Number(listing.price) <= 0) failures.push('Price must be greater than 0');
    if (Number(listing.price) > 10000000) failures.push('Price exceeds allowed limit');
    if (Number(listing.quantity) < 1) failures.push('Quantity must be at least 1');
    if (Number(listing.quantity) > 999) failures.push('Quantity must be 999 or less');
    if (images.length < 1) failures.push('At least one product image is required');
    if (images.length > 10) failures.push('Maximum 10 product images allowed');
    if (!['sale', 'trade', 'both'].includes((listing.for_type || '').trim().toLowerCase())) failures.push('Listing type must be sale, trade, or both');
    if (!['brand new', 'second hand'].includes((listing.condition || '').trim().toLowerCase())) failures.push('Condition must be brand new or second hand');
    if ((listing.category || '').trim() === '') failures.push('Category is required');

    const brandName = (listing.brand_name || '').trim().toLowerCase();
    const customBrand = (listing.custom_brand || '').trim();
    if (brandName === 'others' && customBrand === '') {
      failures.push('Custom brand detail is required for Others');
    }

    if (listing.bicycle_brand_id === null || listing.bicycle_brand_id === undefined || listing.bicycle_part_id === null || listing.bicycle_part_id === undefined) {
      failures.push('Bicycle brand and part must be selected');
    }

    if (specs.length < 1 && !technicalDetailRegex.test(description)) {
      failures.push('Provide at least one specification or technical detail');
    }

    return failures;
  }

  viewDetails(listing: PendingListing) {
    this.selectedListing = listing;
    this.currentImageIndex = 0;
  }

  closeDetails() {
    this.selectedListing = null;
    this.currentImageIndex = 0;
  }

  nextImage() {
    if (this.selectedListing && this.selectedListing.product_images) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.selectedListing.product_images.length;
    }
  }

  prevImage() {
    if (this.selectedListing && this.selectedListing.product_images) {
      this.currentImageIndex = (this.currentImageIndex - 1 + this.selectedListing.product_images.length) % this.selectedListing.product_images.length;
    }
  }

  openApproveModal(listing: PendingListing) {
    this.selectedListing = listing;
    this.showApproveModal = true;
  }

  closeApproveModal() {
    this.showApproveModal = false;
  }

  approveListing() {
    if (!this.selectedListing) return;

    const productId = this.selectedListing.product_id;
    this.closeApproveModal();

    this.apiService.approveProduct(productId).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.showSuccess('Listing approved successfully!', 'approved');
          this.loadPendingListings();
          this.closeDetails();
        }
      },
      error: (error) => {
        this.showSuccess('Failed to approve listing', 'rejected');
      }
    });
  }

  openRejectModal(listing: PendingListing) {
    this.selectedListing = listing;
    this.showRejectModal = true;
    this.rejectionReason = '';
    this.violationCode = 'other'; // Reset to default
  }

  closeRejectModal() {
    this.showRejectModal = false;
    this.rejectionReason = '';
    this.violationCode = 'other';
  }

  rejectListing() {
    if (!this.selectedListing || !this.rejectionReason.trim()) {
      this.showSuccess('Please provide a reason for rejection', 'rejected');
      return;
    }

    this.apiService.rejectProduct(this.selectedListing.product_id, this.rejectionReason, this.violationCode).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.showSuccess('Listing rejected successfully!', 'rejected');
          this.loadPendingListings();
          this.closeRejectModal();
          this.closeDetails();
        }
      },
      error: (error) => {
        this.showSuccess('Failed to reject listing', 'rejected');
      }
    });
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) return 'assets/images/placeholder.png';
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    let cleanPath = imagePath.replace(/^\/+/, '');
    cleanPath = cleanPath.replace(/^api\//, '');
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/^api[\/\\]uploads[\/\\]/, '');
    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  getVideoUrl(videoPath: string): string {
    if (!videoPath) {
      return '';
    }
    
    // If it's already a complete URL or base64
    if (videoPath.startsWith('http') || videoPath.startsWith('data:')) {
      return videoPath;
    }
    
    let cleanPath = videoPath.replace(/^\/+/, '');
    cleanPath = cleanPath.replace(/^api\//, '');
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/^api[\/\\]uploads[\/\\]/, '');
    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  onVideoError(event: any, videoPath: string) {
    // Video failed to load - silently handle error
  }

  showSuccess(message: string, type: 'approved' | 'rejected') {
    this.successMessage = message;
    this.successType = type;
    this.showSuccessModal = true;
    
    // Clear existing timer if any
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
    
    // Auto close after 3 seconds
    this.autoCloseTimer = setTimeout(() => {
      this.closeSuccessModal();
    }, 3000);
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
  }

  ngOnDestroy() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
  }
}
