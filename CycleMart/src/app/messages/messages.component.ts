import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

interface Chat {
  id: number;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  avatar: string;
  isOnline: boolean;
  unreadCount: number;
  chat: ChatMessage[];
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [SidenavComponent, CommonModule, FormsModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  
  messages: Chat[] = [
    { 
      id: 1,
      name: 'Sarah Johnson', 
      lastMessage: 'Is the mountain bike still available?', 
      lastMessageTime: '2 min ago',
      avatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=6BA3BE&color=fff',
      isOnline: true,
      unreadCount: 2,
      chat: [
        { sender: 'other', text: 'Hi! I\'m interested in your mountain bike listing.', timestamp: '10:30 AM', status: 'read' },
        { sender: 'me', text: 'Hello! Yes, it\'s still available. Would you like to see more photos?', timestamp: '10:32 AM', status: 'read' },
        { sender: 'other', text: 'That would be great! Also, is the price negotiable?', timestamp: '10:35 AM', status: 'read' },
        { sender: 'me', text: 'I\'ll send you some detailed photos. The price is slightly negotiable.', timestamp: '10:40 AM', status: 'delivered' },
        { sender: 'other', text: 'Is the mountain bike still available?', timestamp: '11:15 AM', status: 'sent' }
      ]
    },
    { 
      id: 2,
      name: 'Mike Chen', 
      lastMessage: 'Thanks for the quick response!', 
      lastMessageTime: '1 hour ago',
      avatar: 'https://ui-avatars.com/api/?name=Mike+Chen&background=34D399&color=fff',
      isOnline: false,
      unreadCount: 0,
      chat: [
        { sender: 'other', text: 'Hello, is the road bike frame still for sale?', timestamp: '9:00 AM', status: 'read' },
        { sender: 'me', text: 'Yes, it is! Are you looking for a specific size?', timestamp: '9:05 AM', status: 'read' },
        { sender: 'other', text: 'I need a 54cm frame. What\'s the condition?', timestamp: '9:10 AM', status: 'read' },
        { sender: 'me', text: 'It\'s in excellent condition, barely used. I have a 54cm available.', timestamp: '9:15 AM', status: 'read' },
        { sender: 'other', text: 'Thanks for the quick response!', timestamp: '10:00 AM', status: 'read' }
      ]
    },
    { 
      id: 3,
      name: 'Alex Rodriguez', 
      lastMessage: 'Can we meet this weekend?', 
      lastMessageTime: '3 hours ago',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Rodriguez&background=F59E0B&color=fff',
      isOnline: true,
      unreadCount: 1,
      chat: [
        { sender: 'other', text: 'Hi! I\'m interested in trading my BMX for your mountain bike.', timestamp: '8:00 AM', status: 'read' },
        { sender: 'me', text: 'Interesting! Can you tell me more about your BMX?', timestamp: '8:05 AM', status: 'read' },
        { sender: 'other', text: 'It\'s a 2022 model, barely used. I can send photos.', timestamp: '8:10 AM', status: 'read' },
        { sender: 'other', text: 'Can we meet this weekend?', timestamp: '8:30 AM', status: 'sent' }
      ]
    },
    { 
      id: 4,
      name: 'Emma Wilson', 
      lastMessage: 'Perfect! I\'ll take it.', 
      lastMessageTime: '5 hours ago',
      avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=8B5CF6&color=fff',
      isOnline: false,
      unreadCount: 0,
      chat: [
        { sender: 'other', text: 'Is the bike helmet still available?', timestamp: '7:00 AM', status: 'read' },
        { sender: 'me', text: 'Yes! It\'s in perfect condition.', timestamp: '7:05 AM', status: 'read' },
        { sender: 'other', text: 'Perfect! I\'ll take it.', timestamp: '7:10 AM', status: 'read' }
      ]
    }
  ];

  selectedChat: Chat | null = this.messages[0];
  newMessage: string = '';
  isTyping: boolean = false;
  isMobile: boolean = false;
  showChatList: boolean = true;
  showChatWindow: boolean = false;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkDeviceSize();
  }

  ngOnInit() {
    this.checkDeviceSize();
    this.scrollToBottom();
    
    // On mobile, start with chat list view
    if (this.isMobile) {
      this.showChatList = true;
      this.showChatWindow = false;
      this.selectedChat = null;
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
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
    this.messages[index].unreadCount = 0;
    
    // On mobile, switch to chat view
    if (this.isMobile) {
      this.showChatList = false;
      this.showChatWindow = true;
    }
    
    this.scrollToBottom();
  }

  backToChatList() {
    if (this.isMobile) {
      this.showChatList = true;
      this.showChatWindow = false;
      this.selectedChat = null;
    }
  }

  deleteChat(index: number) {
    this.messages.splice(index, 1);
    if (this.selectedChat === this.messages[index] || this.messages.length === 0) {
      this.selectedChat = this.messages[0] || null;
      
      // On mobile, go back to chat list if no chats left
      if (this.isMobile && !this.selectedChat) {
        this.showChatList = true;
        this.showChatWindow = false;
      }
    }
  }

  sendMessage() {
    if (this.newMessage.trim() && this.selectedChat) {
      const now = new Date();
      const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      this.selectedChat.chat.push({ 
        sender: 'me', 
        text: this.newMessage,
        timestamp: timestamp,
        status: 'sent'
      });
      this.selectedChat.lastMessage = this.newMessage;
      this.selectedChat.lastMessageTime = 'Just now';
      this.newMessage = '';
      
      // Simulate message delivery after a short delay
      setTimeout(() => {
        if (this.selectedChat) {
          const lastMessage = this.selectedChat.chat[this.selectedChat.chat.length - 1];
          if (lastMessage.sender === 'me') {
            lastMessage.status = 'delivered';
          }
        }
      }, 1000);
    }
  }

  onInputFocus() {
    this.isTyping = true;
  }

  onInputBlur() {
    this.isTyping = false;
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    } catch(err) {}
  }

  getMessageStatusIcon(status: string): string {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      default: return '';
    }
  }

  getMessageStatusColor(status: string): string {
    switch (status) {
      case 'read': return 'text-blue-500';
      case 'delivered': return 'text-gray-400';
      case 'sent': return 'text-gray-300';
      default: return 'text-gray-300';
    }
  }

  getTotalUnreadCount(): number {
    return this.messages.reduce((total, chat) => total + chat.unreadCount, 0);
  }
}
