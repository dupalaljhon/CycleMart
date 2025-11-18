import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, HostListener, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../api/api.service';
import { SocketService } from '../services/socket.service';
import { NotificationService } from '../services/notification.service';
import { AccountStatusService } from '../services/account-status.service';
import { RatingModalComponent } from './rating-modal/rating-modal.component';

import { Subscription } from 'rxjs';

interface ChatMessage {
  message_id?: number;
  sender_id: number;
  sender_name?: string;
  sender_avatar?: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  attachments?: Attachment[];
  is_system_message?: boolean;  // Added to identify system messages
  system_message_type?: 'sold' | 'traded';  // Type of system message
}

interface Attachment {
  type: 'image' | 'video';
  path: string;
  url?: string;  // Added for frontend display
  name?: string;
  size?: number;
}

interface Chat {
  conversation_id: number;
  product_id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_avatar: string;
  product_name: string;
  product_images: string;
  price: number;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  messages: ChatMessage[];
  buyer_id?: number;  // Added to track buyer in conversation
  seller_id?: number; // Added to track seller in conversation
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [SidenavComponent, CommonModule, FormsModule, RatingModalComponent],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  
  messages: Chat[] = [];
  selectedChat: Chat | null = null;
  newMessage: string = '';
  isTyping: boolean = false;
  isMobile: boolean = false;
  showChatList: boolean = true;
  showDebugInfo: boolean = false; // Debug mode disabled - receipt issue fixed!
  showChatWindow: boolean = false;
  currentUserId: number = 0;
  currentUserAvatarUrl: string = '';
  currentUserName: string = '';
  isLoading: boolean = true;
  showStatusDropdown: boolean = false;
  showArchivedMessages: boolean = false;
  archivedMessages: Chat[] = [];
  showRatingModal: boolean = false;
  showRatingButton: boolean = false; // Track if rating button should be visible
  
  // User report modal properties
  showUserReportModal: boolean = false;
  isSubmittingReport: boolean = false;
  
  // User Report Form
  userReportForm = {
    report_type: 'user_behavior' as 'user_behavior' | 'post_purchase_concern',
    user_reason_type: '',
    explanation: ''
  };
  
  // Form Options
  userBehaviorReasons = [
    'rude behavior',
    'harassment',
    'threats', 
    'scamming attempt',
    'not cooperative',
    'others'
  ];

  postPurchaseReasons = [
    'refund issue',
    'item not as described',
    'damaged item',
    'post purchase issue', 
    'others'
  ];
  
  // File handling
  selectedProofFiles: File[] = [];
  proofPreviews: { file: File, url: string, type: 'image' | 'video' }[] = [];
  maxProofFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB
  allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/mov'];
  
  // Track product ownership status
  productOwnershipStatus: { [conversationId: number]: boolean } = {};
  
  // Track product sale status per conversation
  productSaleStatus: { [conversationId: number]: string } = {};
  
  // Status confirmation modal properties
  showStatusConfirmationModal: boolean = false;
  pendingStatusChange: 'sold' | 'traded' | 'reserved' | 'available' | null = null;
  
  // Scroll management properties
  private shouldAutoScroll: boolean = false;
  private isNearBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private scrollTimeout: any;
  showScrollToBottomButton: boolean = false;
  
  // Attachment properties
  selectedAttachments: File[] = [];
  attachmentPreviews: { file: File; preview: string; type: 'image' | 'video' }[] = [];
  isDragOver: boolean = false;
  showAttachmentModal: boolean = false;
  selectedAttachment: Attachment | null = null;
  
  private subscriptions: Subscription[] = [];
  // Track recent automated status messages to avoid rendering backend duplicates
  private recentAutoStatusMessageAt: { [conversationId: number]: number } = {};

  constructor(
    private apiService: ApiService,
    private socketService: SocketService,
    private route: ActivatedRoute,
    private notificationService: NotificationService,
    public accountStatusService: AccountStatusService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkDeviceSize();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: any) {
    // Close dropdown when clicking outside
    if (!event.target.closest('.relative')) {
      this.showStatusDropdown = false;
    }
  }

  ngOnInit() {
    // Get current user ID
    this.currentUserId = parseInt(localStorage.getItem('id') || '0');
    this.currentUserName = localStorage.getItem('full_name') || localStorage.getItem('username') || 'You';

    // Attempt to build current user avatar from stored profile image immediately
    const storedProfileImage = localStorage.getItem('profile_image');
    this.currentUserAvatarUrl = this.getAvatarUrl(storedProfileImage || '', this.currentUserName);

    // Fetch latest user data to ensure avatar correctness (handles edits after login)
    if (this.currentUserId) {
      this.apiService.getUser(this.currentUserId).subscribe({
        next: (res) => {
          if (res.status === 'success' && res.data?.length) {
            const user = res.data[0];
            const profileImage = user.profile_image || '';
            this.currentUserAvatarUrl = this.getAvatarUrl(profileImage, user.full_name || this.currentUserName);
            // Keep localStorage in sync for other components
            if (user.full_name) localStorage.setItem('full_name', user.full_name);
            if (profileImage) localStorage.setItem('profile_image', profileImage); else localStorage.setItem('profile_image', '');
          }
        },
        error: () => {
          // Fallback already set, no action needed
        }
      });
    }
    
    this.checkDeviceSize();
    this.initializeSocketConnection();
    
    // Check for query parameters first (when coming from product listing)
    this.route.queryParams.subscribe(params => {
      if (params['conversation_id']) {
        // Force reload conversations when coming from product listing
        console.log('🔗 Direct access to conversation via URL parameter:', params['conversation_id']);
        this.loadConversations().then(() => {
          this.handleDirectConversationAccess(parseInt(params['conversation_id']));
        }).catch(error => {
          console.error('Failed to load conversations for direct access:', error);
          this.handleDirectConversationAccess(parseInt(params['conversation_id']));
        });
      } else {
        // Normal load when accessing messages page directly
        this.loadConversations().catch(error => {
          console.error('Failed to load conversations:', error);
        });
      }
    });
    
    // On mobile, start with chat list view
    if (this.isMobile) {
      this.showChatList = true;
      this.showChatWindow = false;
      this.selectedChat = null;
    }
  }

  ngAfterViewChecked() {
    // Only auto-scroll if explicitly requested and user is not manually scrolling
    if (this.shouldAutoScroll && !this.isUserScrolling) {
      this.performScrollToBottom();
      this.shouldAutoScroll = false;
    }
  }

  ngOnDestroy() {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Clear any pending scroll timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  initializeSocketConnection() {
    let connectionShown = false;
    
    // Add detailed logging
    console.log('🔧 Initializing socket connection...');
    console.log('🆔 Current user ID:', this.currentUserId);
    
    // Subscribe to connection status
    this.subscriptions.push(
      this.socketService.isConnected$.subscribe(isConnected => {
        console.log('🔌 Socket connection status changed:', isConnected);
        if (isConnected) {
          // if (connectionShown) {
          //   this.notificationService.showSuccess('Connected', 'Real-time messaging is now available');
          // }
          console.log('✅ Socket connected, authenticating user...');
          this.authenticateUser();
        } else if (connectionShown) {
          // this.notificationService.showWarning('Connection Lost', 'Real-time messaging is temporarily unavailable');
          console.warn('❌ Socket connection lost');
        }
        connectionShown = true;
      })
    );

    // Connect to socket if not connected - add small delay to ensure server is ready
    setTimeout(() => {
      console.log('🔍 Checking socket connection status...');
      console.log('🔗 Socket connected:', this.socketService.isConnected());
      
      if (!this.socketService.isConnected()) {
        console.log('🔌 Initiating Socket.IO connection...');
        this.socketService.connect();
      } else {
        // If already connected, authenticate immediately
        console.log('✅ Socket already connected, authenticating...');
        this.authenticateUser();
      }
    }, 1000);

    this.setupSocketListeners();
  }

  private authenticateUser() {
    // Authenticate user only when connected
    const authData = {
      userId: this.currentUserId.toString(),
      username: localStorage.getItem('username') || 'User',
      role: 'user'
    };
    
    console.log('🔐 Authenticating user with socket:', authData);
    this.socketService.emit('authenticate', authData);
    
    // Add a small delay to let authentication complete, then confirm
    setTimeout(() => {
      console.log('✅ User should now be authenticated and in room: user_' + this.currentUserId);
    }, 1000);
  }

  private setupSocketListeners() {
    // Listen for real-time messages
    this.subscriptions.push(
      this.socketService.on('new_message').subscribe((messageData: any) => {
        this.handleIncomingMessage(messageData);
      })
    );

    // Listen for message read status updates
    this.subscriptions.push(
      this.socketService.on('messages_read').subscribe((data: any) => {
        this.handleMessagesRead(data);
      })
    );

    // Listen for product status changes
    console.log('🎧 Setting up product status change listener...');
    this.subscriptions.push(
      this.socketService.on('product_status_changed').subscribe((data: any) => {
        console.log('🔔 Product status change event received via socket:', data);
        this.handleProductStatusChange(data);
      })
    );
    console.log('✅ Socket listeners set up complete');
  }

  loadConversations(): Promise<void> {
    this.isLoading = true;
    console.log('🔍 Loading conversations for user ID:', this.currentUserId);
    return new Promise((resolve, reject) => {
      this.apiService.getUserConversations(this.currentUserId).subscribe({
        next: (response) => {
          console.log('📊 Conversations API response:', response);
          if (response.status === 'success') {
            this.messages = response.data.map((conv: any) => ({
              conversation_id: conv.conversation_id,
              product_id: conv.product_id,
              other_user_id: conv.other_user_id,
              other_user_name: conv.other_user_name,
              other_user_avatar: this.getAvatarUrl(conv.other_user_avatar, conv.other_user_name),
              product_name: conv.product_name,
              product_images: conv.product_images,
              price: conv.price,
              last_message: conv.last_message || 'No messages yet',
              last_message_time: this.formatMessageTime(conv.last_message_time),
              unread_count: conv.unread_count || 0,
              messages: [],
              buyer_id: conv.buyer_id,   // Track buyer_id from conversation
              seller_id: conv.seller_id  // Track seller_id from conversation
            }));
            
            console.log('📋 Loaded conversations:', this.messages.map(c => ({
              id: c.conversation_id,
              other_user: c.other_user_name,
              product: c.product_name,
              buyer_id: c.buyer_id,
              seller_id: c.seller_id
            })));
          
            // Auto-select first conversation on desktop
            if (!this.isMobile && this.messages.length > 0) {
              this.selectChat(0);
            }
          }
          this.isLoading = false;
          resolve();
        },
        error: (error) => {
          console.error('Error loading conversations:', error);
          this.isLoading = false;
          reject(error);
        }
      });
    });
  }

  loadMessages(conversationId: number) {
    console.log('�🔵🔵 === LOAD MESSAGES CALLED === 🔵🔵🔵');
    console.log('🆔 Conversation ID:', conversationId);
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    this.apiService.getConversationMessages(conversationId).subscribe({
      next: (response) => {
        console.log('📨📨📨 MESSAGES API RESPONSE 📨📨📨');
        console.log('📊 Response status:', response.status);
        console.log('📊 Response data length:', response.data?.length || 0);
        console.log('📦 Full response:', JSON.stringify(response, null, 2));
        
        if (response.status === 'success' && this.selectedChat) {
          console.log('✅ Response successful, processing messages...');
          
          this.selectedChat.messages = response.data.map((msg: any) => {
            // Check if this is a system message (sender_id = 0)
            const isSystemMessage = msg.sender_id === 0 || msg.sender_id === '0';
            
            // Determine system message type from message text or API data
            let systemMessageType: 'sold' | 'traded' | undefined = undefined;
            if (isSystemMessage) {
              // First check if API provided the type
              if (msg.system_message_type) {
                systemMessageType = msg.system_message_type;
              } else if (msg.message_text.toLowerCase().includes('sold')) {
                systemMessageType = 'sold';
              } else if (msg.message_text.toLowerCase().includes('traded')) {
                systemMessageType = 'traded';
              }
            }
            
            console.log(`� Processing message ${msg.message_id}:`, {
              sender_id: msg.sender_id,
              sender_id_type: typeof msg.sender_id,
              is_system: isSystemMessage,
              type: systemMessageType,
              has_is_system_flag: msg.is_system_message,
              has_type_flag: msg.system_message_type,
              message_preview: msg.message_text?.substring(0, 50)
            });
            
            const mappedMessage = {
              message_id: msg.message_id,
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              sender_avatar: this.getAvatarUrl(msg.sender_avatar, msg.sender_name),
              message_text: msg.message_text,
              created_at: msg.created_at,
              is_read: msg.is_read,
              attachments: msg.attachments || [],
              is_system_message: isSystemMessage,
              system_message_type: systemMessageType
            };
            
            if (isSystemMessage) {
              console.log('🟢🟢🟢 SYSTEM MESSAGE DETECTED 🟢🟢🟢', mappedMessage);
            }
            
            return mappedMessage;
          });
          
          console.log('📊📊� MESSAGE PROCESSING COMPLETE 📊📊📊');
          console.log('📝 Total messages loaded:', this.selectedChat.messages.length);
          
          // Log first few messages for debugging
          if (this.selectedChat.messages.length > 0) {
            console.log('📨 First message:', JSON.stringify(this.selectedChat.messages[0], null, 2));
            console.log('📨 Last message:', JSON.stringify(this.selectedChat.messages[this.selectedChat.messages.length - 1], null, 2));
            
            // Count system messages
            const systemMessages = this.selectedChat.messages.filter(m => m.is_system_message);
            console.log(`� System messages count: ${systemMessages.length}`);
            if (systemMessages.length > 0) {
              console.log('🟢🟢� SYSTEM MESSAGES FOUND 🟢🟢🟢');
              systemMessages.forEach((msg, index) => {
                console.log(`System message ${index + 1}:`, JSON.stringify(msg, null, 2));
              });
            } else {
              console.warn('⚠️⚠️⚠️ NO SYSTEM MESSAGES FOUND! ⚠️⚠️⚠️');
            }
          } else {
            console.warn('⚠️ No messages found in conversation');
          }
          
          // Mark messages as read
          this.markMessagesAsRead(conversationId);
          
          // Trigger auto-scroll for initial message load
          setTimeout(() => {
            this.shouldAutoScroll = true;
          }, 200);
        } else {
          console.log('📨 Failed to load messages - Response status:', response.status);
        }
      },
      error: (error) => {
        console.error('❌ Error loading messages:', error);
      }
    });
  }

  handleIncomingMessage(messageData: any) {
    console.log('📨 Received incoming message via socket:', messageData);
    
    // Run inside Angular zone to ensure change detection
    this.ngZone.run(() => {
      // Skip echo messages to avoid duplicates
      if (messageData.is_echo) {
        console.log('🔄 Skipping echo message');
        return;
      }

      // De-dup: if we just sent an automated sale/trade message as seller and
      // backend also emits a system receipt, suppress the system duplicate
      if (messageData.is_system_message &&
          (messageData.system_message_type === 'sold' || messageData.system_message_type === 'traded') &&
          messageData.conversation_id &&
          this.recentAutoStatusMessageAt[messageData.conversation_id] &&
          (Date.now() - this.recentAutoStatusMessageAt[messageData.conversation_id] < 5000)) {
        console.log('🛑 Suppressing duplicate system receipt (seller already sent message)');
        return;
      }
      
      // Find the conversation
      const conversationIndex = this.messages.findIndex(c => c.conversation_id === messageData.conversation_id);
      if (conversationIndex !== -1) {
        const conversation = this.messages[conversationIndex];
        console.log('✅ Found conversation for incoming message:', conversation.conversation_id);
        
        // Update last message info
        conversation.last_message = messageData.message_text || (messageData.attachments?.length > 0 ? `Sent ${messageData.attachments.length} attachment(s)` : 'New message');
        conversation.last_message_time = 'Just now';
        
        // If sender is not current user, increment unread count
        if (messageData.sender_id !== this.currentUserId) {
          conversation.unread_count++;
          console.log('📬 Incremented unread count for conversation:', conversation.conversation_id);
        }
        
        // If this conversation is currently selected, add message to the chat
        if (this.selectedChat && this.selectedChat.conversation_id === messageData.conversation_id) {
          console.log('💬 Adding message to current chat window');
          const newMessage: ChatMessage = {
            message_id: messageData.message_id,
            sender_id: messageData.sender_id,
            sender_name: messageData.sender_name,
            sender_avatar: this.getAvatarUrl(messageData.sender_avatar, messageData.sender_name),
            message_text: messageData.message_text,
            created_at: messageData.created_at,
            is_read: false,
            attachments: messageData.attachments || [],
            is_system_message: messageData.is_system_message || false,
            system_message_type: messageData.system_message_type
          };
          
          // Create new array reference to trigger change detection
          this.selectedChat.messages = [...this.selectedChat.messages, newMessage];
          
          // Update the selected chat reference to trigger change detection
          this.selectedChat = { ...this.selectedChat };
          
          // Mark as read if conversation is active (skip for system messages)
          if (!messageData.is_system_message && messageData.sender_id !== this.currentUserId) {
            this.markMessagesAsRead(messageData.conversation_id);
          }
          
          // Auto-scroll for system messages or if user is near bottom
          if (messageData.is_system_message || this.isNearBottom || messageData.sender_id === this.currentUserId) {
            setTimeout(() => {
              this.shouldAutoScroll = true;
              this.cdr.detectChanges();
            }, 100);
          }
        } else {
          console.log('📝 Message added to conversation list but not to current chat window');
        }
        
        // Move conversation to top (create new array reference)
        if (conversationIndex > 0) {
          const [movedConversation] = this.messages.splice(conversationIndex, 1);
          this.messages = [movedConversation, ...this.messages];
        } else {
          // Already at top, but trigger change detection
          this.messages = [...this.messages];
        }
        
        // Force change detection
        this.cdr.detectChanges();
      } else {
        console.warn('❌ No conversation found for incoming message:', messageData.conversation_id);
      }
    });
  }

  handleMessagesRead(data: any) {
    // Update message read status in current conversation
    if (this.selectedChat && this.selectedChat.conversation_id === data.conversation_id) {
      this.selectedChat.messages.forEach(msg => {
        if (msg.sender_id === this.currentUserId) {
          msg.is_read = true;
        }
      });
    }
  }

  handleProductStatusChange(data: any) {
    console.log('🔄 Product status change received:', data);
    console.log('🆔 Current user ID:', this.currentUserId, '(type:', typeof this.currentUserId, ')');
    console.log('🎯 Target user ID:', data.other_user_id, '(type:', typeof data.other_user_id, ')');
    console.log('🔍 All conversations:', this.messages.map(c => ({
      id: c.conversation_id,
      other_user: c.other_user_id,
      other_name: c.other_user_name,
      buyer_id: c.buyer_id,
      seller_id: c.seller_id
    })));
    
    // Check if this status change affects the current user and conversation
    if (data.conversation_id && data.status && (data.status === 'sold' || data.status === 'traded')) {
      console.log('✅ Status is sold/traded, checking if this affects current user...');
      
      // Find the conversation that was affected
      const affectedConversation = this.messages.find(conv => conv.conversation_id === data.conversation_id);
      console.log('🔍 Found affected conversation:', affectedConversation);
      
      // Convert IDs to same type for comparison
      const currentUserId = parseInt(this.currentUserId.toString());
      
      // Check if current user is the BUYER in this conversation
      const isBuyer = affectedConversation?.buyer_id === currentUserId;
      
      console.log('🔢 User role check:', {
        current_user_id: currentUserId,
        conversation_buyer_id: affectedConversation?.buyer_id,
        conversation_seller_id: affectedConversation?.seller_id,
        is_buyer: isBuyer,
        is_seller: affectedConversation?.seller_id === currentUserId
      });
      
      // Only show rating button to the BUYER
      if (affectedConversation && isBuyer) {
        console.log('🎯 Current user is the BUYER - checking if already rated...');
        
        // Check if user has already rated this conversation
        const conversationKey = `rated_${data.conversation_id}_${this.currentUserId}`;
        const hasAlreadyRated = localStorage.getItem(conversationKey) === 'true';
        
        if (hasAlreadyRated) {
          console.log('❌ User has already rated this conversation - button will not show');
          this.showRatingButton = false;
          return; // Exit early
        }
        
        console.log('✅ User has NOT rated yet - showing rating button');
        
        // Select this conversation if it's not already selected
        if (!this.selectedChat || this.selectedChat.conversation_id !== data.conversation_id) {
          console.log('📱 Auto-selecting the affected conversation');
          const conversationIndex = this.messages.findIndex(conv => conv.conversation_id === data.conversation_id);
          if (conversationIndex !== -1) {
            this.selectChat(conversationIndex);
          }
        }
        
        // Show rating button ONLY for the buyer who hasn't rated yet
        this.showRatingButton = true;
        console.log('⭐ Rating button is now visible for the BUYER in completed transaction');
        
        // Automatically open rating modal after a short delay
        setTimeout(() => {
          console.log('⏰ Checking if buyer has already rated...');
          // Check if user hasn't already rated this transaction
          this.checkIfAlreadyRated(data.conversation_id).then((alreadyRated) => {
            console.log('📊 Already rated result:', alreadyRated);
            if (!alreadyRated) {
              console.log('🌟 Automatically opening rating modal for buyer');
              // Automatically show the rating modal
              this.showRatingModal = true;
            } else {
              console.log('⚠️ Buyer has already rated this transaction');
            }
          }).catch((error) => {
            console.error('❌ Error checking rating status:', error);
            // If there's an error checking, still show the modal
            this.showRatingModal = true;
          });
        }, 1000); // Short delay to let conversation selection complete
        
      } else if (affectedConversation) {
        console.log('❌ Current user is the SELLER - rating button hidden');
        console.log('💡 Only buyers can rate the seller after a transaction');
        this.showRatingButton = false;
      } else {
        console.log('❌ Affected conversation not found');
      }
    } else {
      console.log('❌ Status change conditions not met');
      console.log('   - Has conversation_id:', !!data.conversation_id);
      console.log('   - Has status:', !!data.status);
      console.log('   - Status is sold/traded:', data.status === 'sold' || data.status === 'traded');
    }
  }

  moveConversationToTop(conversation: Chat) {
    const index = this.messages.indexOf(conversation);
    if (index > 0) {
      this.messages.splice(index, 1);
      this.messages.unshift(conversation);
    }
  }

  checkDeviceSize() {
    this.isMobile = window.innerWidth < 768; // md breakpoint
    
    // Adjust view for mobile
    if (this.isMobile) {
      if (this.selectedChat && this.showChatWindow) {
        this.showChatList = false;
      } else {
        this.showChatList = true;
        this.showChatWindow = false;
      }
    } else {
      // Desktop view - show both
      this.showChatList = true;
      this.showChatWindow = true;
    }
  }

  selectChat(index: number) {
    this.selectedChat = this.messages[index];
    
    // Mark messages as read when chat is selected
    this.messages[index].unread_count = 0;
    
    // Load messages for this conversation
    this.loadMessages(this.selectedChat.conversation_id);
    
    // Reset rating button visibility
    this.showRatingButton = false;
    
    // Reset scroll state for new conversation
    this.isUserScrolling = false;
    this.shouldAutoScroll = false;
    this.isNearBottom = true;
    this.showScrollToBottomButton = false;
    
    // Enable auto-scroll after a delay to allow messages to load
    setTimeout(() => {
      this.shouldAutoScroll = true;
    }, 300);
    
    // On mobile, switch to chat view
    if (this.isMobile) {
      this.showChatList = false;
      this.showChatWindow = true;
    }

    // Check if this conversation has a sold/traded item and prompt for rating
    this.checkForRatingOpportunity();
    
    // Check product ownership for seller-only features
    console.log('🔄 selectChat: Checking product ownership for conversation:', this.selectedChat.conversation_id);
    this.checkProductOwnership();
    
    // Log current ownership status for debugging
    setTimeout(() => {
      console.log('🔍 selectChat: Current ownership status:', {
        conversation_id: this.selectedChat?.conversation_id,
        product_id: this.selectedChat?.product_id,
        cached_status: this.productOwnershipStatus[this.selectedChat?.conversation_id || 0],
        current_user: this.currentUserId,
        isProductOwner_result: this.isProductOwner()
      });
    }, 1000);
  }

  backToChatList() {
    if (this.isMobile) {
      this.showChatList = true;
      this.showChatWindow = false;
      this.selectedChat = null;
    }
  }

  deleteChat(index: number) {
    const chatToDelete = this.messages[index];
    if (!chatToDelete) return;
    
    console.log('🗑️ Deleting chat:', chatToDelete.other_user_name);
    
    const deleteData = {
      conversation_id: chatToDelete.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.deleteConversation(deleteData).subscribe({
      next: (response) => {
        console.log('✅ Delete response:', response);
        if (response.status === 'success') {
          // Remove chat from the list
          this.messages.splice(index, 1);
          
          if (this.selectedChat === chatToDelete || this.messages.length === 0) {
            this.selectedChat = this.messages[0] || null;
            
            // On mobile, go back to chat list if no chats left
            if (this.isMobile && !this.selectedChat) {
              this.showChatList = true;
              this.showChatWindow = false;
            }
          }
          
          const message = response.data?.permanently_deleted 
            ? `Conversation with ${chatToDelete.other_user_name} has been permanently deleted`
            : `Conversation with ${chatToDelete.other_user_name} has been deleted`;
            
          this.notificationService.showSuccess(
            'Chat Deleted',
            message
          );
        } else {
          console.error('❌ Failed to delete chat:', response.message);
          this.notificationService.showError(
            'Delete Failed',
            response.message || 'Failed to delete conversation'
          );
        }
      },
      error: (error) => {
        console.error('❌ Error deleting chat:', error);
        this.notificationService.showError(
          'Delete Failed',
          'An error occurred while deleting the conversation'
        );
      }
    });
  }

  sendMessage() {
    // Validate inputs - require either message text or attachments
    if (!this.newMessage.trim() && this.attachmentPreviews.length === 0) {
      this.notificationService.showWarning('Empty Message', 'Please enter a message or add attachments before sending');
      return;
    }

    if (!this.selectedChat) {
      this.notificationService.showError('No Chat Selected', 'Please select a conversation first');
      return;
    }

    // Check message length (optional validation)
    if (this.newMessage.trim().length > 1000) {
      this.notificationService.showWarning('Message Too Long', 'Please keep messages under 1000 characters');
      return;
    }

    // Prepare attachments data
    const attachments: any[] = [];
    
    // Convert file previews to base64 data
    const filePromises = this.attachmentPreviews.map(preview => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          attachments.push({
            file: result,
            name: preview.file.name,
            type: preview.file.type,
            size: preview.file.size
          });
          resolve(result);
        };
        reader.readAsDataURL(preview.file);
      });
    });

    // Wait for all files to be processed
    Promise.all(filePromises).then(() => {
      const messageData = {
        conversation_id: this.selectedChat!.conversation_id,
        sender_id: this.currentUserId,
        message_text: this.newMessage.trim(),
        attachments: attachments
      };

      // Show sending indicator
      const originalMessage = this.newMessage;
      const originalAttachments = [...this.attachmentPreviews];
      this.newMessage = '';
      this.attachmentPreviews = [];

      this.apiService.sendMessage(messageData).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            // Run inside Angular zone for proper change detection
            this.ngZone.run(() => {
              // Add message to local chat
              const newMessage: ChatMessage = {
                message_id: response.data.message_id,
                sender_id: this.currentUserId,
                sender_name: this.currentUserName,
                sender_avatar: this.currentUserAvatarUrl,
                message_text: originalMessage,
                attachments: response.data.attachments || [],
                created_at: response.data.created_at,
                is_read: false
              };

              // Create new array reference to trigger change detection
              if (this.selectedChat) {
                this.selectedChat.messages = [...this.selectedChat.messages, newMessage];

                // Update conversation info
                const lastMessageText = originalMessage || (response.data.attachments?.length > 0 ? `Sent ${response.data.attachments.length} attachment(s)` : 'Message');
                this.selectedChat.last_message = lastMessageText;
                this.selectedChat.last_message_time = 'Just now';
                
                // Move conversation to top with new array reference
                const conversationIndex = this.messages.findIndex(c => c.conversation_id === this.selectedChat!.conversation_id);
                if (conversationIndex !== -1 && conversationIndex > 0) {
                  const [movedConversation] = this.messages.splice(conversationIndex, 1);
                  this.messages = [movedConversation, ...this.messages];
                } else if (conversationIndex !== -1) {
                  // Update the conversation in place with new reference
                  this.messages = [...this.messages];
                }
                
                // Update selected chat reference
                this.selectedChat = { ...this.selectedChat };
              }

              // Emit socket event for real-time messaging
              console.log('📡 Checking socket connection for real-time messaging...');
              console.log('🔗 Socket connected:', this.socketService.isConnected());
              
              if (this.socketService.isConnected()) {
                const messageToEmit = {
                  ...response.data,
                  conversation_id: this.selectedChat!.conversation_id,
                  recipient_id: this.selectedChat!.other_user_id,
                  message_text: originalMessage,
                  sender_id: this.currentUserId,
                  sender_name: this.currentUserName,
                  sender_avatar: localStorage.getItem('profile_image') || ''
                };
                
                console.log('📤 Emitting socket message:', messageToEmit);
                
                const socketEmitted = this.socketService.emit('send_message', messageToEmit);

                // Log for debugging but don't show notifications
                if (!socketEmitted) {
                  console.warn('❌ Socket emit failed - message sent via API but real-time delivery may be delayed');
                } else {
                  console.log('✅ Socket message emitted successfully');
                }
              } else {
                console.warn('❌ Socket not connected - message sent via API but real-time features unavailable');
                console.log('🔄 Attempting to reconnect socket...');
                this.socketService.connect();
              }

              // Scroll to bottom to show new message (always scroll for own messages)
              setTimeout(() => {
                this.shouldAutoScroll = true;
                this.cdr.detectChanges();
              }, 100);
            });

          } else {
            // Handle API error response
            this.newMessage = originalMessage; // Restore message on failure
            this.attachmentPreviews = originalAttachments; // Restore attachments on failure
            this.notificationService.showError(
              'Send Failed', 
              response.message || 'Failed to send message. Please try again.'
            );
          }
        },
        error: (error) => {
          console.error('Error sending message:', error);
          this.newMessage = originalMessage; // Restore message on failure
          this.attachmentPreviews = originalAttachments; // Restore attachments on failure
          
          // Show user-friendly error message
          if (error.status === 0) {
            this.notificationService.showError(
              'Connection Error',
              'Please check your internet connection and try again'
            );
          } else if (error.status === 401) {
            this.notificationService.showError(
              'Authentication Error',
              'Please log in again to continue messaging'
            );
          } else if (error.status === 403) {
            this.notificationService.showError(
              'Permission Denied',
              'You do not have permission to send messages in this conversation'
            );
          } else {
            this.notificationService.showError(
              'Send Failed',
              'Unable to send message. Please try again later.'
            );
          }
        }
      });
    });
  }

  markMessagesAsRead(conversationId: number) {
    this.apiService.markMessagesAsRead({
      conversation_id: conversationId,
      user_id: this.currentUserId
    }).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          // Emit socket event to notify sender that messages were read
          const conversation = this.messages.find(c => c.conversation_id === conversationId);
          if (conversation) {
            this.socketService.emit('messages_read', {
              conversation_id: conversationId,
              reader_id: this.currentUserId,
              other_user_id: conversation.other_user_id
            });
          }
        }
      },
      error: (error) => {
        console.error('Error marking messages as read:', error);
      }
    });
  }

  /**
   * Send system confirmation message when product is marked as sold/traded
   */
  sendSystemConfirmationMessage(chat: Chat, status: 'sold' | 'traded') {
    // Fetch product details first to enrich the automated message
    if (!chat) return;

    this.apiService.getProductById(chat.product_id).subscribe({
      next: (prodRes) => {
        const product = prodRes?.data?.[0] || {};
        const productName = chat.product_name || product.product_name || 'This product';
        const price = (product.price ?? chat.price ?? 0).toFixed(2);
        const location = product.location || product.product_location || 'N/A';
        const condition = product.item_condition || product.condition || 'Second hand';
        const type = product.for_type ? (product.for_type.charAt(0).toUpperCase() + product.for_type.slice(1)) : (status === 'traded' ? 'Trade' : 'Sale');
        const verb = status === 'sold' ? 'sold' : 'traded';

        const systemMessageText = `This ${productName} ${verb} to you\n\n` +
          `📦 Product Details:\n` +
          `💰 Price: ${price}\n` +
          `📍 Location: ${location}\n` +
          `🔧 Condition: ${condition}\n` +
          `📝 Type: ${type}`;

        const messageData = {
          conversation_id: chat.conversation_id,
          // Send as the seller (current user), not system
          sender_id: this.currentUserId,
          message_text: systemMessageText,
          attachments: []
        };

        this.apiService.sendMessage(messageData).subscribe({
          next: (response) => {
            if (response.status === 'success') {
              // Mark recent automated message timestamp for de-dup
              this.recentAutoStatusMessageAt[chat.conversation_id] = Date.now();
              const systemMessage: ChatMessage = {
                message_id: response.data.message_id,
                sender_id: this.currentUserId,
                sender_name: this.currentUserName,
                sender_avatar: this.currentUserAvatarUrl,
                message_text: systemMessageText,
                created_at: response.data.created_at,
                is_read: false,
                attachments: [],
                is_system_message: false,
                system_message_type: undefined
              };

              if (this.selectedChat && this.selectedChat.conversation_id === chat.conversation_id) {
                this.selectedChat.messages = [...this.selectedChat.messages, systemMessage];
                this.selectedChat = { ...this.selectedChat };
                setTimeout(() => { this.shouldAutoScroll = true; }, 100);
              }

              if (this.socketService.isConnected()) {
                this.socketService.emit('send_message', {
                  ...response.data,
                  recipient_id: chat.other_user_id,
                  message_text: systemMessageText,
                  sender_id: this.currentUserId,
                  sender_name: this.currentUserName,
                  sender_avatar: localStorage.getItem('profile_image') || '',
                  is_system_message: false
                });
              }
            }
          },
          error: () => {}
        });
      },
      error: () => {
        // Fallback: send minimal message if product fetch fails
        const verb = status === 'sold' ? 'sold' : 'traded';
        const systemMessageText = `This ${chat.product_name} ${verb} to you\n\n📦 Product Details:\n💰 Price: ${(chat.price || 0).toFixed(2)}\n📍 Location: N/A\n🔧 Condition: Second hand\n📝 Type: ${verb === 'sold' ? 'Sale' : 'Trade'}`;
        const messageData = {
          conversation_id: chat.conversation_id,
          sender_id: this.currentUserId,
          message_text: systemMessageText,
          attachments: []
        };
        this.apiService.sendMessage(messageData).subscribe({
          next: () => {},
          error: () => {}
        });
      }
    });
  }

  onInputFocus() {
    this.isTyping = true;
  }

  onInputBlur() {
    this.isTyping = false;
  }

  /**
   * Handle keyboard events for message input
   */
  onMessageKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        // Shift + Enter = new line (default behavior)
        return;
      } else {
        // Enter = send message
        event.preventDefault();
        this.sendMessage();
      }
    }
  }

  /**
   * Handle input events for typing indicator
   */
  onMessageInput() {
    // Optional: Send typing indicator to other user
    if (this.socketService.isConnected() && this.selectedChat) {
      this.socketService.emit('typing', {
        conversation_id: this.selectedChat.conversation_id,
        user_id: this.currentUserId,
        typing: true
      });
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        setTimeout(() => {
          const element = this.chatContainer.nativeElement;
          element.scrollTop = element.scrollHeight;
          this.isNearBottom = true;
          this.showScrollToBottomButton = false;
        }, 100);
      }
    } catch(err) {}
  }

  /**
   * Perform scroll to bottom without user interaction flags
   */
  private performScrollToBottom(): void {
    try {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
        this.isNearBottom = true;
        this.showScrollToBottomButton = false;
      }
    } catch(err) {}
  }

  /**
   * Check if user is near the bottom of the chat
   */
  onChatScroll(event: any): void {
    // Clear any existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Mark that user is actively scrolling - disable auto-scroll immediately
    this.isUserScrolling = true;
    this.shouldAutoScroll = false;

    // Set timeout to detect when user stops scrolling
    this.scrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 150);

    const element = event.target;
    const threshold = 50; // pixels from bottom
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
    
    this.isNearBottom = isAtBottom;
    this.showScrollToBottomButton = !isAtBottom && element.scrollHeight > element.clientHeight;
    
    console.log('📜 Scroll event:', {
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      isAtBottom: isAtBottom,
      showButton: this.showScrollToBottomButton,
      userScrolling: this.isUserScrolling
    });
  }

  /**
   * Manually scroll to bottom when button is clicked
   */
  scrollToBottomManually(): void {
    this.isUserScrolling = false;
    this.shouldAutoScroll = false; // Don't enable auto-scroll immediately
    this.isNearBottom = true;
    this.showScrollToBottomButton = false;
    
    if (this.chatContainer) {
      const element = this.chatContainer.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
      
      // After smooth scroll completes, check if we're actually at bottom
      setTimeout(() => {
        const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 10;
        this.isNearBottom = isAtBottom;
        console.log('📍 Manual scroll completed, at bottom:', isAtBottom);
      }, 500);
    }
  }

  /**
   * Debug scroll state
   */
  debugScrollState(): void {
    if (this.chatContainer) {
      const element = this.chatContainer.nativeElement;
      console.log('🐛 SCROLL DEBUG:', {
        shouldAutoScroll: this.shouldAutoScroll,
        isUserScrolling: this.isUserScrolling,
        isNearBottom: this.isNearBottom,
        showScrollButton: this.showScrollToBottomButton,
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        distanceFromBottom: element.scrollHeight - (element.scrollTop + element.clientHeight)
      });
    }
  }

  getAvatarUrl(profileImage: string | null, name: string): string {
    if (profileImage && profileImage.trim() !== '') {
      // If it's a full URL, return as-is
      if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
        return profileImage;
      }
      // For profile images stored under uploads/, serve from images subdomain
      const stripped = profileImage.replace(/^\/?uploads[\/]/, '');
      return `http://images.cyclemart.shop/${stripped}`;
    }
    
    // Generate avatar using UI Avatars
    const colors = ['6BA3BE', '34D399', 'F59E0B', '8B5CF6', 'EF4444', '10B981'];
    const color = colors[name.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff`;
  }

  getProductImageUrl(productImages: string): string {
    if (!productImages) {
      return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
    }
    
    try {
      // Parse the JSON string to get the array of images
      const imagesArray = JSON.parse(productImages);
      if (Array.isArray(imagesArray) && imagesArray.length > 0) {
        // Get the first image
        const firstImage = imagesArray[0];
        // Remove any extra path prefixes from the image name
        const cleanImageName = firstImage.replace(/^uploads[\/\\]/, '');
        return `http://api.cyclemart.shop/CycleMart-api/api/uploads/${cleanImageName}`;
      }
    } catch (e) {
      console.warn('Failed to parse product images:', productImages);
    }
    
    return 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';
  }

  formatMessageText(messageText: string): string {
    if (!messageText) return '';
    
    // Handle line breaks and preserve formatting
    let formatted = messageText
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic text
    
    // Enhance product information sections
    if (formatted.includes('📦 Product Information:')) {
      formatted = formatted.replace(
        /(📦 Product Information:.*?)(?=\n\n|$)/s,
        '<div class="bg-blue-50 border-l-4 border-blue-400 p-3 my-2 rounded-r-lg">$1</div>'
      );
    }
    
    return formatted;
  }

  formatMessageTime(timestamp: string): string {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour(s) ago`;
    
    return messageDate.toLocaleDateString();
  }

  formatChatTime(timestamp: string): string {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Generate a transaction ID for receipt display
  generateTransactionId(messageId?: number): string {
    const timestamp = Date.now() % 10000;
    return `TXN${messageId || timestamp}`;
  }

  getTotalUnreadCount(): number {
    return this.messages.reduce((total, chat) => total + chat.unread_count, 0);
  }

  isMyMessage(senderId: number): boolean {
    return senderId === this.currentUserId;
  }

  /**
   * Debug method to log messages in template
   */
  logMessage(msg: any, index: number): string {
    console.log(`🎨 TEMPLATE RENDERING MESSAGE ${index}:`, {
      message_id: msg.message_id,
      sender_id: msg.sender_id,
      is_system_message: msg.is_system_message,
      system_message_type: msg.system_message_type,
      has_text: !!msg.message_text,
      text_preview: msg.message_text?.substring(0, 50)
    });
    
    if (msg.is_system_message) {
      console.log(`🟢🟢🟢 RENDERING SYSTEM MESSAGE ${index} �🟢�`);
    }
    
    return '';
  }

  /**
   * Toggle the status dropdown menu
   */
  toggleStatusDropdown() {
    this.showStatusDropdown = !this.showStatusDropdown;
  }

  /**
   * Mark product with specific status
   */
  markProductStatus(newStatus: 'sold' | 'traded' | 'reserved' | 'available') {
    if (!this.selectedChat) return;
    
    // Show confirmation modal instead of alert
    this.pendingStatusChange = newStatus;
    this.showStatusConfirmationModal = true;
    this.showStatusDropdown = false; // Close the dropdown
  }

  /**
   * Confirm the status change from modal
   */
  confirmStatusChange() {
    console.log('🔷🔷🔷 === CONFIRM STATUS CHANGE STARTED === 🔷🔷🔷');
    
    if (!this.selectedChat || !this.pendingStatusChange) {
      console.error('❌ No selected chat or pending status:', {
        hasSelectedChat: !!this.selectedChat,
        pendingStatus: this.pendingStatusChange
      });
      return;
    }
    
    const selectedChat = this.selectedChat; // Store reference for type safety
    const newStatus = this.pendingStatusChange;
    
    console.log('📋 Status change details:', {
      conversationId: selectedChat.conversation_id,
      productId: selectedChat.product_id,
      productName: selectedChat.product_name,
      newStatus: newStatus,
      buyerId: selectedChat.buyer_id,
      sellerId: selectedChat.seller_id,
      otherUserId: selectedChat.other_user_id,
      otherUserName: selectedChat.other_user_name,
      currentUserId: this.currentUserId
    });
    
    // Close modal
    this.showStatusConfirmationModal = false;
    this.pendingStatusChange = null;

    const updateData = {
        product_id: selectedChat.product_id,
        sale_status: newStatus,
        uploader_id: this.currentUserId,
        for_type: 'sale' // Default for_type since it's required
      };

      console.log('📤 Sending status update to API:', updateData);

      this.apiService.updateSaleStatus(updateData).subscribe({
        next: (response) => {
          console.log('📥 Status update API response:', response);
          
          if (response.status === 'success') {
            let successText = '';
            switch (newStatus) {
              case 'sold':
                successText = `${selectedChat.product_name} has been marked as sold!`;
                break;
              case 'traded':
                successText = `${selectedChat.product_name} has been marked as traded!`;
                break;
              case 'reserved':
                successText = `${selectedChat.product_name} has been reserved!`;
                break;
              case 'available':
                successText = `${selectedChat.product_name} is now available again!`;
                break;
            }
            
            this.notificationService.showSuccess('Status Updated', successText);
            this.showStatusDropdown = false;
            
            // Update the cached sale status immediately
            const conversationId = selectedChat.conversation_id;
            this.productSaleStatus[conversationId] = newStatus;
            
            // Log the status change
            console.log('Product status updated:', {
              product_id: selectedChat.product_id,
              product_name: selectedChat.product_name,
              new_status: newStatus,
              timestamp: new Date().toISOString(),
              user_id: this.currentUserId,
              dropdown_will_be: (newStatus === 'sold' || newStatus === 'traded') ? 'HIDDEN' : 'VISIBLE'
            });

            // Show rating modal to the other party when item is marked as sold or traded
            // The person who marks the status is typically the seller
            // The other person in the conversation (buyer) should get the rating opportunity
            if ((newStatus === 'sold' || newStatus === 'traded') && this.selectedChat) {
                // Send automated sale/trade message to buyer
                this.sendSystemConfirmationMessage(selectedChat, newStatus);
              console.log('🟢🟢🟢 CONDITION MET: Status is sold/traded 🟢🟢🟢');
              console.log('🚀 Status marked by seller:', this.currentUserId, 'Buyer (other party):', selectedChat.other_user_id);
              console.log('📊 Conditions check:', {
                isSold: newStatus === 'sold',
                isTraded: newStatus === 'traded',
                hasSelectedChat: !!this.selectedChat,
                selectedChatId: this.selectedChat?.conversation_id
              });
              
              this.notificationService.showInfo(
                'Transaction Complete',
                `The buyer will be notified and can now rate their experience.`
              );
              
              // We already sent an automated message as the seller; avoid reloading to prevent duplicates
              
              // Emit real-time notification to the other party (buyer) via socket
              if (this.socketService.isConnected()) {
                const statusChangeData = {
                  conversation_id: selectedChat.conversation_id,
                  product_id: selectedChat.product_id,
                  product_name: selectedChat.product_name,
                  status: newStatus,
                  changed_by: this.currentUserId,
                  other_user_id: selectedChat.other_user_id,
                  timestamp: new Date().toISOString()
                };
                
                console.log('📡 Emitting product status changed via socket to buyer:', statusChangeData);
                // Align event name with listener 'product_status_changed'
                this.socketService.emit('product_status_changed', statusChangeData);
                
                // Add confirmation that emit was called
                console.log('✅ Socket emit called successfully - buyer will receive notification');
              } else {
                console.warn('⚠️ Socket not connected, cannot send real-time notification');
                console.log('🔄 Attempting to reconnect socket...');
                // Try to reconnect socket
                this.socketService.connect();
              }
              
              // Rating button visibility is now handled by buyer check in checkProductStatus()
              // Don't show rating button to seller - only buyers can rate sellers
              console.log('💡 Rating button will only be visible to the BUYER, not the seller');
            }
          } else {
            this.notificationService.showError(
              'Update Failed',
              response.message || 'Failed to update product status. Please try again.'
            );
          }
        },
        error: (error) => {
          console.error('Error updating product status:', error);
          this.notificationService.showError(
            'Update Failed',
            'Failed to update product status. Please check your connection and try again.'
          );
        }
      });
  }

  /**
   * Cancel the status change from modal
   */
  cancelStatusChange() {
    this.showStatusConfirmationModal = false;
    this.pendingStatusChange = null;
  }

  /**
   * Get status text for modal display
   */
  getStatusActionText(): string {
    if (!this.pendingStatusChange) return '';
    
    switch (this.pendingStatusChange) {
      case 'sold':
        return 'Mark this product as sold';
      case 'traded':
        return 'Mark this product as traded';
      case 'reserved':
        return 'Reserve this item';
      case 'available':
        return 'Mark this product as available again';
      default:
        return 'Update product status';
    }
  }

  /**
   * Mark the product as sold (legacy method - now calls markProductStatus)
   */
  markAsSold() {
    this.markProductStatus('sold');
  }

  /**
   * Mark the product as traded (legacy method - now calls markProductStatus)
   */
  markAsTraded() {
    this.markProductStatus('traded');
  }

  /**
   * Archive a specific chat conversation
   */
  archiveChat(index: number) {
    const chatToArchive = this.messages[index];
    if (!chatToArchive) return;
    
    console.log('📦 Archiving chat:', chatToArchive.other_user_name);
    
    const archiveData = {
      conversation_id: chatToArchive.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.archiveConversation(archiveData).subscribe({
      next: (response) => {
        console.log('✅ Archive response:', response);
        if (response.status === 'success') {
          // Move chat to archived messages
          this.archivedMessages.push(chatToArchive);
          this.messages.splice(index, 1);
          
          // If this was the selected chat, clear selection or select next available
          if (this.selectedChat === chatToArchive) {
            if (this.messages.length > 0) {
              this.selectChat(Math.min(index, this.messages.length - 1));
            } else {
              this.selectedChat = null;
              if (this.isMobile) {
                this.showChatList = true;
                this.showChatWindow = false;
              }
            }
          }
          
          this.notificationService.showSuccess(
            'Chat Archived',
            `Conversation with ${chatToArchive.other_user_name} has been archived`
          );
        } else {
          console.error('❌ Failed to archive chat:', response.message);
          this.notificationService.showError(
            'Archive Failed',
            response.message || 'Failed to archive conversation'
          );
        }
      },
      error: (error) => {
        console.error('❌ Error archiving chat:', error);
        this.notificationService.showError(
          'Archive Failed',
          'An error occurred while archiving the conversation'
        );
      }
    });
  }

  /**
   * Toggle between showing active and archived messages
   */
  toggleArchivedMessages() {
    this.showArchivedMessages = !this.showArchivedMessages;
    
    if (this.showArchivedMessages) {
      // Load and show archived messages
      console.log('📦 Loading archived messages');
      this.loadArchivedConversations().then(() => {
        this.notificationService.showInfo(
          'Archived Messages',
          `Showing ${this.archivedMessages.length} archived conversations`
        );
      }).catch(error => {
        console.error('❌ Failed to load archived messages:', error);
        this.notificationService.showError(
          'Load Failed',
          'Failed to load archived conversations'
        );
      });
    } else {
      // Show active messages
      console.log('📨 Showing active messages');
      this.notificationService.showInfo(
        'Active Messages',
        `Showing ${this.messages.length} active conversations`
      );
    }
  }

  /**
   * Load archived conversations from API
   */
  loadArchivedConversations(): Promise<void> {
    this.isLoading = true;
    console.log('🔍 Loading archived conversations for user ID:', this.currentUserId);
    return new Promise((resolve, reject) => {
      this.apiService.getUserArchivedConversations(this.currentUserId).subscribe({
        next: (response) => {
          console.log('📦 Archived conversations API response:', response);
          if (response.status === 'success') {
            this.archivedMessages = response.data.map((conv: any) => ({
              conversation_id: conv.conversation_id,
              product_id: conv.product_id,
              other_user_id: conv.other_user_id,
              other_user_name: conv.other_user_name,
              other_user_avatar: this.getAvatarUrl(conv.other_user_avatar, conv.other_user_name),
              product_name: conv.product_name,
              product_images: conv.product_images,
              price: conv.price,
              last_message: conv.last_message || 'No messages yet',
              last_message_time: this.formatMessageTime(conv.last_message_time),
              unread_count: conv.unread_count || 0,
              messages: [],
              buyer_id: conv.buyer_id,   // Track buyer_id from conversation
              seller_id: conv.seller_id  // Track seller_id from conversation
            }));
            
            console.log('📋 Loaded archived conversations:', this.archivedMessages.map(c => ({
              id: c.conversation_id,
              other_user: c.other_user_name,
              product: c.product_name,
              buyer_id: c.buyer_id,
              seller_id: c.seller_id
            })));
          } else {
            this.archivedMessages = [];
          }
          this.isLoading = false;
          resolve();
        },
        error: (error) => {
          console.error('❌ Error loading archived conversations:', error);
          this.archivedMessages = [];
          this.isLoading = false;
          reject(error);
        }
      });
    });
  }

  /**
   * Restore an archived chat conversation
   */
  restoreChat(index: number) {
    const chatToRestore = this.archivedMessages[index];
    if (!chatToRestore) return;
    
    console.log('🔄 Restoring chat:', chatToRestore.other_user_name);
    
    const restoreData = {
      conversation_id: chatToRestore.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.restoreConversation(restoreData).subscribe({
      next: (response) => {
        console.log('✅ Restore response:', response);
        if (response.status === 'success') {
          // Move chat back to active messages
          this.messages.unshift(chatToRestore); // Add to beginning of active messages
          this.archivedMessages.splice(index, 1);
          
          this.notificationService.showSuccess(
            'Chat Restored',
            `Conversation with ${chatToRestore.other_user_name} has been restored`
          );
        } else {
          console.error('❌ Failed to restore chat:', response.message);
          this.notificationService.showError(
            'Restore Failed',
            response.message || 'Failed to restore conversation'
          );
        }
      },
      error: (error) => {
        console.error('❌ Error restoring chat:', error);
        this.notificationService.showError(
          'Restore Failed',
          'An error occurred while restoring the conversation'
        );
      }
    });
  }

  /**
   * Delete an archived chat conversation permanently
   */
  deleteArchivedChat(index: number) {
    const chatToDelete = this.archivedMessages[index];
    if (!chatToDelete) return;
    
    console.log('🗑️ Permanently deleting archived chat:', chatToDelete.other_user_name);
    
    const deleteData = {
      conversation_id: chatToDelete.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.deleteConversation(deleteData).subscribe({
      next: (response) => {
        console.log('✅ Delete archived response:', response);
        if (response.status === 'success') {
          // Remove chat from archived list
          this.archivedMessages.splice(index, 1);
          
          const message = response.data?.permanently_deleted 
            ? `Conversation with ${chatToDelete.other_user_name} has been permanently deleted`
            : `Conversation with ${chatToDelete.other_user_name} has been deleted`;
            
          this.notificationService.showSuccess(
            'Chat Deleted',
            message
          );
        } else {
          console.error('❌ Failed to delete archived chat:', response.message);
          this.notificationService.showError(
            'Delete Failed',
            response.message || 'Failed to delete conversation'
          );
        }
      },
      error: (error) => {
        console.error('❌ Error deleting archived chat:', error);
        this.notificationService.showError(
          'Delete Failed',
          'An error occurred while deleting the conversation'
        );
      }
    });
  }

  /**
   * Open rating modal directly - simple one-click experience
   */
  openRatingModalDirectly() {
    if (!this.selectedChat) {
      console.log('❌ No chat selected for rating');
      return;
    }
    
    console.log('⭐ Opening rating modal directly for conversation:', this.selectedChat.conversation_id);
    console.log('👤 Rating user:', this.selectedChat.other_user_name);
    
    // Open modal immediately without checks
    this.showRatingModal = true;
    console.log('✅ Rating modal opened directly');
  }

  /**
   * Open rating modal (original method with checks)
   */
  openRatingModal() {
    if (!this.selectedChat) {
      console.log('❌ No chat selected for rating');
      return;
    }
    
    console.log('⭐ Opening rating modal for conversation:', this.selectedChat.conversation_id);
    console.log('👤 Rating user:', this.selectedChat.other_user_name);
    
    // Check if user has already rated before opening modal
    this.checkIfAlreadyRated(this.selectedChat.conversation_id).then((alreadyRated) => {
      if (alreadyRated) {
        console.log('⚠️ User has already rated this transaction');
        this.showRatingButton = false; // Hide the button since already rated
      } else {
        this.showRatingModal = true;
        console.log('✅ Rating modal opened successfully');
      }
    }).catch((error) => {
      console.error('Error checking rating status:', error);
      // If there's an error checking, allow the modal to open
      this.showRatingModal = true;
    });
  }

  /**
   * Close rating modal
   */
  closeRatingModal() {
    this.showRatingModal = false;
    // Keep the rating button visible so user can rate later
    // The button will only be hidden after successful rating submission
    console.log('⭐ Rating modal closed - star button remains visible for later rating');
  }

  /**
   * Get rated user information for the modal
   */
  getRatedUserInfo(): { id: number; full_name: string; profile_image?: string | null } | null {
    if (!this.selectedChat) return null;
    
    return {
      id: this.selectedChat.other_user_id,
      full_name: this.selectedChat.other_user_name,
      profile_image: this.selectedChat.other_user_avatar
    };
  }

  /**
   * Handle rating submission
   */
  onRatingSubmitted(ratingData: any) {
    console.log('⭐ Rating submitted successfully:', ratingData);
    
    // Hide the rating button after rating is submitted
    this.showRatingButton = false;
    
    // Close the modal
    this.showRatingModal = false;
    
    // Store that this conversation has been rated to prevent button from showing again
    if (this.selectedChat) {
      const conversationKey = `rated_${this.selectedChat.conversation_id}_${this.currentUserId}`;
      localStorage.setItem(conversationKey, 'true');
      console.log('💾 Stored rating completion flag:', conversationKey);
    }
    
    console.log('✅ Rating process completed - button hidden permanently');
  }

  /**
   * Handle direct access to a specific conversation (from product listing)
   */
  handleDirectConversationAccess(conversationId: number) {
    let attempts = 0;
    const maxAttempts = 30; // Wait up to 3 seconds
    
    console.log('🎯 Looking for conversation ID:', conversationId);
    
    // Wait for conversations to load, then select the specific conversation
    const checkAndSelect = () => {
      attempts++;
      console.log(`🔍 Attempt ${attempts}/${maxAttempts} - Current conversations:`, 
        this.messages.map(c => c.conversation_id));
      
      const conversation = this.messages.find(c => c.conversation_id === conversationId);
      if (conversation) {
        const index = this.messages.indexOf(conversation);
        this.selectChat(index);
        console.log('✅ Found and selected conversation:', conversationId);
      } else if (attempts >= maxAttempts) {
        // If still not found after max attempts, reload conversations
        console.warn('⚠️ Conversation not found after initial load, reloading...', conversationId);
        this.loadConversations().then(() => {
          // Try one more time after reload
          console.log('🔄 After reload, conversations:', this.messages.map(c => c.conversation_id));
          const retryConversation = this.messages.find(c => c.conversation_id === conversationId);
          if (retryConversation) {
            const index = this.messages.indexOf(retryConversation);
            this.selectChat(index);
            console.log('✅ Found conversation after reload:', conversationId);
          } else {
            console.error('❌ Conversation not found even after reload:', conversationId);
            console.log('📊 Available conversations:', this.messages);
            console.log('🆔 Current user ID:', this.currentUserId);
            
            // Show user-friendly error
            this.notificationService.showError(
              'Conversation Not Found',
              'The conversation you\'re looking for could not be found. This might happen if the conversation was just created. Please check your messages list.'
            );
          }
        }).catch(error => {
          console.error('❌ Error reloading conversations:', error);
          this.notificationService.showError(
            'Error Loading Conversations',
            'Unable to load conversations. Please refresh the page and try again.'
          );
        });
      } else {
        // Still loading or not found yet, try again
        setTimeout(checkAndSelect, 100);
      }
    };
    
    setTimeout(checkAndSelect, 100);
  }

  /**
   * Check if current user is the product owner in dual-mode system
   * Logic: Compare current user ID with product uploader_id
   * Also check if product is sold/traded - if so, hide the dropdown
   */
  isProductOwner(): boolean {
    if (!this.selectedChat || !this.currentUserId) {
      console.log('❌ isProductOwner: No selected chat or current user');
      return false;
    }
    
    const conversationId = this.selectedChat.conversation_id;
    const productId = this.selectedChat.product_id;
    
    // Check if we have cached ownership status for this conversation
    if (this.productOwnershipStatus.hasOwnProperty(conversationId)) {
      const isOwner = this.productOwnershipStatus[conversationId];
      
      // If user is the owner, also check product status
      if (isOwner) {
        const saleStatus = this.productSaleStatus[conversationId];
        
        // Hide dropdown if product is sold or traded (final statuses)
        if (saleStatus === 'sold' || saleStatus === 'traded') {
          console.log('🔒 isProductOwner: Product is', saleStatus, '- hiding dropdown');
          return false;
        }
        
        // Show dropdown if product is reserved or available (changeable statuses)
        console.log('✅ isProductOwner: Product is', saleStatus, '- showing dropdown');
      }
      
      console.log('📊 isProductOwner: Using cached result', {
        conversation_id: conversationId,
        product_id: productId,
        current_user_id: this.currentUserId,
        is_product_owner: isOwner,
        sale_status: this.productSaleStatus[conversationId],
        dropdown_visible: isOwner && this.productSaleStatus[conversationId] !== 'sold' && this.productSaleStatus[conversationId] !== 'traded'
      });
      return isOwner;
    }
    
    // If no cached data, fetch product details to get uploader_id
    console.log('🔍 isProductOwner: Need to fetch product uploader_id for product:', productId);
    this.checkProductOwnership();
    
    // Return false while fetching (safe default)
    return false;
  }

  /**
   * Get product uploader_id and determine if current user owns the product
   */
  private checkProductOwnership() {
    if (!this.selectedChat) {
      console.warn('⚠️ checkProductOwnership: No selected chat');
      return;
    }
    
    const productId = this.selectedChat.product_id;
    const conversationId = this.selectedChat.conversation_id;
    
    console.log('🔍 Fetching product ownership data:', {
      product_id: productId,
      conversation_id: conversationId,
      current_user_id: this.currentUserId
    });
    
    this.apiService.getProductById(productId).subscribe({
      next: (response) => {
        console.log('📦 API Response:', response);
        
        // Handle different response structures
        const product = response.data?.[0] || response;
        
        if (product && product.uploader_id) {
          // Simple comparison: current user ID vs product uploader ID
          const isOwner = product.uploader_id === this.currentUserId;
          
          // Cache the ownership result
          this.productOwnershipStatus[conversationId] = isOwner;
          
          // Cache the sale status
          this.productSaleStatus[conversationId] = product.sale_status || 'available';
          
          // Determine if dropdown should be visible
          const shouldShowDropdown = isOwner && product.sale_status !== 'sold' && product.sale_status !== 'traded';
          
          console.log('✅ Product ownership determined:', {
            product_id: productId,
            product_name: product.product_name,
            uploader_id: product.uploader_id,
            current_user_id: this.currentUserId,
            comparison: `${this.currentUserId} === ${product.uploader_id}`,
            is_owner: isOwner,
            sale_status: product.sale_status,
            mark_status_visibility: shouldShowDropdown ? '✅ VISIBLE' : '❌ HIDDEN'
          });
          
        } else {
          console.warn('⚠️ Product missing uploader_id - defaulting to non-owner:', product);
          this.productOwnershipStatus[conversationId] = false;
          this.productSaleStatus[conversationId] = 'available';
        }
      },
      error: (error) => {
        console.error('❌ Error fetching product data:', error);
        this.productOwnershipStatus[conversationId] = false;
        this.productSaleStatus[conversationId] = 'available';
      }
    });
  }



  /**
   * Check if the rating button should be shown
   * Only show when there's a rating opportunity for the buyer
   */
  shouldShowRatingButton(): boolean {
    return this.showRatingButton;
  }

  /**
   * Check if there's an opportunity to rate the user in this conversation
   * This should be called when a conversation is selected
   */
  checkForRatingOpportunity() {
    if (!this.selectedChat) {
      console.log('❌ No selected chat - cannot check rating opportunity');
      return;
    }

    console.log('🔍 Checking rating opportunity for conversation:', this.selectedChat.conversation_id);
    
    // Reset rating button state first
    this.showRatingButton = false;
    
    // Directly call checkProductStatus which now handles both product status and rating checks
    this.checkProductStatus();
  }

  /**
   * Check if user has already rated this conversation
   */
  private checkIfAlreadyRated(conversationId: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.apiService.getConversationRating(conversationId, this.currentUserId).subscribe({
        next: (response) => {
          if (response.status === 'success' && response.data && response.data.length > 0) {
            // User has already rated this conversation
            resolve(true);
          } else {
            // User hasn't rated yet
            resolve(false);
          }
        },
        error: (error) => {
          console.error('Error checking rating status:', error);
          // On error, assume user hasn't rated to give them the opportunity
          resolve(false);
        }
      });
    });
  }

  /**
   * Check product status and show rating button if appropriate
   * Only show to the buyer when product is sold/traded
   */
  private checkProductStatus() {
    if (!this.selectedChat) {
      console.log('❌ No selected chat - cannot check product status');
      return;
    }

    console.log('🔍 Checking product status for conversation:', this.selectedChat.conversation_id);
    console.log('👥 Conversation participants:', {
      buyer_id: this.selectedChat.buyer_id,
      seller_id: this.selectedChat.seller_id,
      current_user_id: this.currentUserId
    });

    // Get product details to check current status
    this.apiService.getProductById(this.selectedChat.product_id).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data && response.data.length > 0) {
          const product = response.data[0];
          
          console.log('📦 Product data retrieved:', {
            product_id: product.product_id,
            sale_status: product.sale_status,
            uploader_id: product.uploader_id,
            current_user_id: this.currentUserId
          });
          
          // Check if product is sold or traded
          if (product.sale_status === 'sold' || product.sale_status === 'traded') {
            // Determine if current user is the buyer
            // The buyer is the one who is NOT the seller (uploader)
            const isBuyer = this.selectedChat?.buyer_id === this.currentUserId;
            
            console.log('🎯 Rating button visibility check:', {
              product_status: product.sale_status,
              current_user_is_buyer: isBuyer,
              current_user_is_seller: product.uploader_id === this.currentUserId,
              buyer_id_from_conversation: this.selectedChat?.buyer_id,
              seller_id_from_conversation: this.selectedChat?.seller_id,
              current_user_id: this.currentUserId
            });
            
            // Show rating button ONLY to the buyer
            if (isBuyer) {
              // Check if user has already rated this conversation
              const conversationKey = `rated_${this.selectedChat?.conversation_id}_${this.currentUserId}`;
              const hasAlreadyRated = localStorage.getItem(conversationKey) === 'true';
              
              if (hasAlreadyRated) {
                this.showRatingButton = false;
                console.log('❌ Rating button HIDDEN - User has already rated this conversation');
              } else {
                this.showRatingButton = true;
                console.log('⭐ Rating button VISIBLE - Current user is the buyer in a sold/traded transaction');
              }
            } else {
              this.showRatingButton = false;
              console.log('❌ Rating button HIDDEN - Current user is NOT the buyer (is the seller)');
            }
          } else {
            this.showRatingButton = false;
            console.log('❌ Rating button hidden - product status is:', product.sale_status);
          }
        } else {
          this.showRatingButton = false;
          console.log('❌ Rating button hidden - product not found');
        }
      },
      error: (error) => {
        console.error('Error checking product status:', error);
        this.showRatingButton = false;
      }
    });
  }



  /**
   * Debug socket connection for troubleshooting
   */
  debugSocket() {
    console.log('=== SOCKET DEBUG INFORMATION ===');
    console.log('🔗 Socket connected:', this.socketService.isConnected());
    console.log('🆔 Current user ID:', this.currentUserId);
    console.log('👤 Username:', localStorage.getItem('username'));
    console.log('🔌 Socket ID:', this.socketService.getSocketId());
    
    if (this.selectedChat) {
      console.log('💬 Selected chat:', {
        conversation_id: this.selectedChat.conversation_id,
        other_user_id: this.selectedChat.other_user_id,
        other_user_name: this.selectedChat.other_user_name
      });
      
      // Test socket emit
      console.log('📤 Testing socket emit...');
      const testData = {
        conversation_id: this.selectedChat.conversation_id,
        sender_id: this.currentUserId,
        recipient_id: this.selectedChat.other_user_id,
        message_text: 'Socket test message',
        sender_name: localStorage.getItem('username') || 'User',
        message_id: Date.now(),
        created_at: new Date().toISOString()
      };
      
      const emitResult = this.socketService.emit('send_message', testData);
      console.log('📡 Socket emit result:', emitResult);
      
      if (!emitResult) {
        console.warn('❌ Socket emit failed - attempting to reconnect...');
        this.socketService.connect();
      }
    } else {
      console.warn('⚠️ No chat selected for socket test');
    }
    
    // Test server connection
    fetch('http://localhost:3000/health')
      .then(response => response.json())
      .then(data => {
        console.log('🏥 Server health check:', data);
      })
      .catch(error => {
        console.error('❌ Server health check failed:', error);
      });
    
    console.log('=== END SOCKET DEBUG ===');
  }

  /**
   * Handle attachment file selection
   */
  onAttachmentSelect(event: any) {
    const files = event.target.files;
    if (files) {
      this.processAttachmentFiles(Array.from(files));
    }
    // Reset input
    event.target.value = '';
  }

  /**
   * Handle drag over event
   */
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  /**
   * Handle drag leave event
   */
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  /**
   * Handle drop event
   */
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files) {
      this.processAttachmentFiles(Array.from(files));
    }
  }

  /**
   * Process selected attachment files
   */
  private processAttachmentFiles(files: File[]) {
    const maxFiles = 5;
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    // Check total file limit
    if (this.attachmentPreviews.length + files.length > maxFiles) {
      this.notificationService.showError(`Maximum ${maxFiles} attachments allowed per message`);
      return;
    }

    files.forEach(file => {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        this.notificationService.showError(`${file.name}: Only images and videos are allowed`);
        return;
      }
      
      // Validate file size
      if (file.size > maxSize) {
        this.notificationService.showError(`${file.name}: File size must be less than 50MB`);
        return;
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        this.attachmentPreviews.push({
          file: file,
          preview: preview,
          type: isImage ? 'image' : 'video'
        });
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Remove attachment from preview
   */
  removeAttachment(index: number) {
    this.attachmentPreviews.splice(index, 1);
  }

  /**
   * Open attachment in modal
   */
  openAttachmentModal(attachment: Attachment) {
    this.selectedAttachment = attachment;
    this.showAttachmentModal = true;
  }

  /**
   * Close attachment modal
   */
  closeAttachmentModal() {
    this.showAttachmentModal = false;
    this.selectedAttachment = null;
  }

  /**
   * Open user report modal
   */
  openUserReportModal() {
    if (!this.selectedChat) {
      console.log('🔴 No chat selected for user report');
      return;
    }

    const reportedUserInfo = this.getReportedUserInfo();
    if (!reportedUserInfo) {
      console.log('🔴 No user info available for reporting');
      this.notificationService.showError(
        'Report Error', 
        'Unable to identify the user to report'
      );
      return;
    }

    console.log('🟢 Opening user report modal for:', reportedUserInfo);
    
    // Reset form and show modal
    this.resetUserReportForm();
    this.showUserReportModal = true;
  }

  /**
   * Close user report modal
   */
  closeUserReportModal() {
    this.showUserReportModal = false;
    this.resetUserReportForm();
  }

  /**
   * Reset user report form
   */
  resetUserReportForm() {
    this.userReportForm = {
      report_type: 'user_behavior' as 'user_behavior' | 'post_purchase_concern',
      user_reason_type: '',
      explanation: ''
    };
    this.selectedProofFiles = [];
    this.proofPreviews = [];
    this.isSubmittingReport = false;
  }

  /**
   * Get current reason options based on report type
   */
  getCurrentReasonOptions(): string[] {
    return this.userReportForm.report_type === 'user_behavior' 
      ? this.userBehaviorReasons 
      : this.postPurchaseReasons;
  }

  /**
   * Handle report type change
   */
  onReportTypeChange() {
    this.userReportForm.user_reason_type = ''; // Reset reason type when report type changes
  }

  /**
   * Get reason type display text
   */
  getReasonTypeText(reasonType: string): string {
    return reasonType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Handle proof file selection
   */
  onProofFilesSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    
    for (const file of files) {
      // Check file count limit
      if (this.selectedProofFiles.length >= this.maxProofFiles) {
        this.notificationService.showError(
          'File Limit Exceeded',
          `Maximum ${this.maxProofFiles} files allowed`
        );
        break;
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        this.notificationService.showError(
          'File Too Large',
          `${file.name} exceeds 10MB limit`
        );
        continue;
      }

      // Check file type
      if (!this.allowedFileTypes.includes(file.type)) {
        this.notificationService.showError(
          'Invalid File Type',
          `${file.name} is not a supported file type`
        );
        continue;
      }

      // Add file
      this.selectedProofFiles.push(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.proofPreviews.push({
          file: file,
          url: e.target?.result as string,
          type: file.type.startsWith('image/') ? 'image' : 'video'
        });
      };
      reader.readAsDataURL(file);
    }
    
    // Reset input
    event.target.value = '';
  }

  /**
   * Remove proof file
   */
  removeProofFile(index: number) {
    this.selectedProofFiles.splice(index, 1);
    this.proofPreviews.splice(index, 1);
  }

  /**
   * Validate user report form
   */
  validateUserReportForm(): boolean {
    if (!this.userReportForm.report_type) {
      this.notificationService.showError('Validation Error', 'Please select a report type.');
      return false;
    }

    if (!this.userReportForm.user_reason_type) {
      this.notificationService.showError('Validation Error', 'Please select a reason.');
      return false;
    }

    if (!this.userReportForm.explanation || this.userReportForm.explanation.trim().length < 10) {
      this.notificationService.showError('Validation Error', 'Please provide a detailed explanation (at least 10 characters).');
      return false;
    }

    return true;
  }

  /**
   * Convert files to base64
   */
  private async convertProofFilesToBase64(): Promise<string[]> {
    const base64Files: string[] = [];
    
    for (const file of this.selectedProofFiles) {
      try {
        const base64 = await this.fileToBase64(file);
        base64Files.push(base64);
      } catch (error) {
        console.error('Error converting file to base64:', error);
      }
    }
    
    return base64Files;
  }

  /**
   * Convert file to base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Submit user report
   */
  async submitUserReport() {
    if (!this.validateUserReportForm()) {
      return;
    }

    if (!this.selectedChat) {
      this.notificationService.showError('Error', 'No chat selected');
      return;
    }

    const reportedUserInfo = this.getReportedUserInfo();
    if (!reportedUserInfo) {
      this.notificationService.showError('Error', 'Unable to identify user to report');
      return;
    }

    this.isSubmittingReport = true;

    try {
      // Convert proof files to base64
      const proofBase64Array = await this.convertProofFilesToBase64();

      // Prepare report data
      const reportData = {
        reporter_id: this.currentUserId,
        reported_user_id: reportedUserInfo.id,
        conversation_id: this.selectedChat.conversation_id,
        // Don't send product_id for user reports
        report_type: this.userReportForm.report_type,
        user_reason_type: this.userReportForm.user_reason_type,
        product_reason_type: null, // Always null for user reports
        reason_details: this.userReportForm.explanation,
        proof: proofBase64Array.length > 0 ? JSON.stringify(proofBase64Array) : null,
        status: 'pending'
      };

      console.log('Submitting user report:', reportData);

      // Submit report via API
      this.apiService.submitReport(reportData).subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.notificationService.showSuccess(
              'Report Submitted',
              'Your report has been submitted successfully. We will review it shortly.'
            );
            this.closeUserReportModal();
          } else {
            this.notificationService.showError(
              'Submission Failed',
              response.message || 'Failed to submit report. Please try again.'
            );
          }
          this.isSubmittingReport = false;
        },
        error: (error) => {
          console.error('Error submitting user report:', error);
          this.notificationService.showError(
            'Submission Failed',
            'An error occurred while submitting your report. Please try again.'
          );
          this.isSubmittingReport = false;
        }
      });
    } catch (error) {
      console.error('Error preparing user report:', error);
      this.notificationService.showError(
        'Submission Failed',
        'An error occurred while preparing your report. Please try again.'
      );
      this.isSubmittingReport = false;
    }
  }

  /**
   * Handle user report submitted
   */
  onUserReportSubmitted(reportData: any) {
    console.log('User report submitted:', reportData);
    this.notificationService.showSuccess(
      'Report Submitted',
      'Your report has been submitted successfully.'
    );
  }

  /**
   * Get reported user info for the modal
   */
  getReportedUserInfo() {
    if (!this.selectedChat) return null;
    
    return {
      id: this.selectedChat.other_user_id,
      full_name: this.selectedChat.other_user_name,
      profile_image: this.selectedChat.other_user_avatar
    };
  }
}
