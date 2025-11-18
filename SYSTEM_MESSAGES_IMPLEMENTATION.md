# System Auto-Generated Messages - Implementation Guide

## Overview
This feature automatically sends system-generated messages when a product's status is updated to "Sold" or "Traded" by the uploader. The message is inserted into the conversation thread with product details and buyer information.

## Message Format

### For Sold Status:
```
The [ProductName] (₱[Price], [SpecialDetails]) was already sold to [BuyerFullName].
```

### For Traded Status:
```
The [ProductName] (₱[Price], [SpecialDetails]) was already traded to [BuyerFullName].
```

### Special Details Include:
- Category (e.g., "Whole Bike", "Bike Parts")
- Brand (e.g., "Giant", custom brand names)
- Condition (e.g., "Brand New", "Used - Good")
- Listing Type (e.g., "Sale", "Trade")

### Example Messages:
```
The Trek Mountain Bike 2023 (₱25,000.00, Category: Whole Bike, Brand: Trek, Condition: Brand New, Type: Sale) was already sold to John Doe.

The Shimano Gear Set (₱3,500.00, Category: Bike Parts, Brand: Shimano, Condition: Used - Good, Type: Trade) was already traded to Jane Smith.
```

## Implementation Details

### Backend (PHP)
**File:** `CycleMart-api/api/modules/post.php`
**Method:** `updateSaleStatus()`

#### How It Works:
1. When product status is updated to 'sold' or 'traded'
2. System finds the active conversation for that product
3. Retrieves product details and buyer information
4. Generates formatted message
5. Inserts message with `sender_id = 0` (system messages)

#### Key Code:
```php
// Find conversation
$conversationSql = "SELECT c.conversation_id, c.buyer_id, u.full_name as buyer_name, 
                          p.product_name, p.price, p.category, p.brand_name, 
                          p.condition_status, p.for_type
                   FROM conversations c
                   JOIN users u ON c.buyer_id = u.id
                   JOIN products p ON c.product_id = p.product_id
                   WHERE c.product_id = :product_id AND c.seller_id = :uploader_id";

// Insert system message
$messageSql = "INSERT INTO messages (conversation_id, sender_id, message_text, created_at) 
              VALUES (:conversation_id, 0, :message_text, NOW())";
```

### Frontend (Angular)
**Files:** 
- `src/app/messages/messages.component.html`
- `src/app/messages/messages.component.ts`

#### Display Styling:
- System messages have special styling with yellow/amber gradient
- Display system icon (checkmark in circle)
- Show "System Notification" label
- Display timestamp
- Message text is shown in `whitespace-pre-wrap` to preserve formatting

#### Key Code:
```html
<div *ngIf="msg.is_system_message" class="w-full max-w-2xl mx-auto animate-fadeIn">
  <div class="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-500 rounded-lg p-4 shadow-md">
    <!-- System icon and message content -->
  </div>
</div>
```

#### Detection Logic:
```typescript
// Messages are identified as system messages when sender_id === 0
const isSystemMessage = msg.sender_id === 0 || msg.sender_id === '0';
```

### Database Structure

#### Messages Table:
```sql
- conversation_id (INT) - Links to conversation
- sender_id (INT) - Set to 0 for system messages
- message_text (TEXT) - The formatted message
- is_system_message (BOOLEAN) - Flag for system messages
- system_message_type (ENUM) - 'sold', 'traded', or 'general'
- created_at (TIMESTAMP) - When message was generated
```

## Trigger Conditions

The system message is automatically sent when:
1. Product uploader/owner updates product status
2. Status is changed to either "sold" or "traded"
3. Active conversation exists for that product
4. Buyer information is available

## API Endpoints

### Update Sale Status (Triggers System Message)
```
POST /api/updateSaleStatus
Body: {
  product_id: number,
  uploader_id: number,
  sale_status: 'sold' | 'traded',
  for_type: string
}
```

## Features

### ✅ Implemented:
- [x] Automatic message generation on status update
- [x] Product details included (name, price, category, brand, condition)
- [x] Buyer full name included
- [x] Saved as system message (sender_id = 0)
- [x] Special styling in UI (yellow/amber gradient)
- [x] Proper formatting with all details
- [x] Reusable function for future notifications
- [x] Socket.IO real-time delivery
- [x] Database persistence

### 📋 Message Flow:
1. Uploader clicks "Mark as Sold" or "Mark as Traded"
2. Backend updates product status
3. Backend generates system message
4. Message saved to database
5. Socket.IO broadcasts to participants
6. Frontend displays with special styling
7. Both users see the notification in their chat

## Testing

### Test Scenario:
1. Create a product listing
2. Start a conversation with another user
3. Send some messages back and forth
4. As the uploader, mark product as "Sold"
5. **Expected Result:** System message appears in chat thread with format:
   ```
   The [ProductName] (₱[Price], [Details]) was already sold to [BuyerName].
   ```

### Verification Points:
- ✅ Message appears automatically
- ✅ Correct format with all details
- ✅ Special system message styling
- ✅ Visible to both parties
- ✅ Timestamp is accurate
- ✅ No duplicate messages

## Technical Notes

### sender_id = 0 Convention:
- `sender_id = 0` is reserved exclusively for system-generated messages
- Regular users cannot send messages with sender_id = 0
- Backend validates sender authorization (except for system messages)

### Error Handling:
- If conversation doesn't exist: Message is not sent (logged as warning)
- If product details are missing: Uses "No additional details"
- If buyer name is missing: Falls back to "Unknown User"

### Socket.IO Integration:
System messages are automatically broadcast via Socket.IO like regular messages, ensuring real-time delivery to both conversation participants.

### Future Enhancements (Optional):
- Add system messages for other events (product archived, price updated)
- Rich formatting with product images in system messages
- Click-to-view-product functionality in system messages
- Multi-language support for system messages
- Admin-triggered system announcements

## Maintenance

### Logging:
All system message operations are logged with detailed information:
- `🟢 PRODUCT MARKED AS SOLD/TRADED - SENDING SYSTEM MESSAGE`
- `📋 Found conversation for system message`
- `✅ SYSTEM MESSAGE SENT SUCCESSFULLY! Message ID: [id]`

### Monitoring:
Check logs for:
- Failed message insertions
- Missing conversations
- Database errors during system message creation

## Support

For issues or questions:
1. Check backend logs for system message generation
2. Verify conversation exists for the product
3. Confirm buyer participated in conversation
4. Ensure database has system message columns

---

**Last Updated:** November 17, 2025
**Version:** 1.0
**Status:** Production Ready ✅
