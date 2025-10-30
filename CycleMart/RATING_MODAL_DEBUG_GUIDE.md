# Rating Modal Debug Guide

## Issue: Rating modal not appearing for buyer when seller marks product as sold/traded

## Debugging Steps:

### 1. Check Browser Console Logs

When testing, open the browser developer tools (F12) and look for these specific log messages:

#### On Seller Side (when marking as sold/traded):
```
🚀 Status marked by user: [seller_id] Other party: [buyer_id]
📡 Emitting product status change via socket: [status_data_object]
✅ Socket emit called successfully
```

#### On Buyer Side (should receive the event):
```
🔔 Product status change event received via socket: [data_object]
🔄 Product status change received: [data_object]
🆔 Current user ID: [buyer_id]
🎯 Target user ID: [buyer_id]
✅ Status is sold/traded, checking if this affects current user...
🔍 Found affected conversation: [conversation_object]
🎯 This user is the buyer, showing rating opportunity
📱 Auto-selecting the affected conversation
⏰ Checking if user has already rated...
📊 Already rated result: false
🌟 Opening rating modal automatically
```

### 2. Common Issues and Solutions:

#### Issue 1: Socket not connected
**Symptoms:** You see `⚠️ Socket not connected, cannot send real-time notification`
**Solution:** 
- Make sure socket server is running: `cd socket-server && npm start`
- Check if socket server is on port 3000
- Verify socket connection in browser console

#### Issue 2: User IDs don't match
**Symptoms:** You see `❌ This status change does not affect current user`
**Solution:**
- Check that `data.other_user_id === this.currentUserId` is true
- Verify the conversation data has correct buyer/seller IDs
- Check localStorage for correct user ID: `localStorage.getItem('id')`

#### Issue 3: Conversation not found
**Symptoms:** You see `🔍 Found affected conversation: null`
**Solution:**
- Make sure both users have loaded their conversations
- Check that conversation_id matches between seller and buyer
- Refresh the messages list

#### Issue 4: Already rated
**Symptoms:** You see `⚠️ User has already rated this transaction`
**Solution:**
- Check the ratings table in database
- Clear existing rating if testing: `DELETE FROM ratings WHERE conversation_id = [id]`

### 3. Manual Testing Checklist:

1. ✅ Socket server is running (`npm start` in socket-server folder)
2. ✅ Both users are logged in and authenticated
3. ✅ Both users have the conversation loaded in their messages
4. ✅ Seller marks product as "sold" or "traded" using dropdown
5. ✅ Check browser console for socket emit logs
6. ✅ Check buyer's browser console for receive logs
7. ✅ Verify buyer sees notification popup
8. ✅ Verify rating modal appears automatically

### 4. Database Verification:

Check these tables to ensure data consistency:

```sql
-- Check conversation data
SELECT * FROM conversations WHERE conversation_id = [your_conversation_id];

-- Check if rating already exists
SELECT * FROM ratings WHERE conversation_id = [your_conversation_id];

-- Check product status
SELECT * FROM products WHERE product_id = [your_product_id];
```

### 5. Quick Test Commands:

Open browser console and run these to test:

```javascript
// Check current user ID
console.log('Current user:', localStorage.getItem('id'));

// Check socket connection
console.log('Socket connected:', socketService.isConnected());

// Manually trigger rating modal (for testing)
// (Run this in buyer's browser console)
document.querySelector('app-messages').showRatingModal = true;
```

### 6. Network Tab Debugging:

1. Open Network tab in developer tools
2. Look for socket.io connections
3. Check for `product_status_change` events being sent
4. Verify WebSocket upgrade is successful

### 7. Force Show Rating Modal (Emergency Test):

If you want to force show the rating modal for testing, add this temporary button to the messages component HTML:

```html
<!-- Temporary debug button - remove after testing -->
<button (click)="showRatingModal = true" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: red; color: white;">
  Force Show Rating Modal
</button>
```

This will help isolate whether the issue is with the socket communication or the modal itself.