import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../api/api.service';
import { environment } from '../../../environments/environment';

interface ProductSpecification {
  spec_id?: number;
  spec_name: string;
  spec_value: string;
}

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
  specifications?: ProductSpecification[];
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
export class ListingModalComponent implements OnInit, OnChanges {
  @Input() showModal: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() productAdded = new EventEmitter<void>();

  isDragOver = false;
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;
  userId: number = 0;
  userBarangay: string = ''; // Store user's barangay
  isLoadingProfile = false; // Track if profile is being loaded
  
  // Notification properties
  showSuccessModal = false;
  showErrorModal = false;
  successMessage = '';
  errorMessage = '';
  isProcessing = false;
  
  // New product form
  newProduct: Partial<NewProduct> = {
    product_name: '',
    brand_name: '' as any,
    custom_brand: '',
    price: 0,
    description: '',
    location: '',
    for_type: 'sale',
    condition: 'second hand',
    category: 'others',
    quantity: 1,
    product_images: [],
    product_videos: [],
    specifications: []
  };



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

  // ðŸš² Dynamic Bicycle Taxonomy Properties
  bicycleBrands: any[] = [];
  bicycleParts: any[] = [];
  partSpecifications: any[] = [];
  selectedBicycleBrandId: number | null = null;
  selectedBicyclePartId: number | null = null;
  specificationValues: { [key: string]: string } = {};
  isLoadingBrands = false;
  isLoadingParts = false;
  isLoadingSpecs = false;
  private readonly maxImages = 10;
  private readonly maxPrice = 10000000;
  private readonly maxDescriptionLength = 2000;
  private readonly maxProductNameLength = 120;
  private readonly minProductNameLength = 4;
  private readonly maxLocationLength = 120;
  private readonly maxSpecificationRows = 20;
  private readonly roadbikeFrameSizes = ['700c X 25', '700c X 28', '700c X 30', '700c X 32'];
  private readonly mountainBikeFrameSizes = ['26er', '27.5er', '29er'];
  
  // ðŸ†• Custom "Other" brand/part input
  customBrandName: string = '';
  customPartName: string = '';
  isOtherBrandSelected: boolean = false;

  constructor(private apiService: ApiService, private router: Router) {
    // Get user ID from localStorage
    const storedId = localStorage.getItem('id');
    this.userId = storedId ? parseInt(storedId) : 0;
  }

  ngOnInit() {
    // Load user profile first to get barangay, then reset form with that data
    this.loadUserProfile();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Load brands when modal is opened
    if (changes['showModal'] && changes['showModal'].currentValue === true) {
      this.loadBicycleBrands();
    }
  }

  loadUserProfile() {
    if (this.userId) {
      this.isLoadingProfile = true;
      this.apiService.getUser(this.userId).subscribe({
        next: (response) => {
          // Backend returns data as an array, get first element
          if (response.status === 'success' && response.data && response.data.length > 0) {
            const userData = response.data[0]; // Get first element from array
            // Get user's barangay and store it
            this.userBarangay = userData.barangay || '';
            
            // Reset form and set location with user's barangay
            this.resetNewProductForm(this.userBarangay);
            this.isLoadingProfile = false;
          } else {
            this.resetNewProductForm();
            this.isLoadingProfile = false;
          }
        },
        error: (error) => {
          this.resetNewProductForm();
          this.isLoadingProfile = false;
        }
      });
    } else {
      this.resetNewProductForm();
      this.isLoadingProfile = false;
    }
  }

  // ðŸš² Load bicycle brands from API
  loadBicycleBrands() {
    this.isLoadingBrands = true;
    this.apiService.getBicycleBrands().subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.bicycleBrands = response.data;
        } else {
          this.bicycleBrands = [];
        }
        this.isLoadingBrands = false;
      },
      error: (error) => {
        this.bicycleBrands = [];
        this.isLoadingBrands = false;
      }
    });
  }

  // ðŸš² Load bicycle parts filtered by selected brand
  onBicycleBrandChange() {
    // Check if "Others" (brand_id=16) or "No Brand" (brand_id=24) is selected
    this.isOtherBrandSelected = this.selectedBicycleBrandId === 16 || this.selectedBicycleBrandId === 24;
    
    if (!this.selectedBicycleBrandId) {
      this.bicycleParts = [];
      this.partSpecifications = [];
      this.selectedBicyclePartId = null;
      this.specificationValues = {};
      this.isOtherBrandSelected = false;
      this.customBrandName = '';
      this.customPartName = '';
      return;
    }

    this.isLoadingParts = true;
    this.bicycleParts = [];
    this.partSpecifications = [];
    this.selectedBicyclePartId = null;
    this.specificationValues = {};
    this.customPartName = ''; // Reset custom part name
    
    this.apiService.getBicyclePartsByBrand(this.selectedBicycleBrandId).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.bicycleParts = response.data;
        } else {
          this.bicycleParts = [];
        }
        this.isLoadingParts = false;
      },
      error: (error) => {
        this.bicycleParts = [];
        this.isLoadingParts = false;
      }
    });
  }

  // ðŸš² Load specifications for selected part
  onBicyclePartChange() {
    if (!this.selectedBicyclePartId) {
      this.partSpecifications = [];
      this.specificationValues = {};
      return;
    }

    this.isLoadingSpecs = true;
    this.partSpecifications = [];
    this.specificationValues = {};
    
    this.apiService.getPartSpecifications(this.selectedBicyclePartId).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          // Filter out 'condition' spec to avoid duplication with main Condition field
          const filteredSpecs = response.data.filter((spec: any) => spec.spec_name !== 'condition');
          this.partSpecifications = this.deduplicatePartSpecifications(filteredSpecs);
          
          // Initialize specification values object
          this.partSpecifications.forEach(spec => {
            this.specificationValues[spec.spec_name] = '';
          });
        }
        this.isLoadingSpecs = false;
      },
      error: (error) => {
        this.isLoadingSpecs = false;
      }
    });
  }

  private deduplicatePartSpecifications(specs: any[]): any[] {
    const uniqueSpecs = new Map<string, any>();

    for (const spec of specs) {
      const key = String(spec?.spec_name || '').trim().toLowerCase();
      if (!key) {
        continue;
      }

      if (!uniqueSpecs.has(key)) {
        uniqueSpecs.set(key, spec);
      }
    }

    return Array.from(uniqueSpecs.values());
  }

  // ðŸš² Convert spec_options from JSON string to array
  getSpecOptions(spec: any): string[] {
    try {
      if (!spec.spec_options) return [];
      // Check if it's already an array
      let options: string[] = [];
      if (Array.isArray(spec.spec_options)) {
        options = spec.spec_options;
      } else {
        // Try to parse JSON string
        options = JSON.parse(spec.spec_options);
      }

      // Restrict frame/wheel size options based on selected frameset type.
      if (this.isWheelSizeSpec(spec) || this.isFrameSizeSpec(spec)) {
        const restrictedSizes = this.getRestrictedSizesByFrameset();
        if (restrictedSizes) {
          return restrictedSizes;
        }
      }

      return options;
      // Try to parse JSON string
    } catch (error) {
      return [];
    }
  }

  onSpecificationValueChange(specName: string) {
    if (!specName) {
      return;
    }

    if (this.isFramesetSpecName(specName)) {
      this.enforceFramesetSizeRestriction();
    }
  }

  private enforceFramesetSizeRestriction() {
    const restrictedSizes = this.getRestrictedSizesByFrameset();
    if (!restrictedSizes) {
      return;
    }

    const sizeSpecs = this.partSpecifications.filter(spec => this.isWheelSizeSpec(spec) || this.isFrameSizeSpec(spec));
    for (const sizeSpec of sizeSpecs) {
      const specName = sizeSpec.spec_name;
      const selectedValue = this.specificationValues[specName];
      if (selectedValue && !restrictedSizes.includes(selectedValue)) {
        this.specificationValues[specName] = '';
      }
    }
  }

  private getRestrictedSizesByFrameset(): string[] | null {
    const frameSpec = this.partSpecifications.find(spec => this.isFramesetSpecName(spec.spec_name));
    if (!frameSpec) {
      return null;
    }

    const selectedValue = (this.specificationValues[frameSpec.spec_name] || '').toString().trim().toLowerCase();
    if (selectedValue === 'roadbike' || selectedValue === 'road bike') {
      return this.roadbikeFrameSizes;
    }

    if (selectedValue === 'mountainbike' || selectedValue === 'mountain bike') {
      return this.mountainBikeFrameSizes;
    }

    return null;
  }

  private isFramesetSpecName(specName: string): boolean {
    const normalized = (specName || '').toString().trim().toLowerCase();
    return normalized === 'frameset' || normalized === 'frameset_type' || normalized === 'frame_type';
  }

  private isWheelSizeSpec(spec: any): boolean {
    const specName = (spec?.spec_name || '').toString().trim().toLowerCase();
    const specLabel = (spec?.spec_label || '').toString().trim().toLowerCase();
    return specName === 'wheel_size' || specLabel === 'wheel size';
  }

  private isFrameSizeSpec(spec: any): boolean {
    const specName = (spec?.spec_name || '').toString().trim().toLowerCase();
    const specLabel = (spec?.spec_label || '').toString().trim().toLowerCase();
    return specName === 'frame_size' || specLabel === 'frame size';
  }

  // ðŸš² Get unique categories from bicycleParts for grouped options
  getUniqueCategories(): string[] {
    const categories = this.bicycleParts.map(part => part.category);
    return [...new Set(categories)].sort();
  }

  // ðŸš² Filter parts by category for optgroup
  getPartsByCategory(category: string): any[] {
    return this.bicycleParts.filter(part => part.category === category);
  }

  // ðŸš² Get regular brands (excluding "Others" and "No Brand")
  getRegularBrands(): any[] {
    return this.bicycleBrands.filter(brand => brand.brand_id !== 16 && brand.brand_id !== 24);
  }

  // ðŸš² Get special brands ("Others" and "No Brand")
  getSpecialBrands(): any[] {
    return this.bicycleBrands.filter(brand => brand.brand_id === 16 || brand.brand_id === 24)
      .sort((a, b) => {
        // Sort "No Brand" before "Others"
        if (a.brand_id === 24) return -1;
        if (b.brand_id === 24) return 1;
        return 0;
      });
  }

  resetNewProductForm(barangay: string = '') {
    this.newProduct = {
      product_name: '',
      brand_name: '' as any,
      custom_brand: '',
      price: 0,
      description: '',
      location: barangay, // Set location from parameter
      for_type: 'sale',
      condition: 'second hand',
      category: 'others',
      quantity: 1,
      product_images: [],
      product_videos: [],
      specifications: []
    };
    
    // Reset bicycle taxonomy selections
    this.selectedBicycleBrandId = null;
    this.selectedBicyclePartId = null;
    this.bicycleParts = [];
    this.partSpecifications = [];
    this.specificationValues = {};
    this.customBrandName = '';
    this.customPartName = '';
    this.isOtherBrandSelected = false;
    
  }

  close() {
    // Reload user profile to get fresh barangay data when modal is reopened
    this.loadUserProfile();
    this.resetNotifications();
    this.closeModal.emit();
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  saveNewProduct() {
    if (!this.ensureValidSession()) {
      return;
    }

    // Check if profile is still loading
    if (this.isLoadingProfile) {
      this.showError('Please wait while we load your profile information.');
      return;
    }

    // Validate that location (barangay) is filled
    if (!this.newProduct.location || this.newProduct.location.trim() === '') {
      this.showError('Location is required. Please make sure your profile has a barangay set.');
      return;
    }

    // Validate Component Brand selection
    if (!this.selectedBicycleBrandId) {
      this.showError('Please select a Component Brand from the Bicycle Component Details section.');
      return;
    }

    // Validate Component Type selection for all brands (including Others/No Brand)
    if (!this.selectedBicyclePartId) {
      this.showError('Please select a Component Type.');
      return;
    }

    // Normalize text fields before validation/submission
    this.newProduct.product_name = this.normalizeText(this.newProduct.product_name);
    this.newProduct.description = this.normalizeText(this.newProduct.description);
    this.newProduct.location = this.normalizeText(this.newProduct.location);
    this.customBrandName = this.normalizeText(this.customBrandName);

    if (this.newProduct.specifications && this.newProduct.specifications.length > 0) {
      this.newProduct.specifications = this.newProduct.specifications.map(spec => ({
        ...spec,
        spec_name: this.normalizeText(spec.spec_name),
        spec_value: this.normalizeText(spec.spec_value)
      }));
    }

    Object.keys(this.specificationValues).forEach(specName => {
      this.specificationValues[specName] = this.normalizeText(this.specificationValues[specName]);
    });

    // Note: Custom brand name is optional for "Others" and "No Brand" selections

    // Map Component Brand to product brand_name for backward compatibility
    if (this.isOtherBrandSelected) {
      // For "Others" or "No Brand" selections
      if (this.selectedBicycleBrandId === 24) {
        this.newProduct.brand_name = 'no brand';
        this.newProduct.custom_brand = this.customBrandName.trim() || '';
      } else {
        this.newProduct.brand_name = 'others';
        this.newProduct.custom_brand = this.customBrandName.trim() || '';
      }
    } else {
      // Find the brand name from bicycleBrands array
      const selectedBrand = this.bicycleBrands.find(b => b.brand_id === this.selectedBicycleBrandId);
      if (selectedBrand) {
        this.newProduct.brand_name = selectedBrand.brand_name.toLowerCase().replace(/\s+/g, ' ') as any;
        this.newProduct.custom_brand = '';
      }
    }

    const validationError = this.validateProduct(this.newProduct);
    if (validationError) {
      this.showError(validationError);
      return;
    }

    this.isProcessing = true;
    
    // ðŸ” DEBUG: Log videos before sending
    // ðŸš² Collect specifications from dropdowns (Series/Model, Shift Type, Speed, etc.)
    const dropdownSpecifications = Object.entries(this.specificationValues)
      .filter(([key, value]) => value && value.trim())
      .map(([key, value]) => ({
        spec_name: key,
        spec_value: value
      }));
    
    // Filter out empty custom specifications added by user
    const customSpecifications = (this.newProduct.specifications || [])
      .filter(spec => spec.spec_name.trim() && spec.spec_value.trim())
      .map(spec => ({
        spec_name: spec.spec_name.trim(),
        spec_value: spec.spec_value.trim()
      }));

    // âœ… Merge both dropdown specs and custom specs
    const validSpecifications = [...dropdownSpecifications, ...customSpecifications];


    const productData = {
      ...this.newProduct,
      uploader_id: this.userId,
      bicycle_brand_id: this.selectedBicycleBrandId,
      bicycle_part_id: this.selectedBicyclePartId,
      product_images: JSON.stringify(this.newProduct.product_images || []),
      product_videos: JSON.stringify(this.newProduct.product_videos || []),
      specifications: validSpecifications
    };


    this.apiService.addProduct(productData).subscribe({
      next: (response) => {
        this.isProcessing = false;
        if (response.status === 'success') {
          this.showSuccess('Product submitted successfully! Your listing is pending admin approval and will be visible once approved.');
          setTimeout(() => {
            this.productAdded.emit();
            this.close();
          }, 3000);
        } else {
          this.showError('Failed to add product: ' + (response.message || 'Unknown error occurred'));
        }
      },
      error: (error) => {
        this.isProcessing = false;

        if (error?.status === 401) {
          this.handleSessionExpired();
          return;
        }

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
      this.newProduct.product_images = this.newProduct.product_images || [];

      if (this.newProduct.product_images.length >= this.maxImages) {
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

        if ((this.newProduct.product_images?.length || 0) >= this.maxImages) {
          this.showError(`Maximum ${this.maxImages} images allowed per product.`);
          break;
        }

        const reader = new FileReader();
        reader.onload = (e: any) => {
          const imageData = e.target.result;
          this.newProduct.product_images = this.newProduct.product_images || [];

          if (this.newProduct.product_images.length < this.maxImages) {
            this.newProduct.product_images.push(imageData);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removeImage(index: number) {
    this.newProduct.product_images?.splice(index, 1);
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
    if (!files) {
      return;
    }
    
    if (!this.newProduct.product_videos) {
      this.newProduct.product_videos = [];
    }

    // Check if adding these files would exceed the limit
    if (this.newProduct.product_videos.length + files.length > 3) {
      this.showError('Maximum 3 videos allowed per product');
      return;
    }

    Array.from(files).forEach((file, index) => {
      
      // Validate file type - more specific validation
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg', 'video/x-matroska'];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      const allowedExtensions = ['mp4', 'mov', 'avi', 'webm', 'ogg', 'mkv'];
      
      if (!file.type.startsWith('video/') || (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || ''))) {
        this.showError(`${file.name} is not a supported video format. Please use MP4, MOV, AVI, WebM, OGG, or MKV files.`);
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
        if (result && this.newProduct.product_videos) {
          this.newProduct.product_videos.push(result);
        }
      };
      reader.onerror = (error) => {
        this.showError(`Failed to read video file: ${file.name}`);
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
    const cleanPath = videoPath.startsWith('/') ? videoPath.substring(1) : videoPath;
    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
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

  private validateProduct(product: Partial<NewProduct>): string | null {
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

    if (this.isOtherBrandSelected && customBrand && !this.isValidSimpleText(customBrand)) {
      return 'Custom brand name contains invalid characters.';
    }

    if (customBrand.length > 100) {
      return 'Custom brand name must be 100 characters or less.';
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

    if (description.length < 20 || description.length > this.maxDescriptionLength) {
      return `Description must be between 20 and ${this.maxDescriptionLength} characters.`;
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

    const missingRequiredSpec = this.partSpecifications.find(spec => {
      if (!spec.is_required) {
        return false;
      }

      const value = (this.specificationValues[spec.spec_name] || '').trim();
      return !value;
    });

    if (missingRequiredSpec) {
      const label = this.formatSpecName(missingRequiredSpec.spec_label || missingRequiredSpec.spec_name);
      return `${label} is required.`;
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
    if (imagePath.startsWith('data:')) {
      return imagePath; // Base64 image
    }
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
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

  private ensureValidSession(): boolean {
    const token = this.getStoredToken();
    if (!token) {
      this.showError('Please log in first, then try uploading your listing.');
      this.handleSessionExpired(false);
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.handleSessionExpired();
      return false;
    }

    return true;
  }

  private getStoredToken(): string | null {
    return localStorage.getItem('authToken') || localStorage.getItem('admin_token');
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) {
        return true;
      }
      const payload = JSON.parse(atob(payloadBase64));
      if (!payload?.exp) {
        return false;
      }
      return Number(payload.exp) < Math.floor(Date.now() / 1000);
    } catch {
      return true;
    }
  }

  private handleSessionExpired(showMessage: boolean = true) {
    if (showMessage) {
      this.showError('Your session has expired. Please log in again, then try uploading your listing.');
    }

    // Clear all auth data to force a clean login
    localStorage.removeItem('authToken');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('id');
    localStorage.removeItem('userID');
    localStorage.removeItem('user_role');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_id');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('email');

    localStorage.setItem('returnUrl', this.router.url);
    this.router.navigate(['/login']);
  }

  // Specification Management Methods
  addSpecification() {
    if (!this.newProduct.specifications) {
      this.newProduct.specifications = [];
    }
    this.newProduct.specifications.push({
      spec_name: '',
      spec_value: ''
    });
  }

  removeSpecification(index: number) {
    if (this.newProduct.specifications && index >= 0 && index < this.newProduct.specifications.length) {
      this.newProduct.specifications.splice(index, 1);
    }
  }

  trackByIndex(index: number, item: any): any {
    return index;
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

  // Get product image URL for display
  getProductImageUrl(imagePath: string): string {
    // Handle base64 images
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    // Handle full URLs
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // Handle relative paths - ensure proper formatting
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    return `${environment.apiUploadsBaseUrl}${cleanPath}`;
  }

  // Handle image loading errors
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      // Set a fallback placeholder image
      img.src = 'https://via.placeholder.com/400x400/e5e7eb/9ca3af?text=Image+Not+Found';
    }
  }
}
