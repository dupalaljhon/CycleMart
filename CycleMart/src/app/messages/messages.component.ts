import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidenavComponent } from '../sidenav/sidenav.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  sender: string;
  text: string;
}

interface Chat {
  name: string;
  lastMessage: string;
  chat: ChatMessage[];
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [ SidenavComponent, CommonModule, FormsModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent {
  messages: Chat[] = [
    { name: 'John Doe', lastMessage: 'This is available?', chat: [{ sender: 'other', text: 'This is available?' }, { sender: 'me', text: 'Yes' }] },
    { name: 'John Doe', lastMessage: 'This is available?', chat: [{ sender: 'other', text: 'This is available?' }] },
    { name: 'John Doe', lastMessage: 'This is available?', chat: [{ sender: 'other', text: 'This is available?' }] },
  ];

  selectedChat: Chat | null = this.messages[0];
  newMessage: string = '';

  selectChat(index: number) {
    this.selectedChat = this.messages[index];
  }

  deleteChat(index: number) {
    this.messages.splice(index, 1);
    if (this.selectedChat === this.messages[index]) {
      this.selectedChat = this.messages[0] || null;
    }
  }

  sendMessage() {
    if (this.newMessage.trim() && this.selectedChat) {
      this.selectedChat.chat.push({ sender: 'me', text: this.newMessage });
      this.selectedChat.lastMessage = this.newMessage;
      this.newMessage = '';
    }
  }
}
