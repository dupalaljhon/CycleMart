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
import { environment } from '../../environments/environment';

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
  system_message_type?: 'sold' | 'traded' | 'reserved';  // Type of system message
}

interface BuyingProcessStep {
  id: number;
  title: string;
  description: string;
  expanded: boolean;
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
  for_type?: 'sale' | 'trade' | 'both' | string;
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

  // Track product listing type per conversation
  productForType: { [conversationId: number]: 'sale' | 'trade' | 'both' } = {};
  
  // Track product sale status per conversation
  productSaleStatus: { [conversationId: number]: string } = {};
  
  // Status confirmation modal properties
  showStatusConfirmationModal: boolean = false;
  pendingStatusChange: 'sold' | 'traded' | 'reserved' | 'available' | null = null;
  
  // Reservation modal properties
  showReservationModal: boolean = false;
  selectedReservationDuration: number = 24; // Default 24 hours
  reservationDurations = [24, 48, 72]; // Available duration options
  showCancelReservationModal: boolean = false;

  // Buying process floating dropdown
  showBuyingProcessDropdown: boolean = false;
  buyingProcessSteps: BuyingProcessStep[] = [
    {
      id: 1,
      title: 'Start with Product Check',
      description: 'Review photos, condition, brand details, location, and price before messaging the seller.',
      expanded: false
    },
    {
      id: 2,
      title: 'Ask Questions in Chat',
      description: 'Confirm item issues, inclusions, and final terms. Keep all agreements inside chat for record.',
      expanded: false
    },
    {
      id: 3,
      title: 'Reserve if Needed',
      description: 'If you need time to prepare payment, ask for reservation and confirm the duration clearly.',
      expanded: false
    },
    {
      id: 4,
      title: 'Inspect Before Paying',
      description: 'Meet in a safe public location and inspect the item first. Only pay after verification.',
      expanded: false
    },
    {
      id: 5,
      title: 'Complete and Rate',
      description: 'After successful purchase, complete the transaction and submit a rating for transparency.',
      expanded: false
    }
  ];
  
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
  isMessageInputFocused: boolean = false;
  private readonly attachmentsBaseUrl: string = environment.apiUploadsBaseUrl;

  readonly buyerGuidedMessages: string[] = [
    'Hi! Is this item still available?',
    'Can you share more details about the condition of the item?',
    'Is the price still negotiable?',
    'Where are you located? Is meet-up or delivery available?',
    'What is the last price you can offer?',
    'I\'m interested. Can we finalize this deal?',
    'Can you reserve this item for me?'
  ];

  readonly sellerGuidedMessages: string[] = [
    'Yes, the item is still available.',
    'The item is in good condition with minimal issues.',
    'The price is slightly negotiable.',
    'Meet-up is available at my location.',
    'I can reserve the item for you for a limited time.',
    'Let me know when you\'re ready to proceed.'
  ];
  
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

    if (!event.target.closest('.buying-process-widget')) {
      this.showBuyingProcessDropdown = false;
      this.buyingProcessSteps.forEach(step => step.expanded = false);
    }
  }

  toggleBuyingProcessDropdown() {
    this.showBuyingProcessDropdown = !this.showBuyingProcessDropdown;
  }

  toggleBuyingStep(step: BuyingProcessStep) {
    step.expanded = !step.expanded;
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
        this.loadConversations().then(() => {
          this.handleDirectConversationAccess(parseInt(params['conversation_id']));
        }).catch(error => {
          this.handleDirectConversationAccess(parseInt(params['conversation_id']));
        });
      } else {
        // Normal load when accessing messages page directly
        this.loadConversations().catch(error => {
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
    
    // Subscribe to connection status
    this.subscriptions.push(
      this.socketService.isConnected$.subscribe(isConnected => {
        if (isConnected) {
          // if (connectionShown) {
          //   this.notificationService.showSuccess('Connected', 'Real-time messaging is now available');
          // }
          this.authenticateUser();
        } else if (connectionShown) {
          // this.notificationService.showWarning('Connection Lost', 'Real-time messaging is temporarily unavailable');
        }
        connectionShown = true;
      })
    );

    // Connect to socket if not connected - add small delay to ensure server is ready
    setTimeout(() => {
        
      if (!this.socketService.isConnected()) {
        this.socketService.connect();
      } else {
        // If already connected, authenticate immediately
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
    
    this.socketService.emit('authenticate', authData);
    
    // Add a small delay to let authentication complete, then confirm
    setTimeout(() => {
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
    this.subscriptions.push(
      this.socketService.on('product_status_changed').subscribe((data: any) => {
        this.handleProductStatusChange(data);
      })
    );
  }

  loadConversations(): Promise<void> {
    this.isLoading = true;
    return new Promise((resolve, reject) => {
      this.apiService.getUserConversations(this.currentUserId).subscribe({
        next: (response) => {
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
            
          
            // Auto-select first conversation on desktop
            if (!this.isMobile && this.messages.length > 0) {
              this.selectChat(0);
            }
          }
          this.isLoading = false;
          resolve();
        },
        error: (error) => {
          this.isLoading = false;
          reject(error);
        }
      });
    });
  }

  loadMessages(conversationId: number) {
    
    this.apiService.getConversationMessages(conversationId).subscribe({
      next: (response) => {
        
        if (response.status === 'success' && this.selectedChat) {
          const autoResponseMessage = 'Hello! Thank you for your interest in this item. We appreciate your inquiry. Kindly wait while the seller reviews your message and responds shortly. Thank you for your patience!';
          
          this.selectedChat.messages = response.data.map((msg: any) => {
            // Check if this is a system message (sender_id = 0)
            const isSystemMessage =
              msg.sender_id === 0 ||
              msg.sender_id === '0' ||
              (typeof msg.message_text === 'string' && msg.message_text.trim() === autoResponseMessage);
            
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
            
            
            const mappedMessage = {
              message_id: msg.message_id,
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              sender_avatar: this.getAvatarUrl(msg.sender_avatar, msg.sender_name),
              message_text: msg.message_text,
              created_at: msg.created_at,
              is_read: msg.is_read,
              attachments: this.normalizeAttachments(msg.attachments || []),
              is_system_message: isSystemMessage,
              system_message_type: systemMessageType
            };
            
            
            return mappedMessage;
          });
          
          
          // Log first few messages for debugging
          if (this.selectedChat.messages.length > 0) {
            
            // Count system messages
            const systemMessages = this.selectedChat.messages.filter(m => m.is_system_message);
            if (systemMessages.length > 0) {
              systemMessages.forEach((msg, index) => {
              });
            } else {
            }
          } else {
          }
          
          // Mark messages as read
          this.markMessagesAsRead(conversationId);
          
          // Trigger auto-scroll for initial message load
          setTimeout(() => {
            this.shouldAutoScroll = true;
          }, 200);
        } else {
        }
      },
      error: (error) => {
      }
    });
  }

  handleIncomingMessage(messageData: any) {
    
    // Run inside Angular zone to ensure change detection
    this.ngZone.run(() => {
      // Skip echo messages to avoid duplicates
      if (messageData.is_echo) {
        return;
      }

      // De-dup: if we just sent an automated sale/trade message as seller and
      // backend also emits a system receipt, suppress the system duplicate
      if (messageData.is_system_message &&
          (messageData.system_message_type === 'sold' || messageData.system_message_type === 'traded') &&
          messageData.conversation_id &&
          this.recentAutoStatusMessageAt[messageData.conversation_id] &&
          (Date.now() - this.recentAutoStatusMessageAt[messageData.conversation_id] < 5000)) {
        // return;
      }
      
      // Find the conversation
      const conversationIndex = this.messages.findIndex(c => c.conversation_id === messageData.conversation_id);
      if (conversationIndex !== -1) {
        const conversation = this.messages[conversationIndex];
        
        // Update last message info
        conversation.last_message = messageData.message_text || (messageData.attachments?.length > 0 ? `Sent ${messageData.attachments.length} attachment(s)` : 'New message');
        conversation.last_message_time = 'Just now';
        
        // If sender is not current user, increment unread count
        if (messageData.sender_id !== this.currentUserId) {
          conversation.unread_count++;
        }
        
        // If this conversation is currently selected, add message to the chat
        if (this.selectedChat && this.selectedChat.conversation_id === messageData.conversation_id) {
          const newMessage: ChatMessage = {
            message_id: messageData.message_id,
            sender_id: messageData.sender_id,
            sender_name: messageData.sender_name,
            sender_avatar: this.getAvatarUrl(messageData.sender_avatar, messageData.sender_name),
            message_text: messageData.message_text,
            created_at: messageData.created_at,
            is_read: false,
            attachments: this.normalizeAttachments(messageData.attachments || []),
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
    // Check if this status change affects the current user and conversation
    if (data.conversation_id && data.status && (data.status === 'sold' || data.status === 'traded')) {
      // Find the conversation that was affected
      const affectedConversation = this.messages.find(conv => conv.conversation_id === data.conversation_id);

      // Convert IDs to same type for comparison
      const currentUserId = parseInt(this.currentUserId.toString());

      // Check if current user is the BUYER in this conversation
      const isBuyer = affectedConversation?.buyer_id === currentUserId;

      // Only show rating button to the BUYER
      if (affectedConversation && isBuyer) {
        // Check if user has already rated this conversation
        const conversationKey = `rated_${data.conversation_id}_${this.currentUserId}`;
        const hasAlreadyRated = localStorage.getItem(conversationKey) === 'true';

        if (hasAlreadyRated) {
          this.showRatingButton = false;
          return; // Exit early
        }

        // Select this conversation if it's not already selected
        if (!this.selectedChat || this.selectedChat.conversation_id !== data.conversation_id) {
          const conversationIndex = this.messages.findIndex(conv => conv.conversation_id === data.conversation_id);
          if (conversationIndex !== -1) {
            this.selectChat(conversationIndex);
          }
        }

        // Show rating button ONLY for the buyer who hasn't rated yet
        this.showRatingButton = true;

        // Automatically open rating modal after a short delay
        setTimeout(() => {
          // Check if user hasn't already rated this transaction
          this.checkIfAlreadyRated(data.conversation_id).then((alreadyRated) => {
            if (!alreadyRated) {
              // Automatically show the rating modal
              this.showRatingModal = true;
            } else {
            }
          }).catch((error) => {
            // If there's an error checking, still show the modal
            this.showRatingModal = true;
          });
        }, 1000); // Short delay to let conversation selection complete

      } else if (affectedConversation) {
        this.showRatingButton = false;
      } else {
      }
    } else {
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
    this.checkProductOwnership();
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
    
    
    const deleteData = {
      conversation_id: chatToDelete.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.deleteConversation(deleteData).subscribe({
      next: (response) => {
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
          this.notificationService.showError(
            'Delete Failed',
            response.message || 'Failed to delete conversation'
          );
        }
      },
      error: (error) => {
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
                attachments: this.normalizeAttachments(response.data.attachments || []),
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
                
                
                const socketEmitted = this.socketService.emit('send_message', messageToEmit);

                // Log for debugging but don't show notifications
                if (!socketEmitted) {
                } else {
                }
              } else {
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
        const product = (prodRes && prodRes.data && Array.isArray(prodRes.data) && prodRes.data.length > 0) ? prodRes.data[0] : {};
        const productName = chat.product_name || product.product_name || 'This product';
        const price = (product.price ?? chat.price ?? 0).toFixed(2);
        const location = product.location || product.product_location || 'N/A';
        const condition = product.item_condition || product.condition || 'Second hand';
        const type = product.for_type ? (product.for_type.charAt(0).toUpperCase() + product.for_type.slice(1)) : (status === 'traded' ? 'Trade' : 'Sale');
        const verb = status === 'sold' ? 'sold' : 'traded';

        const systemMessageText = `This ${productName} ${verb} to you\n\n` +
          `ðŸ“¦ Product Details:\n` +
          `ðŸ’° Price: â‚±${price}\n` +
          `ðŸ“ Location: ${location}\n` +
          `ðŸ”§ Condition: ${condition}\n` +
          `ðŸ“ Type: ${type}`;

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
        const systemMessageText = `This ${chat.product_name} ${verb} to you\n\nðŸ“¦ Product Details:\nðŸ’° Price: â‚±${(chat.price || 0).toFixed(2)}\nðŸ“ Location: N/A\nðŸ”§ Condition: Second hand\nðŸ“ Type: ${verb === 'sold' ? 'Sale' : 'Trade'}`;
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
    this.isMessageInputFocused = true;
  }

  onInputBlur() {
    this.isTyping = false;
    this.isMessageInputFocused = false;
  }

  isCurrentUserSellerInChat(): boolean {
    return !!this.selectedChat && this.currentUserId === this.selectedChat.seller_id;
  }

  getGuidedMessagesForCurrentRole(): string[] {
    return this.isCurrentUserSellerInChat() ? this.sellerGuidedMessages : this.buyerGuidedMessages;
  }

  shouldShowGuidedMessages(): boolean {
    return !!this.selectedChat &&
      !this.newMessage.trim() &&
      this.attachmentPreviews.length === 0 &&
      !this.isMessageInputFocused &&
      this.accountStatusService.canPerformAction('send_message');
  }

  selectGuidedMessage(message: string): void {
    if (!this.selectedChat) {
      this.notificationService.showError('No Chat Selected', 'Please select a conversation first');
      return;
    }

    if (!this.accountStatusService.canPerformAction('send_message')) {
      this.notificationService.showWarning('Messaging Restricted', 'You cannot send messages right now.');
      return;
    }

    // Guided messages are one-tap quick replies: set and send immediately.
    this.newMessage = message;
    this.sendMessage();
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
    
    //   scrollTop: element.scrollTop,
    //   clientHeight: element.clientHeight,
    //   scrollHeight: element.scrollHeight,
    //   isAtBottom: isAtBottom,
    //   showButton: this.showScrollToBottomButton,
    //   userScrolling: this.isUserScrolling
    // });
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
      }, 500);
    }
  }

  /**
   * Debug scroll state
   */
  debugScrollState(): void {
    if (this.chatContainer) {
      const element = this.chatContainer.nativeElement;
      //   shouldAutoScroll: this.shouldAutoScroll,
      //   isUserScrolling: this.isUserScrolling,
      //   isNearBottom: this.isNearBottom,
      //   showScrollButton: this.showScrollToBottomButton,
      //   scrollTop: element.scrollTop,
      //   scrollHeight: element.scrollHeight,
      //   clientHeight: element.clientHeight,
      //   distanceFromBottom: element.scrollHeight - (element.scrollTop + element.clientHeight)
      // });
    }
  }

  getAvatarUrl(profileImage: string | null, name: string): string {
    const safeName = name || 'User';

    if (profileImage && profileImage.trim() !== '') {
      if (profileImage.startsWith('data:')) {
        return profileImage;
      }

      // If it's a full URL, return as-is
      if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
        return profileImage;
      }

      // For relative paths stored under uploads/, serve from the API uploads base URL
      const stripped = profileImage
        .replace(/^\/?api\/uploads[\/\\]/, '')
        .replace(/^\/?uploads[\/\\]/, '');
      return `${environment.apiUploadsBaseUrl}${stripped}`;
    }
    
    // Generate avatar using UI Avatars
    const colors = ['6BA3BE', '34D399', 'F59E0B', '8B5CF6', 'EF4444', '10B981'];
    const color = colors[safeName.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=${color}&color=fff`;
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
        return `${environment.apiUploadsBaseUrl}${cleanImageName}`;
      }
    } catch (e) {
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
    if (formatted.includes('ðŸ“¦ Product Information:')) {
      formatted = formatted.replace(
        /(ðŸ“¦ Product Information:.*?)(?=\n\n|$)/s,
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
    //   message_id: msg.message_id,
    //   sender_id: msg.sender_id,
    //   is_system_message: msg.is_system_message,
    //   system_message_type: msg.system_message_type,
    //   has_text: !!msg.message_text,
    //   text_preview: msg.message_text?.substring(0, 50)
    // });
    
    if (msg.is_system_message) {
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
    
    if (!this.selectedChat || !this.pendingStatusChange) {
      //   hasSelectedChat: !!this.selectedChat,
      //   pendingStatus: this.pendingStatusChange
      // });
      return;
    }
    
    const selectedChat = this.selectedChat; // Store reference for type safety
    const newStatus = this.pendingStatusChange;
    
    //   conversationId: selectedChat.conversation_id,
    //   productId: selectedChat.product_id,
    //   productName: selectedChat.product_name,
    //   newStatus: newStatus,
    //   buyerId: selectedChat.buyer_id,
    //   sellerId: selectedChat.seller_id,
    //   otherUserId: selectedChat.other_user_id,
    //   otherUserName: selectedChat.other_user_name,
    //   currentUserId: this.currentUserId
    // });
    
    // Close modal
    this.showStatusConfirmationModal = false;
    this.pendingStatusChange = null;

    const updateData = {
        product_id: selectedChat.product_id,
        sale_status: newStatus,
        uploader_id: this.currentUserId,
        for_type: 'sale', // Default for_type since it's required
        conversation_id: selectedChat.conversation_id, // Track which conversation made the sale
        buyer_id: selectedChat.buyer_id, // Track the buyer from this conversation
        seller_id: selectedChat.seller_id // Track the seller from this conversation
      };


      this.apiService.updateSaleStatus(updateData).subscribe({
        next: (response) => {
          
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
            //   product_id: selectedChat.product_id,
            //   product_name: selectedChat.product_name,
            //   new_status: newStatus,
            //   timestamp: new Date().toISOString(),
            //   user_id: this.currentUserId,
            //   dropdown_will_be: (newStatus === 'sold' || newStatus === 'traded') ? 'HIDDEN' : 'VISIBLE'
            // });

            // Show rating modal to the other party when item is marked as sold or traded
            // The person who marks the status is typically the seller
            // The other person in the conversation (buyer) should get the rating opportunity
            if ((newStatus === 'sold' || newStatus === 'traded') && this.selectedChat) {
                // Send automated sale/trade message to buyer
                this.sendSystemConfirmationMessage(selectedChat, newStatus);
              //   isSold: newStatus === 'sold',
              //   isTraded: newStatus === 'traded',
              //   hasSelectedChat: !!this.selectedChat,
              //   selectedChatId: this.selectedChat?.conversation_id
              // });
              
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
                
                // Align event name with listener 'product_status_changed'
                this.socketService.emit('product_status_changed', statusChangeData);
                
                // Add confirmation that emit was called
              } else {
                // Try to reconnect socket
                this.socketService.connect();
              }
              
              // Rating button visibility is now handled by buyer check in checkProductStatus()
              // Don't show rating button to seller - only buyers can rate sellers
            } else if (newStatus === 'reserved' && this.selectedChat) {
              const reservedMessageText = `${selectedChat.product_name} has been reserved.`;
              const systemMessage: any = {
                message_id: Date.now(),
                sender_id: 0,
                sender_name: 'System',
                sender_avatar: '',
                message_text: reservedMessageText,
                created_at: new Date().toISOString(),
                is_read: false,
                attachments: [],
                is_system_message: true,
                system_message_type: 'reserved'
              };

              this.selectedChat.messages = [...(this.selectedChat.messages || []), systemMessage];
              this.selectedChat = { ...this.selectedChat };

              if (this.socketService.isConnected()) {
                this.socketService.emit('product_status_changed', {
                  conversation_id: selectedChat.conversation_id,
                  product_id: selectedChat.product_id,
                  product_name: selectedChat.product_name,
                  status: newStatus,
                  changed_by: this.currentUserId,
                  other_user_id: selectedChat.other_user_id,
                  timestamp: new Date().toISOString()
                });
              } else {
                this.socketService.connect();
              }
            }
          } else {
            this.notificationService.showError(
              'Update Failed',
              response.message || 'Failed to update product status. Please try again.'
            );
          }
        },
        error: (error) => {
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
   * Open reservation modal to select duration
   */
  openReservationModal() {
    if (!this.selectedChat) return;
    
    // Reset to default 24 hours
    this.selectedReservationDuration = 24;
    this.showReservationModal = true;
    this.showStatusDropdown = false; // Close status dropdown if open
  }

  /**
   * Close reservation modal
   */
  closeReservationModal() {
    this.showReservationModal = false;
    this.selectedReservationDuration = 24;
  }

  /**
   * Confirm reservation with selected duration
   */
  confirmReservation() {
    if (!this.selectedChat || !this.selectedReservationDuration) {
      this.notificationService.showError(
        'Reservation Failed',
        'Please select a reservation duration'
      );
      return;
    }

    const reservationData = {
      product_id: this.selectedChat.product_id,
      buyer_id: this.selectedChat.other_user_id, // The person you're messaging
      seller_id: this.currentUserId, // You (the product owner)
      duration_hours: this.selectedReservationDuration
    };

    this.closeReservationModal();

    this.apiService.reserveProduct(reservationData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.notificationService.showSuccess(
            'Product Reserved',
            `${this.selectedChat!.product_name} has been reserved for ${this.selectedReservationDuration} hours!`
          );

          if (this.selectedChat) {
            const reservedMessageText = `'${this.selectedChat.product_name}' has been reserved for ${this.selectedReservationDuration} hours.`;
            const systemMessage: any = {
              message_id: Date.now(),
              sender_id: 0,
              sender_name: 'System',
              sender_avatar: '',
              message_text: reservedMessageText,
              created_at: new Date().toISOString(),
              is_read: false,
              attachments: [],
              is_system_message: true,
              system_message_type: 'reserved'
            };

            this.selectedChat.messages = [...(this.selectedChat.messages || []), systemMessage];
            this.selectedChat = { ...this.selectedChat };
          }

          // Update local sale status
          if (this.selectedChat) {
            this.productSaleStatus[this.selectedChat.conversation_id] = 'reserved';
          }

          // Reload conversations to reflect changes
          this.loadConversations();

          // Emit socket event for real-time update
          if (this.socketService.isConnected()) {
            this.socketService.emit('product_status_changed', {
              product_id: this.selectedChat!.product_id,
              new_status: 'reserved',
              conversation_id: this.selectedChat!.conversation_id,
              buyer_id: reservationData.buyer_id,
              seller_id: reservationData.seller_id
            });
          }
        } else {
          this.notificationService.showError(
            'Reservation Failed',
            response.message || 'Failed to reserve product. Please try again.'
          );
        }
      },
      error: (error) => {
        this.notificationService.showError(
          'Reservation Failed',
          error.error?.message || 'Failed to reserve product. Please check your connection and try again.'
        );
      }
    });
  }

  /**
   * Open cancel reservation confirmation modal
   */
  openCancelReservationModal() {
    if (!this.selectedChat) return;
    this.showCancelReservationModal = true;
  }

  /**
   * Close cancel reservation modal
   */
  closeCancelReservationModal() {
    this.showCancelReservationModal = false;
  }

  /**
   * Confirm and cancel an active reservation
   */
  confirmCancelReservation() {
    if (!this.selectedChat) return;

    this.showCancelReservationModal = false;

    const cancelData = {
      product_id: this.selectedChat.product_id,
      user_id: this.currentUserId,
      reason: 'Seller cancelled reservation'
    };

    this.apiService.cancelReservation(cancelData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.notificationService.showSuccess(
            'Reservation Cancelled',
            `Reservation for ${this.selectedChat!.product_name} has been cancelled.`
          );

          // Update local sale status
          if (this.selectedChat) {
            this.productSaleStatus[this.selectedChat.conversation_id] = 'available';
          }

          // Reload conversations
          this.loadConversations();

          // Emit socket event
          if (this.socketService.isConnected()) {
            this.socketService.emit('product_status_changed', {
              product_id: this.selectedChat!.product_id,
              new_status: 'available',
              conversation_id: this.selectedChat!.conversation_id
            });
          }
        } else {
          this.notificationService.showError(
            'Cancellation Failed',
            response.message || 'Failed to cancel reservation.'
          );
        }
      },
      error: (error) => {
        this.notificationService.showError(
          'Cancellation Failed',
          'Failed to cancel reservation. Please try again.'
        );
      }
    });
  }

  /**
   * Archive a specific chat conversation
   */
  archiveChat(index: number) {
    const chatToArchive = this.messages[index];
    if (!chatToArchive) return;
    
    
    const archiveData = {
      conversation_id: chatToArchive.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.archiveConversation(archiveData).subscribe({
      next: (response) => {
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
          this.notificationService.showError(
            'Archive Failed',
            response.message || 'Failed to archive conversation'
          );
        }
      },
      error: (error) => {
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
      this.loadArchivedConversations().then(() => {
        this.notificationService.showInfo(
          'Archived Messages',
          `Showing ${this.archivedMessages.length} archived conversations`
        );
      }).catch(error => {
        this.notificationService.showError(
          'Load Failed',
          'Failed to load archived conversations'
        );
      });
    } else {
      // Show active messages
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
    return new Promise((resolve, reject) => {
      this.apiService.getUserArchivedConversations(this.currentUserId).subscribe({
        next: (response) => {
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
            
            //   id: c.conversation_id,
            //   other_user: c.other_user_name,
            //   product: c.product_name,
            //   buyer_id: c.buyer_id,
            //   seller_id: c.seller_id
            // })));
          } else {
            this.archivedMessages = [];
          }
          this.isLoading = false;
          resolve();
        },
        error: (error) => {
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
    
    
    const restoreData = {
      conversation_id: chatToRestore.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.restoreConversation(restoreData).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          // Move chat back to active messages
          this.messages.unshift(chatToRestore); // Add to beginning of active messages
          this.archivedMessages.splice(index, 1);
          
          this.notificationService.showSuccess(
            'Chat Restored',
            `Conversation with ${chatToRestore.other_user_name} has been restored`
          );
        } else {
          this.notificationService.showError(
            'Restore Failed',
            response.message || 'Failed to restore conversation'
          );
        }
      },
      error: (error) => {
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
    
    
    const deleteData = {
      conversation_id: chatToDelete.conversation_id,
      user_id: this.currentUserId
    };

    this.apiService.deleteConversation(deleteData).subscribe({
      next: (response) => {
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
          this.notificationService.showError(
            'Delete Failed',
            response.message || 'Failed to delete conversation'
          );
        }
      },
      error: (error) => {
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
      return;
    }
    
    
    // Open modal immediately without checks
    this.showRatingModal = true;
  }

  /**
   * Open rating modal (original method with checks)
   */
  openRatingModal() {
    if (!this.selectedChat) {
      return;
    }
    
    
    // Check if user has already rated before opening modal
    this.checkIfAlreadyRated(this.selectedChat.conversation_id).then((alreadyRated) => {
      if (alreadyRated) {
        this.showRatingButton = false; // Hide the button since already rated
      } else {
        this.showRatingModal = true;
      }
    }).catch((error) => {
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
    
    // Hide the rating button after rating is submitted
    this.showRatingButton = false;
    
    // Close the modal
    this.showRatingModal = false;
    
    // Store that this conversation has been rated to prevent button from showing again
    if (this.selectedChat) {
      const conversationKey = `rated_${this.selectedChat.conversation_id}_${this.currentUserId}`;
      localStorage.setItem(conversationKey, 'true');
    }
    
  }

  /**
   * Handle direct access to a specific conversation (from product listing)
   */
  handleDirectConversationAccess(conversationId: number) {
    let attempts = 0;
    const maxAttempts = 30; // Wait up to 3 seconds
    
    
    // Wait for conversations to load, then select the specific conversation
    const checkAndSelect = () => {
      attempts++;
        // this.messages.map(c => c.conversation_id));
      
      const conversation = this.messages.find(c => c.conversation_id === conversationId);
      if (conversation) {
        const index = this.messages.indexOf(conversation);
        this.selectChat(index);
      } else if (attempts >= maxAttempts) {
        // If still not found after max attempts, reload conversations
        this.loadConversations().then(() => {
          // Try one more time after reload
          const retryConversation = this.messages.find(c => c.conversation_id === conversationId);
          if (retryConversation) {
            const index = this.messages.indexOf(retryConversation);
            this.selectChat(index);
          } else {
            
            // Show user-friendly error
            this.notificationService.showError(
              'Conversation Not Found',
              'The conversation you\'re looking for could not be found. This might happen if the conversation was just created. Please check your messages list.'
            );
          }
        }).catch(error => {
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
          return false;
        }
        
        // Show dropdown if product is reserved or available (changeable statuses)
      }
      
      //   conversation_id: conversationId,
      //   product_id: productId,
      //   current_user_id: this.currentUserId,
      //   is_product_owner: isOwner,
      //   sale_status: this.productSaleStatus[conversationId],
      //   dropdown_visible: isOwner && this.productSaleStatus[conversationId] !== 'sold' && this.productSaleStatus[conversationId] !== 'traded'
      // });
      return isOwner;
    }
    
    // If no cached data, fetch product details to get uploader_id
    this.checkProductOwnership();
    
    // Return false while fetching (safe default)
    return false;
  }

  /**
   * Get product uploader_id and determine if current user owns the product
   */
  private checkProductOwnership() {
    if (!this.selectedChat) {
      return;
    }
    
    const productId = this.selectedChat.product_id;
    const conversationId = this.selectedChat.conversation_id;
    
    //   product_id: productId,
    //   conversation_id: conversationId,
    //   current_user_id: this.currentUserId
    // });
    
    this.apiService.getProductById(productId).subscribe({
      next: (response) => {
        
        // Handle different response structures
        const product = (response && response.data && Array.isArray(response.data) && response.data.length > 0) ? response.data[0] : response;
        
        if (product && product.uploader_id) {
          // Simple comparison: current user ID vs product uploader ID
          const isOwner = product.uploader_id === this.currentUserId;
          const forType = this.normalizeForType(product.for_type);
          
          // Cache the ownership result
          this.productOwnershipStatus[conversationId] = isOwner;

          // Cache the listing type so status options can be filtered correctly
          this.productForType[conversationId] = forType;
          
          // Cache the sale status
          this.productSaleStatus[conversationId] = product.sale_status || 'available';
          
          // Determine if dropdown should be visible
          const shouldShowDropdown = isOwner && product.sale_status !== 'sold' && product.sale_status !== 'traded';
          
          //   product_id: productId,
          //   product_name: product.product_name,
          //   uploader_id: product.uploader_id,
          //   current_user_id: this.currentUserId,
          //   comparison: `${this.currentUserId} === ${product.uploader_id}`,
          //   is_owner: isOwner,
          //   sale_status: product.sale_status,
          //   mark_status_visibility: shouldShowDropdown ? 'âœ… VISIBLE' : 'âŒ HIDDEN'
          // });
          
        } else {
          this.productOwnershipStatus[conversationId] = false;
          this.productForType[conversationId] = 'both';
          this.productSaleStatus[conversationId] = 'available';
        }
      },
      error: (error) => {
        this.productOwnershipStatus[conversationId] = false;
        this.productForType[conversationId] = 'both';
        this.productSaleStatus[conversationId] = 'available';
      }
    });
  }

  private normalizeForType(forType: any): 'sale' | 'trade' | 'both' {
    const normalized = String(forType || 'both').trim().toLowerCase();
    if (normalized === 'sale' || normalized === 'trade' || normalized === 'both') {
      return normalized;
    }
    return 'both';
  }

  canShowSoldOption(): boolean {
    if (!this.selectedChat) return false;
    const forType = this.productForType[this.selectedChat.conversation_id] || this.normalizeForType(this.selectedChat.for_type);
    return forType === 'sale' || forType === 'both';
  }

  canShowTradedOption(): boolean {
    if (!this.selectedChat) return false;
    const forType = this.productForType[this.selectedChat.conversation_id] || this.normalizeForType(this.selectedChat.for_type);
    return forType === 'trade' || forType === 'both';
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
      return;
    }

    
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
      return;
    }

    //   buyer_id: this.selectedChat.buyer_id,
    //   seller_id: this.selectedChat.seller_id,
    //   current_user_id: this.currentUserId
    // });

    // Get product details to check current status
    this.apiService.getProductById(this.selectedChat.product_id).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data && response.data.length > 0) {
          const product = response.data[0];
          
          //   product_id: product.product_id,
          //   sale_status: product.sale_status,
          //   uploader_id: product.uploader_id,
          //   current_user_id: this.currentUserId
          // });
          
          // Check if product is sold or traded
          if (product.sale_status === 'sold' || product.sale_status === 'traded') {
            // Determine if current user is the buyer
            // The buyer is the one who is NOT the seller (uploader)
            const isBuyer = this.selectedChat?.buyer_id === this.currentUserId;
            
            //   product_status: product.sale_status,
            //   current_user_is_buyer: isBuyer,
            //   current_user_is_seller: product.uploader_id === this.currentUserId,
            //   buyer_id_from_conversation: this.selectedChat?.buyer_id,
            //   seller_id_from_conversation: this.selectedChat?.seller_id,
            //   current_user_id: this.currentUserId
            // });
            
            // Show rating button ONLY to the buyer
            if (isBuyer) {
              // Check if user has already rated this conversation
              const conversationKey = `rated_${this.selectedChat?.conversation_id}_${this.currentUserId}`;
              const hasAlreadyRated = localStorage.getItem(conversationKey) === 'true';
              
              if (hasAlreadyRated) {
                this.showRatingButton = false;
              } else {
                this.showRatingButton = true;
              }
            } else {
              this.showRatingButton = false;
            }
          } else {
            this.showRatingButton = false;
          }
        } else {
          this.showRatingButton = false;
        }
      },
      error: (error) => {
        this.showRatingButton = false;
      }
    });
  }



  /**
   * Debug socket connection for troubleshooting
   */
  debugSocket() {
    
    if (this.selectedChat) {
      
      // Test socket emit
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
      
      if (!emitResult) {
        this.socketService.connect();
      }
    } else {
    }
    
    // Test server connection
    fetch(`${environment.socketUrl}/health`)
      .then(response => response.json())
      .then(data => {
      })
      .catch(error => {
      });
    
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
    this.selectedAttachment = {
      ...attachment,
      url: this.getAttachmentUrl(attachment)
    };
    this.showAttachmentModal = true;
  }

  /**
   * Close attachment modal
   */
  closeAttachmentModal() {
    this.showAttachmentModal = false;
    this.selectedAttachment = null;
  }

  getAttachmentUrl(attachment: Attachment): string {
    if (attachment?.url) {
      const url = String(attachment.url);
      if (!/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
        return url;
      }
    }

    if (attachment?.path) {
      if (attachment.path.startsWith('http://') || attachment.path.startsWith('https://')) {
        return attachment.path;
      }
      const stripped = attachment.path
        .replace(/^\/?api\/uploads[\/\\]/, '')
        .replace(/^\/?uploads[\/\\]/, '')
        .replace(/^\/+/, '');
      return `${this.attachmentsBaseUrl}${stripped}`;
    }

    return '';
  }

  private normalizeAttachments(attachments: any[]): Attachment[] {
    if (!Array.isArray(attachments)) {
      return [];
    }

    return attachments.map((attachment: any) => {
      const normalized: Attachment = {
        type: attachment?.type === 'video' ? 'video' : 'image',
        path: attachment?.path || '',
        name: attachment?.name,
        size: attachment?.size,
        url: attachment?.url
      };

      normalized.url = this.getAttachmentUrl(normalized);
      return normalized;
    });
  }

  /**
   * Open user report modal
   */
  openUserReportModal() {
    if (!this.selectedChat) {
      return;
    }

    const reportedUserInfo = this.getReportedUserInfo();
    if (!reportedUserInfo) {
      this.notificationService.showError(
        'Report Error', 
        'Unable to identify the user to report'
      );
      return;
    }

    // Ensure we have the latest product sale status before showing report options
    const convId = this.selectedChat.conversation_id;
    const productId = this.selectedChat.product_id;

    this.apiService.getProductById(productId).subscribe({
      next: (res) => {
        const product = (res && res.data && Array.isArray(res.data) && res.data.length > 0) ? res.data[0] : res;
        this.productSaleStatus[convId] = product?.sale_status || 'available';

        // Reset form and set default report type based on sale status
        this.resetUserReportForm();
        if (!this.isPostPurchaseAllowed(convId)) {
          this.userReportForm.report_type = 'user_behavior';
        }
        this.showUserReportModal = true;
      },
      error: () => {
        // On error, fall back to safe default: only user behavior allowed
        this.productSaleStatus[convId] = this.productSaleStatus[convId] || 'available';
        this.resetUserReportForm();
        this.userReportForm.report_type = 'user_behavior';
        this.showUserReportModal = true;
      }
    });
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
          this.notificationService.showError(
            'Submission Failed',
            'An error occurred while submitting your report. Please try again.'
          );
          this.isSubmittingReport = false;
        }
      });
    } catch (error) {
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

  /**
   * Determine if post-purchase reporting should be allowed for a conversation
   */
  isPostPurchaseAllowed(conversationId?: number): boolean {
    const convId = conversationId ?? this.selectedChat?.conversation_id;
    if (!convId) return false;
    const status = this.productSaleStatus[convId];
    return status === 'sold' || status === 'traded';
  }
}
