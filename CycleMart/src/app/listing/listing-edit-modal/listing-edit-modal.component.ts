import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';
import { environment } from '../../../environments/environment';

interface ProductSpecification {
  spec_id?: number;
  spec_name: string;
  spec_value: string;
}

interface Product {
  product_id: number;
  product_name: string;
  brand_name?: 'giant' | 'trek' | 'specialized' | 'cannondale' | 'merida' | 'scott' | 'bianchi' | 'cervelo' | 'pinarello' | 'shimano' | 'sram' | 'campagnolo' | 'microshift' | 'fsa' | 'vision' | 'zipp' | 'dt swiss' | 'others' | 'no brand';
  custom_brand?: string;
  brand_display?: string;
  product_images: string[];
  product_videos?: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand new' | 'second hand';
  category: 'whole bike' | 'frame' | 'wheelset' | 'groupset' | 'drivetrain' | 'brakes' | 'tires' | 'saddle' | 'handlebar' | 'accessories' | 'others';
  quantity: number;
  status: 'active' | 'archived';
  sale_status: 'available' | 'sold' | 'reserved' | 'traded';
  created_at: string;
  uploader_id: number;
  specifications?: ProductSpecification[];
  isEditing?: boolean;
}

@Component({
  selector: 'app-listing-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listing-edit-modal.component.html',
  styleUrl: './listing-edit-modal.component.css'
})
export class ListingEditModalComponent implements OnInit, OnChanges {
  @Input() showModal: boolean = false;
  @Input() productToEdit: Product | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() productUpdated = new EventEmitter<void>();

  editProduct: Partial<Product> = {};
  isDragOver = false;
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;
  userId: number = 0;
  
  // Notification properties
  showSuccessModal = false;
  showErrorModal = false;
  successMessage = '';
  errorMessage = '';
  isProcessing = false;
  private readonly minProductNameLength = 4;
  private readonly maxProductNameLength = 120;
  private readonly minDescriptionLength = 20;
  private readonly maxDescriptionLength = 2000;
  private readonly maxPrice = 10000000;
  private readonly maxLocationLength = 120;
  private readonly maxImages = 10;
  private readonly maxSpecificationRows = 20;

  // Brand options for dropdown
  brands = [
    { value: 'no brand', label: 'No Brand' },
    { value: 'giant', label: 'Giant' },
    { value: 'trek', label: 'Trek' },
    { value: 'specialized', label: 'Specialized' },
    { value: 'cannondale', label: 'Cannondale' },
    { value: 'merida', label: 'Merida' },
    { value: 'scott', label: 'Scott' },
    { value: 'bianchi', label: 'Bianchi' },
    { value: 'cervelo', label: 'CervÃ©lo' },
    { value: 'pinarello', label: 'Pinarello' },
    { value: 'shimano', label: 'Shimano' },
    { value: 'sram', label: 'SRAM' },
    { value: 'campagnolo', label: 'Campagnolo' },
    { value: 'microshift', label: 'MicroSHIFT' },
    { value: 'fsa', label: 'FSA' },
    { value: 'vision', label: 'Vision' },
    { value: 'zipp', label: 'Zipp' },
    { value: 'dt swiss', label: 'DT Swiss' },
    { value: 'others', label: 'Others' }
  ];

  // Categories for dropdown
  categories = [
    { value: 'whole bike', label: 'Whole Bike' },
    { value: 'frame', label: 'Frame' },
    { value: 'wheelset', label: 'Wheelset' },
    { value: 'groupset', label: 'Groupset' },
    { value: 'drivetrain', label: 'Drivetrain' },
    { value: 'brakes', label: 'Brakes' },
    { value: 'saddle', label: 'Saddle' },
    { value: 'handlebar', label: 'Handlebar' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'others', label: 'Others' }
  ];

  constructor(private apiService: ApiService) {
    // Get user ID from localStorage
    const storedId = localStorage.getItem('id');
    this.userId = storedId ? parseInt(storedId) : 0;
  }

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['productToEdit'] && this.productToEdit) {
      
      // Process and clean video data
      let cleanedVideos: string[] = [];
      if (this.productToEdit.product_videos) {
        try {
          let videoData = this.productToEdit.product_videos;
          
          // Parse if it's a string
          if (typeof videoData === 'string') {
            videoData = JSON.parse(videoData);
          }
          
          // Ensure it's an array and filter out duplicates and invalid entries
          if (Array.isArray(videoData)) {
            cleanedVideos = [...new Set(videoData)]  // Remove duplicates using Set
              .filter(video => 
                typeof video === 'string' && 
                video.trim().length > 0 &&
                !video.includes('undefined') &&
                !video.includes('null')
              )
              .slice(0, 3); // Limit to max 3 videos
          }
        } catch (e) {
          cleanedVideos = [];
        }
      }
      
      
      // Create a deep copy to avoid modifying the original product
      this.editProduct = {
        ...this.productToEdit,
        product_images: [...(this.productToEdit.product_images || [])],
        product_videos: cleanedVideos,
        specifications: this.productToEdit.specifications ? 
          this.productToEdit.specifications.map(spec => ({
            spec_id: spec.spec_id,
            spec_name: spec.spec_name,
            spec_value: spec.spec_value
          })) : []
      };
      
      
      // Debug authorization information
      this.debugAuthInfo();
      
      // Specifications are now automatically loaded with product data
      // No need for separate specification loading
    }
  }

  close() {
    this.closeModal.emit();
    this.resetNotifications();
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  saveChanges() {
    this.editProduct.product_name = this.normalizeText(this.editProduct.product_name);
    this.editProduct.description = this.normalizeText(this.editProduct.description);
    this.editProduct.location = this.normalizeText(this.editProduct.location);
    this.editProduct.custom_brand = this.normalizeText(this.editProduct.custom_brand);

    if (this.editProduct.specifications && this.editProduct.specifications.length > 0) {
      this.editProduct.specifications = this.editProduct.specifications.map(spec => ({
        ...spec,
        spec_name: this.normalizeText(spec.spec_name),
        spec_value: this.normalizeText(spec.spec_value)
      }));
    }

    const validationError = this.validateProduct(this.editProduct);
    if (validationError) {
      this.showError(validationError);
      return;
    }

    // ðŸ” Authorization check
    if (!this.editProduct.product_id) {
      this.showError('Product ID is missing');
      return;
    }

    if (!this.userId) {
      this.showError('You must be logged in to edit products. Please login again.');
      return;
    }

    if (!this.editProduct.uploader_id) {
      this.showError('Product ownership information is missing. Cannot edit this product.');
      return;
    }

    if (this.editProduct.uploader_id !== this.userId) {
      this.showError('You can only edit your own products. This product belongs to another user.');
      return;
    }

    this.isProcessing = true;
    
    // Filter out empty specifications and prepare for API
    const validSpecifications = (this.editProduct.specifications || [])
      .filter(spec => spec.spec_name.trim() && spec.spec_value.trim())
      .map(spec => ({
        spec_name: spec.spec_name.trim(),
        spec_value: spec.spec_value.trim()
      }));

    const updateData = {
      product_id: this.editProduct.product_id,
      product_name: this.editProduct.product_name,
      brand_name: this.editProduct.brand_name || 'no brand',
      custom_brand: this.editProduct.custom_brand || '',
      bicycle_brand_id: (this.editProduct as any).bicycle_brand_id ?? null,
      bicycle_part_id: (this.editProduct as any).bicycle_part_id ?? null,
      price: this.editProduct.price,
      description: this.editProduct.description,
      location: this.editProduct.location,
      for_type: this.editProduct.for_type,
      condition: this.editProduct.condition,
      category: this.editProduct.category,
      quantity: this.editProduct.quantity,
      product_images: JSON.stringify(this.editProduct.product_images || []),
      product_videos: JSON.stringify(this.editProduct.product_videos || []),
      specifications: validSpecifications,
      uploader_id: this.editProduct.uploader_id || this.userId // âœ… Use product's uploader_id first
    };

    // ðŸ” Debug logging
    // âš ï¸ Authorization warning
    if (!this.canEditProduct()) {
    }

    this.apiService.updateProduct(updateData).subscribe({
      next: (response: any) => {
        this.isProcessing = false;
        if (response.status === 'success') {
          this.showSuccess('Product updated successfully! Your changes have been saved.');
          setTimeout(() => {
            this.productUpdated.emit();
            this.close();
          }, 2000);
        } else {
          this.showError('Failed to update product: ' + (response.message || 'Unknown error'));
        }
      },
      error: (error: any) => {
        this.isProcessing = false;
        this.showError('Failed to update product. Please check your connection and try again.');
      }
    });
  }

  // Notification methods
  showSuccess(message: string) {
    this.successMessage = message;
    this.showSuccessModal = true;
    this.showErrorModal = false;
  }

  showError(message: string) {
    this.errorMessage = message;
    this.showErrorModal = true;
    this.showSuccessModal = false;
  }

  resetNotifications() {
    this.showSuccessModal = false;
    this.showErrorModal = false;
    this.successMessage = '';
    this.errorMessage = '';
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
  }

  closeErrorModal() {
    this.showErrorModal = false;
  }

  onImageSelect(event: any) {
    const files = event.target.files;
    this.handleImageFiles(files);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files || null;
    this.handleImageFiles(files);
  }

  private handleImageFiles(files: FileList | null) {
    if (files) {
      this.editProduct.product_images = this.editProduct.product_images || [];

      if (this.editProduct.product_images.length >= this.maxImages) {
        this.showError(`Maximum ${this.maxImages} images allowed per product.`);
        return;
      }

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          this.showError(`${file.name} is too large. Maximum image size is 10MB.`);
          continue;
        }

        if ((this.editProduct.product_images?.length || 0) >= this.maxImages) {
          this.showError(`Maximum ${this.maxImages} images allowed per product.`);
          break;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            if (!this.editProduct.product_images) {
              this.editProduct.product_images = [];
            }
            if (this.editProduct.product_images.length < this.maxImages) {
              this.editProduct.product_images.push(e.target.result as string);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removeImage(index: number) {
    this.editProduct.product_images?.splice(index, 1);
  }

  // Drag and Drop for Image Reordering
  onDragStart(event: DragEvent, index: number) {
    this.draggedIndex = index;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/html', '');
  }

  onDragOverImage(event: DragEvent, index: number) {
    if (this.draggedIndex !== null && this.draggedIndex !== index) {
      event.preventDefault();
      this.dragOverIndex = index;
    }
  }

  onDropImage(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    
    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex && this.editProduct.product_images) {
      const draggedImage = this.editProduct.product_images[this.draggedIndex];
      
      // Remove the dragged image from its original position
      this.editProduct.product_images.splice(this.draggedIndex, 1);
      
      // Insert at new position (adjust index if we removed an item before the drop position)
      const insertIndex = this.draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
      this.editProduct.product_images.splice(insertIndex, 0, draggedImage);
    }
    
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  onDragEnd() {
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  // Video upload methods
  onVideoSelect(event: any) {
    this.processVideoFiles(event.target.files);
  }

  onVideoDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onVideoDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onVideoDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    this.processVideoFiles(event.dataTransfer?.files);
  }

  processVideoFiles(files: FileList | undefined) {
    if (!files) return;
    
    if (!this.editProduct.product_videos) {
      this.editProduct.product_videos = [];
    }

    // Check if adding these files would exceed the limit
    if (this.editProduct.product_videos.length + files.length > 3) {
      this.showError('Maximum 3 videos allowed per product');
      return;
    }

    Array.from(files).forEach(file => {
      // Validate file type - more specific validation
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg'];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      const allowedExtensions = ['mp4', 'mov', 'avi', 'webm', 'ogg'];
      
      if (!file.type.startsWith('video/') || (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || ''))) {
        this.showError(`${file.name} is not a supported video format. Please use MP4, MOV, AVI, WebM, or OGG files.`);
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        this.showError(`${file.name} is too large. Maximum size is 50MB`);
        return;
      }

      // Convert to base64 for upload
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result && this.editProduct.product_videos) {
          this.editProduct.product_videos.push(result);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  removeVideo(index: number) {
    this.editProduct.product_videos?.splice(index, 1);
  }

  getVideoUrl(videoPath: string): string {
    if (videoPath.startsWith('data:')) {
      return videoPath; // Base64 video
    }
    const cleanPath = videoPath.startsWith('/') ? videoPath.substring(1) : videoPath;
    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  // Video Drag and Drop for Reordering
  onVideoDragStart(event: DragEvent, index: number) {
    this.draggedIndex = index;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/html', '');
  }

  onVideoDragOverItem(event: DragEvent, index: number) {
    if (this.draggedIndex !== null && this.draggedIndex !== index) {
      event.preventDefault();
      this.dragOverIndex = index;
    }
  }

  onVideoDropItem(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    
    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex && this.editProduct.product_videos) {
      const draggedVideo = this.editProduct.product_videos[this.draggedIndex];
      
      // Remove the dragged video from its original position
      this.editProduct.product_videos.splice(this.draggedIndex, 1);
      
      // Insert at new position (adjust index if we removed an item before the drop position)
      const insertIndex = this.draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
      this.editProduct.product_videos.splice(insertIndex, 0, draggedVideo);
    }
    
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  // Set image as thumbnail (move to first position)
  setAsThumbnail(index: number) {
    if (index !== 0 && this.editProduct.product_images) {
      const image = this.editProduct.product_images.splice(index, 1)[0];
      this.editProduct.product_images.unshift(image);
    }
  }

  // Get CSS classes for image container
  getImageClasses(index: number): string {
    let classes = 'border-2 hover:border-[#6BA3BE] transition-all duration-200 cursor-pointer hover:shadow-lg';
    
    if (index === 0) {
      classes += ' border-green-400 bg-green-50';
    } else {
      classes += ' border-gray-200';
    }
    
    if (this.draggedIndex === index) {
      classes += ' opacity-50 scale-95';
    }
    
    if (this.dragOverIndex === index && this.draggedIndex !== null) {
      classes += ' border-blue-400 bg-blue-50';
    }
    
    return classes;
  }

  private validateProduct(product: Partial<Product>): string | null {
    const productName = (product.product_name || '').trim();
    const description = (product.description || '').trim();
    const location = (product.location || '').trim();
    const customBrand = (product.custom_brand || '').trim();
    const priceNumber = Number(product.price);
    const quantityNumber = Number(product.quantity);

    if (!productName) {
      return 'Product name is required.';
    }

    if (productName.length < this.minProductNameLength || productName.length > this.maxProductNameLength) {
      return `Product name must be between ${this.minProductNameLength} and ${this.maxProductNameLength} characters.`;
    }

    if (!this.isValidSimpleText(productName)) {
      return 'Product name contains invalid characters. Allowed: letters, numbers, spaces, and basic punctuation (.-,&()/#+).';
    }

    if (!product.brand_name) {
      return 'Please select a valid product brand.';
    }

    if (product.brand_name === 'others' && !customBrand) {
      return 'Custom brand is required when Others is selected.';
    }

    if (customBrand.length > 100) {
      return 'Custom brand name must be 100 characters or less.';
    }

    if (customBrand && !this.isValidSimpleText(customBrand)) {
      return 'Custom brand name contains invalid characters.';
    }

    if (!Number.isFinite(priceNumber) || priceNumber <= 0 || priceNumber > this.maxPrice) {
      return `Price must be greater than 0 and not exceed ${this.maxPrice.toLocaleString()}.`;
    }

    if (!this.hasAtMostTwoDecimals(priceNumber)) {
      return 'Price can only have up to 2 decimal places.';
    }

    if (!description) {
      return 'Description is required.';
    }

    if (description.length < this.minDescriptionLength || description.length > this.maxDescriptionLength) {
      return `Description must be between ${this.minDescriptionLength} and ${this.maxDescriptionLength} characters.`;
    }

    if (!location) {
      return 'Location is required.';
    }

    if (location.length > this.maxLocationLength) {
      return `Location must be ${this.maxLocationLength} characters or less.`;
    }

    if (!this.isValidSimpleText(location)) {
      return 'Location contains invalid characters.';
    }

    if (!product.for_type || !product.condition || !product.category) {
      return 'Please complete category, condition, and listing type.';
    }

    if (!Number.isInteger(quantityNumber) || quantityNumber < 1 || quantityNumber > 999) {
      return 'Quantity must be a whole number between 1 and 999.';
    }

    const imageCount = product.product_images?.length || 0;
    if (imageCount < 1) {
      return 'Please upload at least 1 product image.';
    }

    if (imageCount > this.maxImages) {
      return `Maximum ${this.maxImages} images allowed.`;
    }

    if ((product.specifications?.length || 0) > this.maxSpecificationRows) {
      return `You can add up to ${this.maxSpecificationRows} custom specifications only.`;
    }

    for (const spec of product.specifications || []) {
      const specName = (spec.spec_name || '').trim();
      const specValue = (spec.spec_value || '').trim();

      if ((specName && !specValue) || (!specName && specValue)) {
        return 'Each custom specification requires both a name and a value.';
      }

      if (specName.length > 100) {
        return 'Specification name must be 100 characters or less.';
      }

      if (specValue.length > 255) {
        return 'Specification value must be 255 characters or less.';
      }

      if (specName && !this.isValidSimpleText(specName)) {
        return 'A specification name contains invalid characters.';
      }
    }

    return null;
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private isValidSimpleText(value: string): boolean {
    return /^[A-Za-z0-9\s.,'()&\-\/#:+]+$/.test(value);
  }

  private hasAtMostTwoDecimals(value: number): boolean {
    return /^\d+(\.\d{1,2})?$/.test(value.toString());
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }

    if (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    let cleanPath = imagePath.replace(/^\/+/, '');
    cleanPath = cleanPath.replace(/^api\//, '');
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/^api[\/\\]uploads[\/\\]/, '');

    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  onModalClick(event: Event) {
    // Prevent modal from closing when clicking inside the modal content
    event.stopPropagation();
  }

  onOverlayClick() {
    // Close modal when clicking on the overlay
    this.close();
  }

  // Handle brand selection change
  onBrandChange() {
    // Clear custom brand when switching away from "others"
    if (this.editProduct.brand_name !== 'others') {
      this.editProduct.custom_brand = '';
    }
  }

  // Check if custom brand input should be shown
  shouldShowCustomBrand(): boolean {
    return this.editProduct.brand_name === 'others';
  }

  // Specification Management Methods
  addSpecification() {
    if (!this.editProduct.specifications) {
      this.editProduct.specifications = [];
    }
    this.editProduct.specifications.push({
      spec_name: '',
      spec_value: ''
    });
  }

  removeSpecification(index: number) {
    // Simply remove from local array - will be saved when main product is updated
    if (this.editProduct.specifications && index >= 0 && index < this.editProduct.specifications.length) {
      this.editProduct.specifications.splice(index, 1);
    }
  }

  // Individual specification saving removed - specifications are now saved with the main product
  // All specifications will be saved when the main "Save Changes" button is clicked

  // Bulk specification saving removed - specifications are now saved with the main product
  // Use the main "Save Changes" button to save all product data including specifications

  trackByIndex(index: number, item: any): any {
    return index;
  }

  // Specification loading removed - specifications are now included in main product data

  // Get specifications count for display
  getSpecificationsCount(): number {
    return this.editProduct.specifications?.length || 0;
  }

  // Check if product has specifications
  hasSpecifications(): boolean {
    return !!(this.editProduct.specifications && this.editProduct.specifications.length > 0);
  }

  // Validate specification before adding/updating
  validateSpecification(spec: ProductSpecification): boolean {
    return spec.spec_name.trim().length > 0 && spec.spec_value.trim().length > 0;
  }

  // Clear empty specifications
  cleanupSpecifications() {
    if (this.editProduct.specifications) {
      this.editProduct.specifications = this.editProduct.specifications.filter(spec => 
        this.validateSpecification(spec)
      );
    }
  }

  // Update specification at index
  updateSpecification(index: number, field: 'spec_name' | 'spec_value', value: string) {
    if (this.editProduct.specifications && index >= 0 && index < this.editProduct.specifications.length) {
      this.editProduct.specifications[index][field] = value;
    }
  }

  // Check if current user can edit this product
  canEditProduct(): boolean {
    if (!this.editProduct.uploader_id || !this.userId) {
      return false;
    }
    return this.editProduct.uploader_id === this.userId;
  }

  // Get authorization info for debugging
  getAuthInfo(): string {
    return `User ID: ${this.userId}, Product Uploader: ${this.editProduct.uploader_id}, Can Edit: ${this.canEditProduct()}`;
  }

  // Debug method to show all relevant information
  debugAuthInfo() {
    
    if (!this.userId) {
    }
    
    if (!this.editProduct.uploader_id) {
    }
    
    if (this.userId && this.editProduct.uploader_id && this.userId !== this.editProduct.uploader_id) {
    }
  }
}
