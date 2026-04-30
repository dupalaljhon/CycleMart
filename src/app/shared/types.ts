// Shared type definitions for CycleMart application

export interface Product {
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
  brand_name?: 'giant' | 'trek' | 'specialized' | 'cannondale' | 'merida' | 'scott' | 'bianchi' | 'cervelo' | 'pinarello' | 'shimano' | 'sram' | 'campagnolo' | 'microshift' | 'fsa' | 'vision' | 'zipp' | 'dt swiss' | 'others' | 'no brand';
  custom_brand?: string;
  brand_display?: string;
  status: 'active' | 'archived';
  sale_status: 'available' | 'reserved' | 'sold' | 'traded';
  created_at: string;
  uploader_id: number;
  seller_name?: string;
  seller_email?: string;
  isEditing?: boolean;
}

// SoldProduct extends Product for sold/traded items
export interface SoldProduct extends Product {
  sale_status: 'sold' | 'traded';
}

// NewProduct interface for creating new products
export interface NewProduct {
  product_id?: number;
  product_name: string;
  brand_name: 'giant' | 'trek' | 'specialized' | 'cannondale' | 'merida' | 'scott' | 'bianchi' | 'cervelo' | 'pinarello' | 'shimano' | 'sram' | 'campagnolo' | 'microshift' | 'fsa' | 'vision' | 'zipp' | 'dt swiss' | 'others' | 'no brand';
  custom_brand?: string;
  product_images: string[];
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

// User interface
export interface User {
  id: number;
  username: string;
  email: string;
  profile_image?: string;
  created_at: string;
}

// Conversation interface for messaging
export interface Conversation {
  conversation_id: number;
  product_id: number;
  buyer_id: number;
  seller_id: number;
  created_at: string;
  last_message?: string;
  last_message_time?: string;
}

// Message interface
export interface Message {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  message: string;
  timestamp: string;
  is_read: boolean;
}

// Report interface
export interface Report {
  report_id: number;
  reported_product_id: number;
  reporter_id: number;
  reported_user_id: number;
  report_reason: string;
  report_description: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

// API Response interface
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message: string;
  data?: T;
}