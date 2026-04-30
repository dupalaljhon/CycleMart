# CycleMart Socket.IO Server

This is the real-time Socket.IO server for CycleMart application, providing real-time features like notifications, admin monitoring, messaging, and live updates.

## Features

- 🔔 **Real-time Notifications** - Instant notifications for users and admins
- 👨‍💼 **Admin Monitoring** - Live admin actions and user management
- 💬 **Private Messaging** - Direct messages between users
- 🛍️ **Product Updates** - Real-time product status changes
- 📊 **Live Statistics** - Real-time connected users and admin tracking
- 🔐 **Room-based Communication** - Secure user and admin rooms

## Installation

1. Navigate to the socket-server directory:
```bash
cd socket-server
```

2. Install dependencies:
```bash
npm install
```

## Running the Server

### Development Mode (with auto-restart):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on port 3000 by default.

## API Endpoints

### Health Check
- **GET** `/health` - Server health status
- **Response**: Server status, uptime, and connected user counts

### Connected Users
- **GET** `/api/connected-users` - List all connected users
- **Response**: Array of connected users with their details

### Admin Users
- **GET** `/api/admin-users` - List all connected admin users
- **Response**: Array of connected admin users

## Socket Events

### Client → Server Events

#### Authentication
```javascript
socket.emit('authenticate', {
  userId: '123',
  username: 'john_doe',
  role: 'user' // or 'super_admin', 'moderator', 'support'
});
```

#### Join/Leave Rooms
```javascript
socket.emit('join_room', 'room_name');
socket.emit('leave_room', 'room_name');
```

#### Private Messages
```javascript
socket.emit('private_message', {
  recipientId: '456',
  message: 'Hello!',
  senderId: '123'
});
```

#### Notifications
```javascript
socket.emit('notification', {
  recipientId: '456', // optional, if not provided, broadcasts to all
  type: 'info',
  message: 'You have a new notification',
  data: { /* additional data */ }
});
```

#### Admin Actions
```javascript
socket.emit('admin_action', {
  type: 'user_blocked',
  targetUserId: '456',
  adminId: '123',
  data: { reason: 'Violation of terms' }
});
```

#### Product Updates
```javascript
socket.emit('product_update', {
  type: 'approved',
  productId: '789',
  userId: '456',
  data: { /* product details */ }
});
```

### Server → Client Events

#### Connection Status
- `connect` - Socket connected
- `disconnect` - Socket disconnected
- `admin_user_connected` - Admin user connected
- `admin_user_disconnected` - Admin user disconnected

#### Messages & Notifications
- `private_message` - Received private message
- `notification` - General notification
- `admin_notification` - Admin-specific notification
- `product_notification` - Product-related notification

#### Admin Events
- `admin_action` - Admin action performed
- `admin_list_update` - Admin list changed (create/update/delete)

#### Product Events
- `product_update` - Product status changed

## Integration with Angular

### 1. Import the Socket Service
```typescript
import { SocketService } from './services/socket.service';
```

### 2. Inject in Component
```typescript
constructor(private socketService: SocketService) {}
```

### 3. Connect and Authenticate
```typescript
ngOnInit() {
  this.socketService.connect();
  
  // Authenticate user
  this.socketService.emit('authenticate', {
    userId: localStorage.getItem('id'),
    username: localStorage.getItem('username'),
    role: localStorage.getItem('role')
  });
}
```

### 4. Listen for Events
```typescript
// Listen for notifications
this.socketService.onNotification().subscribe(notification => {
  console.log('New notification:', notification);
  // Handle notification
});

// Listen for private messages
this.socketService.onPrivateMessage().subscribe(message => {
  console.log('New message:', message);
  // Handle message
});
```

### 5. Send Events
```typescript
// Send notification
this.socketService.sendNotification({
  type: 'success',
  message: 'Product approved!',
  recipientId: '123'
});

// Send admin action
this.socketService.sendAdminAction({
  type: 'admin_created',
  adminId: localStorage.getItem('admin_id'),
  data: { newAdminData }
});
```

## Environment Configuration

You can configure the server using environment variables:

```bash
PORT=3000                    # Server port
NODE_ENV=production         # Environment mode
```

## Security Considerations

- The server uses CORS configuration for Angular dev server
- Users are authenticated before joining rooms
- Admin actions are logged and broadcast to admin room only
- Private messages are sent to specific user rooms only

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check if the server is running on port 3000
2. **CORS Errors**: Ensure Angular dev server URL is in the CORS configuration
3. **Authentication Issues**: Verify user data is being sent correctly

### Debug Mode

To enable debug mode, set the DEBUG environment variable:
```bash
DEBUG=socket.io:* npm run dev
```

## Production Deployment

For production deployment:

1. Set environment variables:
```bash
NODE_ENV=production
PORT=3000
```

2. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start server.js --name "cyclemart-socket"
```

3. Configure reverse proxy (nginx) if needed:
```nginx
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Contributing

1. Follow the existing code style
2. Add appropriate error handling
3. Document new events and features
4. Test thoroughly before deployment

## License

MIT License - see LICENSE file for details.