import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';

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
    { value: 'cervelo', label: 'Cervélo' },
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
      console.log('🔧 Edit Modal - Original Product:', this.productToEdit);
      
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
          console.warn('⚠️ Failed to parse product videos:', this.productToEdit.product_videos);
          cleanedVideos = [];
        }
      }
      
      console.log('🎬 Edit Modal - Cleaned Videos:', cleanedVideos);
      
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
      
      console.log('📝 Edit Modal - Edit Product:', this.editProduct);
      console.log('🔧 Edit Modal - Specifications loaded:', this.editProduct.specifications);
      
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
    if (!this.validateProduct(this.editProduct)) {
      this.showError('Please fill in all required fields');
      return;
    }

    // 🔍 Authorization check
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
      uploader_id: this.editProduct.uploader_id || this.userId // ✅ Use product's uploader_id first
    };

    // 🔍 Debug logging
    console.log('💾 Save Debug Info:');
    console.log('Product ID:', this.editProduct.product_id);
    console.log('Current User ID:', this.userId);
    console.log('Product Uploader ID:', this.editProduct.uploader_id);
    console.log('Using Uploader ID:', updateData.uploader_id);
    console.log('Authorization Info:', this.getAuthInfo());
    console.log('Specifications to save:', validSpecifications);
    console.log('Full Update Data:', updateData);

    // ⚠️ Authorization warning
    if (!this.canEditProduct()) {
      console.warn('⚠️ AUTHORIZATION WARNING: Current user may not be able to edit this product!');
      console.warn('This might cause "Product not found or unauthorized" error');
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
        console.error('Error updating product:', error);
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
      for (let file of files) {
        if (file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) { // 5MB limit
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              if (!this.editProduct.product_images) {
                this.editProduct.product_images = [];
              }
              this.editProduct.product_images.push(e.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        }
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
    return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/${videoPath}`;
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

  private validateProduct(product: Partial<Product>): boolean {
    // Check if brand is "others" and custom brand is required
    const brandValid = product.brand_name !== 'others' || (product.brand_name === 'others' && product.custom_brand && product.custom_brand.trim().length > 0);
    
    return !!(
      product.product_name &&
      product.brand_name &&
      brandValid &&
      product.price &&
      product.description &&
      product.location &&
      product.for_type &&
      product.condition &&
      product.category &&
      product.quantity && product.quantity > 0
    );
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('data:')) {
      return imagePath; // Base64 image
    }
    return `${this.apiService.baseUrl}${imagePath}`;
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
      console.log(`🔄 Updated specification ${index} ${field}:`, value);
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
    console.log('🔍 DETAILED AUTH DEBUG:');
    console.log('localStorage id:', localStorage.getItem('id'));
    console.log('localStorage email:', localStorage.getItem('email'));
    console.log('localStorage full_name:', localStorage.getItem('full_name'));
    console.log('Component userId:', this.userId);
    console.log('productToEdit:', this.productToEdit);
    console.log('editProduct:', this.editProduct);
    console.log('editProduct.uploader_id:', this.editProduct.uploader_id);
    console.log('Can edit product:', this.canEditProduct());
    
    if (!this.userId) {
      console.error('❌ User not logged in - localStorage id is missing or invalid');
    }
    
    if (!this.editProduct.uploader_id) {
      console.error('❌ Product uploader_id is missing from product data');
    }
    
    if (this.userId && this.editProduct.uploader_id && this.userId !== this.editProduct.uploader_id) {
      console.error(`❌ Authorization mismatch: User ${this.userId} trying to edit product owned by ${this.editProduct.uploader_id}`);
    }
  }
}