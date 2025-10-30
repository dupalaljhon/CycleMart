import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, HostListener, OnDestroy } from '@angular/core';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../api/api.service';
import { SocketService } from '../services/socket.service';
import { NotificationService } from '../services/notification.service';
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
  buyer_id?: number;
  seller_id?: number;
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
  showChatWindow: boolean = false;
  currentUserId: number = 0;
  isLoading: boolean = true;
  showStatusDropdown: boolean = false;
  showArchivedMessages: boolean = false;
  archivedMessages: Chat[] = [];
  showRatingModal: boolean = false;
  showRatingButton: boolean = false; // Track if rating button should be visible
  
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

  constructor(
    private apiService: ApiService,
    private socketService: SocketService,
    private route: ActivatedRoute,
    private notificationService: NotificationService
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
              messages: []
            }));
            
            console.log('📋 Loaded conversations:', this.messages.map(c => ({
              id: c.conversation_id,
              other_user: c.other_user_name,
              product: c.product_name
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
    console.log('🔄 Loading messages for conversation:', conversationId);
    this.apiService.getConversationMessages(conversationId).subscribe({
      next: (response) => {
        console.log('📨 Messages response:', response);
        if (response.status === 'success' && this.selectedChat) {
          this.selectedChat.messages = response.data.map((msg: any) => ({
            message_id: msg.message_id,
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            sender_avatar: this.getAvatarUrl(msg.sender_avatar, msg.sender_name),
            message_text: msg.message_text,
            created_at: msg.created_at,
            is_read: msg.is_read,
            attachments: msg.attachments || []
          }));
          
          console.log('📨 Loaded messages count:', this.selectedChat.messages.length);
          
          // Log first few messages for debugging
          if (this.selectedChat.messages.length > 0) {
            console.log('📨 First message:', this.selectedChat.messages[0]);
            console.log('📨 Recent messages:', this.selectedChat.messages.slice(0, 3));
          } else {
            console.log('📨 No messages found in conversation');
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
    
    // Find the conversation
    const conversation = this.messages.find(c => c.conversation_id === messageData.conversation_id);
    if (conversation) {
      console.log('✅ Found conversation for incoming message:', conversation.conversation_id);
      
      // Update last message info
      conversation.last_message = messageData.message_text;
      conversation.last_message_time = 'Just now';
      
      // If sender is not current user, increment unread count
      if (messageData.sender_id !== this.currentUserId) {
        conversation.unread_count++;
        console.log('📬 Incremented unread count for conversation:', conversation.conversation_id);
      }
      
      // If this conversation is currently selected, add message to the chat
      if (this.selectedChat && this.selectedChat.conversation_id === messageData.conversation_id) {
        console.log('💬 Adding message to current chat window');
        this.selectedChat.messages.push({
          message_id: messageData.message_id,
          sender_id: messageData.sender_id,
          sender_name: messageData.sender_name,
          sender_avatar: messageData.sender_avatar,
          message_text: messageData.message_text,
          created_at: messageData.created_at,
          is_read: false,
          attachments: messageData.attachments || []
        });
        
        // Mark as read if conversation is active
        this.markMessagesAsRead(messageData.conversation_id);
        
        // Only auto-scroll if user is near bottom or if it's their own message
        if (this.isNearBottom || messageData.sender_id === this.currentUserId) {
          setTimeout(() => {
            this.shouldAutoScroll = true;
          }, 100);
        }
      } else {
        console.log('📝 Message added to conversation list but not to current chat window');
      }
      
      // Move conversation to top
      this.moveConversationToTop(conversation);
    } else {
      console.warn('❌ No conversation found for incoming message:', messageData.conversation_id);
    }
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
      other_name: c.other_user_name
    })));
    
    // Check if this status change affects the current user and conversation
    if (data.conversation_id && data.status && (data.status === 'sold' || data.status === 'traded')) {
      console.log('✅ Status is sold/traded, checking if this affects current user...');
      
      // Find the conversation that was affected
      const affectedConversation = this.messages.find(conv => conv.conversation_id === data.conversation_id);
      console.log('🔍 Found affected conversation:', affectedConversation);
      
      // Convert IDs to same type for comparison
      const currentUserId = parseInt(this.currentUserId.toString());
      const targetUserId = parseInt(data.other_user_id.toString());
      
      console.log('🔢 Parsed IDs - Current:', currentUserId, 'Target:', targetUserId, 'Match:', currentUserId === targetUserId);
      
      if (affectedConversation && currentUserId === targetUserId) {
        console.log('🎯 This user is the buyer, automatically showing rating modal');
        
        // Select this conversation if it's not already selected
        if (!this.selectedChat || this.selectedChat.conversation_id !== data.conversation_id) {
          console.log('📱 Auto-selecting the affected conversation');
          const conversationIndex = this.messages.findIndex(conv => conv.conversation_id === data.conversation_id);
          if (conversationIndex !== -1) {
            this.selectChat(conversationIndex);
          }
        }
        
        // Show rating button for this conversation (buyer only)
        this.showRatingButton = true;
        console.log('⭐ Rating button is now visible for buyer');
        
        // Automatically open rating modal after a short delay
        setTimeout(() => {
          console.log('⏰ Checking if user has already rated...');
          // Check if user hasn't already rated this transaction
          this.checkIfAlreadyRated(data.conversation_id).then((alreadyRated) => {
            console.log('📊 Already rated result:', alreadyRated);
            if (!alreadyRated) {
              console.log('🌟 Automatically opening rating modal');
              // Automatically show the rating modal
              this.showRatingModal = true;
            } else {
              console.log('⚠️ User has already rated this transaction');
            }
          }).catch((error) => {
            console.error('❌ Error checking rating status:', error);
            // If there's an error checking, still show the modal
            this.showRatingModal = true;
          });
        }, 1000); // Short delay to let conversation selection complete
        
      } else {
        console.log('❌ This status change does not affect current user');
        console.log('   - Affected conversation exists:', !!affectedConversation);
        console.log('   - User ID match (parsed):', currentUserId === targetUserId);
        console.log('   - Current user ID:', currentUserId);
        console.log('   - Target user ID:', targetUserId);
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
            // Add message to local chat
            const newMessage: ChatMessage = {
              message_id: response.data.message_id,
              sender_id: this.currentUserId,
              sender_name: localStorage.getItem('username') || 'You',
              sender_avatar: localStorage.getItem('profile_image') || '',
              message_text: originalMessage,
              attachments: response.data.attachments || [],
              created_at: response.data.created_at,
              is_read: false
            };

            this.selectedChat!.messages.push(newMessage);

            // Update conversation info
            const lastMessageText = originalMessage || (response.data.attachments?.length > 0 ? `Sent ${response.data.attachments.length} attachment(s)` : 'Message');
            this.selectedChat!.last_message = lastMessageText;
            this.selectedChat!.last_message_time = 'Just now';
            
            // Move conversation to top
            this.moveConversationToTop(this.selectedChat!);

            // Emit socket event for real-time messaging
            console.log('📡 Checking socket connection for real-time messaging...');
            console.log('🔗 Socket connected:', this.socketService.isConnected());
            
            if (this.socketService.isConnected()) {
              const messageToEmit = {
                ...response.data,
                recipient_id: this.selectedChat!.other_user_id,
                message_text: originalMessage,
                sender_name: localStorage.getItem('username') || 'User'
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
            }, 100);

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
      // If it's a full URL, return as is
      if (profileImage.startsWith('http')) {
        return profileImage;
      }
      // If it's a relative path, prepend the API base URL
      return this.apiService.baseUrl.replace('/api/', '/') + profileImage;
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
        return `http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/${cleanImageName}`;
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

  getTotalUnreadCount(): number {
    return this.messages.reduce((total, chat) => total + chat.unread_count, 0);
  }

  isMyMessage(senderId: number): boolean {
    return senderId === this.currentUserId;
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
    
    const selectedChat = this.selectedChat; // Store reference for type safety
    
    let actionText = '';
    switch (newStatus) {
      case 'sold':
        actionText = 'Mark this product as sold';
        break;
      case 'traded':
        actionText = 'Mark this product as traded';
        break;
      case 'reserved':
        actionText = 'Reserve this item';
        break;
      case 'available':
        actionText = 'Mark this product as available again';
        break;
    }
    
    if (confirm(`${actionText}?`)) {
      const updateData = {
        product_id: selectedChat.product_id,
        sale_status: newStatus,
        uploader_id: this.currentUserId,
        for_type: 'sale' // Default for_type since it's required
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
            
            // Log the status change
            console.log('Product status updated:', {
              product_id: selectedChat.product_id,
              product_name: selectedChat.product_name,
              new_status: newStatus,
              timestamp: new Date().toISOString(),
              user_id: this.currentUserId
            });

            // Show rating modal to the other party when item is marked as sold or traded
            // The person who marks the status is typically the seller
            // The other person in the conversation (buyer) should get the rating opportunity
            if ((newStatus === 'sold' || newStatus === 'traded') && this.selectedChat) {
              // Since the current user just marked the status, we should notify the other party
              console.log('🚀 Status marked by user:', this.currentUserId, 'Other party:', selectedChat.other_user_id);
              
              this.notificationService.showInfo(
                'Transaction Complete',
                `The buyer will be notified and can now rate their experience.`
              );
              
              // Emit real-time notification to the other party via socket
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
                
                console.log('📡 Emitting product status change via socket:', statusChangeData);
                this.socketService.emit('product_status_change', statusChangeData);
                
                // Add confirmation that emit was called
                console.log('✅ Socket emit called successfully');
              } else {
                console.warn('⚠️ Socket not connected, cannot send real-time notification');
                console.log('🔄 Attempting to reconnect socket...');
                // Try to reconnect socket
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
          console.error('Error updating product status:', error);
          this.notificationService.showError(
            'Update Failed',
            'Failed to update product status. Please check your connection and try again.'
          );
        }
      });
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
              messages: []
            }));
            
            console.log('📋 Loaded archived conversations:', this.archivedMessages.map(c => ({
              id: c.conversation_id,
              other_user: c.other_user_name,
              product: c.product_name
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
   * Open rating modal
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
    
    console.log('✅ Rating process completed - button hidden');
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
   * Check if current user is the product owner (seller)
   */
  isProductOwner(): boolean {
    if (!this.selectedChat) return false;
    
    // In the conversation context, we need to determine who is the product owner
    // This can be complex, so for now we'll use a simple approach:
    // If the current user ID matches the seller_id or if other_user_id indicates buyer role
    // We'll add logic later when we have more conversation structure details
    return true; // For now, allow anyone to change status - will be restricted by backend
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
    if (!this.selectedChat) return;

    // Check if there's already a rating for this conversation
    this.apiService.getConversationRating(this.selectedChat.conversation_id, this.currentUserId).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data && response.data.length === 0) {
          // No rating exists yet, check if product was sold/traded recently
          this.checkProductStatus();
        } else {
          console.log('Rating already exists for this conversation');
          // Hide rating button if rating already exists
          this.showRatingButton = false;
        }
      },
      error: (error) => {
        console.error('Error checking conversation rating:', error);
        // Continue to check product status even if rating check fails
        this.checkProductStatus();
      }
    });
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
   * Check product status and show rating modal if appropriate
   */
  private checkProductStatus() {
    if (!this.selectedChat) return;

    // Get product details to check current status
    this.apiService.getProductById(this.selectedChat.product_id).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data && response.data.length > 0) {
          const product = response.data[0];
          
          // Check if product is sold or traded and current user is not the seller (i.e., is the buyer)
          if ((product.sale_status === 'sold' || product.sale_status === 'traded') && 
              product.uploader_id !== this.currentUserId) {
            
            // Show rating button for buyer
            this.showRatingButton = true;
            
            console.log('⭐ Product is sold/traded and user is buyer - rating star button available');
            console.log('📊 Product details:', {
              sale_status: product.sale_status,
              uploader_id: product.uploader_id,
              current_user_id: this.currentUserId,
              is_buyer: product.uploader_id !== this.currentUserId
            });
          } else {
            // Hide rating button if not applicable
            this.showRatingButton = false;
            console.log('❌ Rating button hidden - user is seller or product not sold/traded');
          }
        } else {
          // Hide rating button if product not found
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
}
