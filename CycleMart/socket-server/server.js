const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
// Allow both Angular dev origin (4200) and Apache-served origin (http://localhost)
const io = socketIo(server, {
  cors: {
    // origin: ["http://localhost:4200", "http://localhost", "http://localhost:3000"],
     origin: ["http://api.cyclemart.shop/CycleMart-api/api", "http://localhost", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Store connected users
const connectedUsers = new Map();
const adminUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Handle user authentication
  socket.on('authenticate', (userData) => {
    if (userData.userId) {
      connectedUsers.set(userData.userId, {
        socketId: socket.id,
        userId: userData.userId,
        username: userData.username,
        role: userData.role,
        connectedAt: new Date()
      });
      
      // Join user to their personal room
      socket.join(`user_${userData.userId}`);
      
      // If admin, join admin room
      if (userData.role && ['super_admin', 'moderator', 'support'].includes(userData.role)) {
        adminUsers.set(userData.userId, connectedUsers.get(userData.userId));
        socket.join('admin_room');
        console.log(`👨‍💼 Admin ${userData.username} joined admin room`);
      }
      
      console.log(`✅ User authenticated: ${userData.username} (${userData.role})`);
      
      // Notify other admins
      socket.to('admin_room').emit('admin_user_connected', {
        userId: userData.userId,
        username: userData.username,
        role: userData.role
      });
    }
  });

  // Handle joining specific rooms
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`📍 Socket ${socket.id} joined room: ${roomId}`);
  });

  // Handle leaving rooms
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`🚪 Socket ${socket.id} left room: ${roomId}`);
  });

  // Handle private messages
  socket.on('private_message', (data) => {
    const { recipientId, message, senderId } = data;
    
    // Send to recipient's personal room
    io.to(`user_${recipientId}`).emit('private_message', {
      senderId,
      message,
      timestamp: new Date().toISOString()
    });
    
    console.log(`💬 Private message from ${senderId} to ${recipientId}`);
  });

  // Handle real-time notifications
  socket.on('notification', (notification) => {
    const { recipientId, type, message, data } = notification;
    
    if (recipientId) {
      // Send to specific user
      io.to(`user_${recipientId}`).emit('notification', {
        type,
        message,
        data,
        timestamp: new Date().toISOString()
      });
    } else {
      // Broadcast to all connected users
      socket.broadcast.emit('notification', {
        type,
        message,
        data,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🔔 Notification sent: ${type} - ${message}`);
  });

  // Handle admin actions
  socket.on('admin_action', (action) => {
    const { type, targetUserId, adminId, data } = action;
    
    // Notify all admins
    io.to('admin_room').emit('admin_action', {
      type,
      targetUserId,
      adminId,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Notify target user if specified
    if (targetUserId) {
      io.to(`user_${targetUserId}`).emit('admin_notification', {
        type,
        message: `Admin action: ${type}`,
        data,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`👨‍💼 Admin action: ${type} by admin ${adminId}`);
  });

  // Handle product updates
  socket.on('product_update', (update) => {
    const { type, productId, userId, data } = update;
    
    // Notify all admins about product changes
    io.to('admin_room').emit('product_update', {
      type,
      productId,
      userId,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Notify product owner
    if (userId) {
      io.to(`user_${userId}`).emit('product_notification', {
        type,
        productId,
        message: `Your product has been ${type}`,
        data,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🛍️ Product update: ${type} for product ${productId}`);
  });

  // Handle product status changes (for rating notifications)
  socket.on('product_status_change', (statusData) => {
    const { conversation_id, product_id, product_name, status, changed_by, other_user_id } = statusData;
    
    console.log(`🔄 Product status change: ${product_name} marked as ${status} by user ${changed_by}`);
    
    // Notify the other party (buyer) in real-time
    if (other_user_id) {
      io.to(`user_${other_user_id}`).emit('product_status_changed', {
        conversation_id,
        product_id,
        product_name,
        status,
        changed_by,
        other_user_id,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📬 Notified user ${other_user_id} about product status change`);
    }
    
    // Also notify admins for monitoring
    io.to('admin_room').emit('product_status_update', {
      conversation_id,
      product_id,
      product_name,
      status,
      changed_by,
      other_user_id,
      timestamp: new Date().toISOString()
    });
  });

  // Handle messaging events
  socket.on('send_message', (messageData) => {
    const { recipient_id, conversation_id, message_text, sender_name } = messageData;
    if (!recipient_id) {
      console.warn('⚠️ send_message received without recipient_id', messageData);
      return;
    }

    console.log(`💌 Message from ${messageData.sender_id} to ${recipient_id} in conversation ${conversation_id}`);

    // Emit to recipient room
    io.to(`user_${recipient_id}`).emit('new_message', {
      ...messageData,
      timestamp: new Date().toISOString()
    });

    // Echo back to sender so their UI updates instantly if not already
    if (messageData.sender_id) {
      io.to(`user_${messageData.sender_id}`).emit('new_message', {
        ...messageData,
        is_echo: true,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle message read status
  socket.on('messages_read', (readData) => {
    const { conversation_id, reader_id, other_user_id } = readData;
    
    console.log(`✅ Messages read in conversation ${conversation_id} by user ${reader_id}`);
    
    // Notify the other user that their messages were read
    if (other_user_id) {
      io.to(`user_${other_user_id}`).emit('messages_read', {
        conversation_id,
        reader_id,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle typing indicators
  socket.on('typing', (typingData) => {
    const { conversation_id, user_id, typing } = typingData;
    
    // Broadcast typing status to other users in the conversation
    socket.to(`conversation_${conversation_id}`).emit('user_typing', {
      conversation_id,
      user_id,
      typing,
      timestamp: new Date().toISOString()
    });
  });

  // Handle real-time admin monitoring updates
  socket.on('admin_created', (adminData) => {
    io.to('admin_room').emit('admin_list_update', {
      type: 'admin_created',
      data: adminData,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('admin_updated', (adminData) => {
    io.to('admin_room').emit('admin_list_update', {
      type: 'admin_updated',
      data: adminData,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('admin_deleted', (adminData) => {
    io.to('admin_room').emit('admin_list_update', {
      type: 'admin_deleted',
      data: adminData,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('❌ User disconnected:', socket.id, 'Reason:', reason);
    
    // Find and remove user from connected users
    let disconnectedUser = null;
    for (const [userId, userData] of connectedUsers.entries()) {
      if (userData.socketId === socket.id) {
        disconnectedUser = userData;
        connectedUsers.delete(userId);
        adminUsers.delete(userId);
        break;
      }
    }
    
    if (disconnectedUser) {
      // Notify other admins if an admin disconnected
      if (disconnectedUser.role && ['super_admin', 'moderator', 'support'].includes(disconnectedUser.role)) {
        socket.to('admin_room').emit('admin_user_disconnected', {
          userId: disconnectedUser.userId,
          username: disconnectedUser.username,
          role: disconnectedUser.role
        });
      }
      console.log(`👋 ${disconnectedUser.username} disconnected`);
    }
  });
});

// REST API endpoints
app.get('/api/connected-users', (req, res) => {
  const users = Array.from(connectedUsers.values()).map(user => ({
    userId: user.userId,
    username: user.username,
    role: user.role,
    connectedAt: user.connectedAt
  }));
  
  res.json({
    status: 'success',
    data: {
      totalConnected: users.length,
      users: users
    }
  });
});

app.get('/api/admin-users', (req, res) => {
  const admins = Array.from(adminUsers.values()).map(admin => ({
    userId: admin.userId,
    username: admin.username,
    role: admin.role,
    connectedAt: admin.connectedAt
  }));
  
  res.json({
    status: 'success',
    data: {
      totalAdmins: admins.length,
      admins: admins
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Socket.IO server is running',
    connectedUsers: connectedUsers.size,
    adminUsers: adminUsers.size,
    uptime: process.uptime()
  });
});

// Emit endpoint for PHP backend to trigger Socket.IO events
app.post('/emit', (req, res) => {
  try {
    const { room, event, data } = req.body;
    
    if (!room || !event || !data) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: room, event, data'
      });
    }
    
    console.log(`🔴 Backend emit request - Room: ${room}, Event: ${event}`);
    
    // Emit to the specified room
    io.to(room).emit(event, data);
    
    res.json({
      status: 'success',
      message: `Event '${event}' emitted to room '${room}'`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in /emit endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`👥 Connected users API: http://localhost:${PORT}/api/connected-users`);
  console.log(`👨‍💼 Admin users API: http://localhost:${PORT}/api/admin-users`);
});

module.exports = { app, server, io };