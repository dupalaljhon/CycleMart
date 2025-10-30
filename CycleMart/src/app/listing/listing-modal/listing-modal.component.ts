import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api/api.service';

interface NewProduct {
  product_id?: number;
  product_name: string;
  brand_name: 'giant' | 'trek' | 'specialized' | 'cannondale' | 'merida' | 'scott' | 'bianchi' | 'cervelo' | 'pinarello' | 'shimano' | 'sram' | 'campagnolo' | 'microshift' | 'fsa' | 'vision' | 'zipp' | 'dt swiss' | 'others' | 'no brand';
  custom_brand?: string;
  product_images: string[];
  product_videos?: string[];
  price: number;
  description: string;
  location: string;
  for_type: 'sale' | 'trade' | 'both';
  condition: 'brand new' | 'second hand';
  category: 'whole bike' | 'frame' | 'wheelset' | 'groupset' | 'drivetrain' | 'brakes' | 'tires' | 'saddle' | 'handlebar' | 'accessories' | 'others';
  quantity: number;
  status?: 'active' | 'archived';
  sale_status?: 'available' | 'reserved' | 'sold' | 'traded';
  created_at?: string;
  uploader_id?: number;
}

@Component({
  selector: 'app-listing-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listing-modal.component.html',
  styleUrl: './listing-modal.component.css'
})
export class ListingModalComponent implements OnInit {
  @Input() showModal: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() productAdded = new EventEmitter<void>();

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
  
  // New product form
  newProduct: Partial<NewProduct> = {
    product_name: '',
    brand_name: 'no brand',
    custom_brand: '',
    price: 0,
    description: '',
    location: '',
    for_type: 'sale',
    condition: 'second hand',
    category: 'others',
    quantity: 1,
    product_images: [],
    product_videos: []
  };

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
    { value: 'tires', label: 'Tires' },
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

  ngOnInit() {
    this.resetNewProductForm();
  }

  resetNewProductForm() {
    this.newProduct = {
      product_name: '',
      brand_name: 'no brand',
      custom_brand: '',
      price: 0,
      description: '',
      location: '',
      for_type: 'sale',
      condition: 'second hand',
      category: 'others',
      quantity: 1,
      product_images: [],
      product_videos: []
    };
  }

  close() {
    this.resetNewProductForm();
    this.resetNotifications();
    this.closeModal.emit();
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  saveNewProduct() {
    if (!this.validateProduct(this.newProduct)) {
      this.showError('Please fill in all required fields. Make sure to include product name, brand, price, description, location, and category.');
      return;
    }

    this.isProcessing = true;
    const productData = {
      ...this.newProduct,
      uploader_id: this.userId,
      product_images: JSON.stringify(this.newProduct.product_images || []),
      product_videos: JSON.stringify(this.newProduct.product_videos || [])
    };

    console.log('Sending product data:', productData);
    console.log('Product videos count:', this.newProduct.product_videos?.length || 0);

    this.apiService.addProduct(productData).subscribe({
      next: (response) => {
        this.isProcessing = false;
        if (response.status === 'success') {
          this.showSuccess('Product added successfully! Your new listing is now live and visible to other users.');
          setTimeout(() => {
            this.productAdded.emit();
            this.close();
          }, 2000);
        } else {
          this.showError('Failed to add product: ' + (response.message || 'Unknown error occurred'));
        }
      },
      error: (error) => {
        this.isProcessing = false;
        console.error('Error adding product:', error);
        this.showError('Failed to add product. Please check your internet connection and try again.');
      }
    });
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
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            const imageData = e.target.result;
            this.newProduct.product_images = this.newProduct.product_images || [];
            this.newProduct.product_images.push(imageData);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  removeImage(index: number) {
    this.newProduct.product_images?.splice(index, 1);
  }

  // Video upload methods
  onVideoSelect(event: any) {
    console.log('Video files selected:', event.target.files);
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
    console.log('Processing video files:', files);
    if (!files) return;
    
    if (!this.newProduct.product_videos) {
      this.newProduct.product_videos = [];
    }

    // Check if adding these files would exceed the limit
    if (this.newProduct.product_videos.length + files.length > 3) {
      this.showError('Maximum 3 videos allowed per product');
      return;
    }

    Array.from(files).forEach(file => {
      console.log('Processing video file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      // Validate file type - more specific validation
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg'];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      const allowedExtensions = ['mp4', 'mov', 'avi', 'webm', 'ogg'];
      
      if (!file.type.startsWith('video/') || (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || ''))) {
        console.error('Invalid video type:', file.type, 'Extension:', fileExtension);
        this.showError(`${file.name} is not a supported video format. Please use MP4, MOV, AVI, WebM, or OGG files.`);
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        this.showError(`${file.name} is too large. Maximum size is 50MB`);
        return;
      }

      console.log('Video file validation passed, converting to base64...');
      
      // Convert to base64 for upload
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result && this.newProduct.product_videos) {
          console.log('Video converted to base64, adding to product_videos array');
          this.newProduct.product_videos.push(result);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  removeVideo(index: number) {
    this.newProduct.product_videos?.splice(index, 1);
  }

  getVideoUrl(videoPath: string): string {
    if (videoPath.startsWith('data:')) {
      return videoPath; // Base64 video
    }
    return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/${videoPath}`;
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
    
    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex && this.newProduct.product_images) {
      const draggedImage = this.newProduct.product_images[this.draggedIndex];
      
      // Remove the dragged image from its original position
      this.newProduct.product_images.splice(this.draggedIndex, 1);
      
      // Insert at new position (adjust index if we removed an item before the drop position)
      const adjustedIndex = this.draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
      this.newProduct.product_images.splice(adjustedIndex, 0, draggedImage);
    }
    
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  onDragEnd() {
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  // Set image as thumbnail (move to first position)
  setAsThumbnail(index: number) {
    if (index !== 0 && this.newProduct.product_images) {
      const selectedImage = this.newProduct.product_images[index];
      this.newProduct.product_images.splice(index, 1);
      this.newProduct.product_images.unshift(selectedImage);
    }
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
    
    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex && this.newProduct.product_videos) {
      const draggedVideo = this.newProduct.product_videos[this.draggedIndex];
      
      // Remove the dragged video from its original position
      this.newProduct.product_videos.splice(this.draggedIndex, 1);
      
      // Insert at new position (adjust index if we removed an item before the drop position)
      const adjustedIndex = this.draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
      this.newProduct.product_videos.splice(adjustedIndex, 0, draggedVideo);
    }
    
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  // Get CSS classes for image container
  getImageClasses(index: number): string {
    let classes = 'border-2 hover:border-[#6BA3BE] transition-all duration-200 cursor-pointer hover:shadow-lg';
    
    if (index === 0) {
      classes += ' border-yellow-400 shadow-md';
    } else {
      classes += ' border-gray-200';
    }
    
    if (this.draggedIndex === index) {
      classes += ' opacity-50 scale-95';
    }
    
    if (this.dragOverIndex === index && this.draggedIndex !== null) {
      classes += ' border-blue-500 border-dashed';
    }
    
    return classes;
  }

  private validateProduct(product: Partial<NewProduct>): boolean {
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
    if (this.newProduct.brand_name !== 'others') {
      this.newProduct.custom_brand = '';
    }
  }

  // Check if custom brand input should be shown
  shouldShowCustomBrand(): boolean {
    return this.newProduct.brand_name === 'others';
  }

  // Notification Methods
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
}
