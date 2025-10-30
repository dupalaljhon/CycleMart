# Real-time Messaging System - Test Guide

## Overview
The CycleMart messaging system now supports real-time communication using Socket.IO with database integration.

## Components Implemented

### 1. Socket.IO Server
- **Location**: `socket-server/server.js`
- **Port**: 3000
- **Features**: 
  - User authentication
  - Room management for conversations
  - Real-time message broadcasting
  - Admin monitoring capabilities

### 2. Backend API
- **Location**: `CycleMart-api/api/`
- **Endpoints**:
  - `GET /conversations/{user_id}` - Get user conversations
  - `GET /messages/{conversation_id}` - Get conversation messages
  - `POST /conversation` - Create new conversation
  - `POST /message` - Send message
  - `PUT /messages/read` - Mark messages as read

### 3. Angular Frontend
- **Component**: `src/app/messages/messages.component.ts`
- **Service**: `src/app/services/socket.service.ts`
- **API Service**: `src/app/api/api.service.ts`

## Database Schema

### conversations table
- conversation_id (primary key)
- product_id (foreign key to products)
- user1_id (foreign key to users)
- user2_id (foreign key to users)
- created_at, updated_at

### messages table
- message_id (primary key)
- conversation_id (foreign key to conversations)
- sender_id (foreign key to users)
- message_text
- is_read (boolean)
- created_at

## How to Test

### 1. Start Socket.IO Server
```bash
cd socket-server
node server.js
```
Server will run on http://localhost:3000

### 2. Start Angular Application
```bash
ng serve
```
Navigate to http://localhost:4200

### 3. Test Real-time Features
1. Open two browser windows/tabs
2. Login with different users
3. Navigate to `/messages` on both
4. Send messages between users
5. Observe real-time message delivery

### 4. Features to Test
- ✅ Load conversations from database
- ✅ Display product information in chat list
- ✅ Real-time message sending/receiving
- ✅ Message read status updates
- ✅ Unread message counting
- ✅ Avatar and user information display
- ✅ Mobile responsive design

## Socket Events

### Client → Server
- `authenticate` - User authentication
- `send_message` - Send a message
- `messages_read` - Mark messages as read

### Server → Client
- `new_message` - Receive new message
- `messages_read` - Messages marked as read
- `user_connected` - User came online
- `user_disconnected` - User went offline

## API Integration

### MessagesComponent Methods
- `loadConversations()` - Fetch user conversations
- `loadMessages(conversationId)` - Fetch conversation messages
- `sendMessage()` - Send new message
- `markMessagesAsRead()` - Mark messages as read
- `handleIncomingMessage()` - Process real-time messages

### Socket Integration
- Automatic connection on component init
- Real-time message broadcasting
- Read receipt notifications
- Connection status management

## Production Checklist
- [ ] Configure Socket.IO with proper CORS settings
- [ ] Set up SSL for secure WebSocket connections
- [ ] Implement message encryption for sensitive data
- [ ] Add message persistence and offline message queue
- [ ] Configure database connection pooling
- [ ] Add rate limiting for message sending
- [ ] Implement typing indicators
- [ ] Add file/image sharing capabilities
- [ ] Set up message retention policies
- [ ] Add push notifications for mobile

## Troubleshooting

### Common Issues
1. **Socket connection fails**: Check if server is running on port 3000
2. **Messages not loading**: Verify API endpoints and database connection
3. **Real-time not working**: Check Socket.IO client connection
4. **Avatar images not showing**: Verify image URLs and CORS settings

### Debug Commands
```bash
# Check Socket.IO server status
curl http://localhost:3000/health

# Check connected users
curl http://localhost:3000/api/connected-users

# Check Angular build
ng build --configuration development
```

## Next Steps
1. Add typing indicators
2. Implement file sharing
3. Add message search functionality
4. Create admin monitoring dashboard
5. Add push notifications
6. Implement message encryption