# Post-Purchase Features Implementation

## Overview
This document describes two new features implemented to enhance the post-purchase experience in CycleMart:

1. **Conditional Post-Purchase Concern Reporting** - "Post-Purchase Concern" report type only appears when products are marked as sold/traded
2. **Automatic Buyer Confirmation Messages** - System automatically sends personalized messages to buyers when sellers mark products as sold/traded

---

## Feature 1: Conditional Post-Purchase Concern Reporting

### Problem Statement
The "Post-Purchase Concern" report type should only be available to users who have actually purchased or traded for a product. Showing this option for products that are still available doesn't make sense contextually.

### Solution
- Added `productSaleStatus` property to track product's sale_status
- Created `canShowPostPurchaseConcern()` method that returns `true` only when `sale_status` is 'sold' or 'traded'
- Modified HTML template to conditionally render the "Post-Purchase Concern" option using `*ngIf`

### Implementation Details

#### TypeScript Changes (`reports.component.ts`)

**1. Added Product Sale Status Tracking**
```typescript
// Track product sale status for conditional post-purchase concern display
productSaleStatus: string | null = null;
```

**2. Store Sale Status in ngOnInit**
```typescript
// Store product sale_status for conditional post-purchase concern display
this.productSaleStatus = this.prefilledProduct.sale_status || this.prefilledProduct.saleStatus || null;
console.log('🟢 REPORTS: Product sale_status:', this.productSaleStatus);
```

**3. Created Validation Method**
```typescript
// Check if post-purchase concern option should be shown
// Only show when product is sold or traded
canShowPostPurchaseConcern(): boolean {
  const canShow = this.productSaleStatus === 'sold' || this.productSaleStatus === 'traded';
  console.log('🔍 canShowPostPurchaseConcern:', {
    productSaleStatus: this.productSaleStatus,
    canShow: canShow
  });
  return canShow;
}
```

#### HTML Template Changes (`reports.component.html`)

**Modified Report Type Dropdown**
```html
<select [(ngModel)]="reportForm.report_type" 
        name="report_type"
        class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
        required>
  <option value="">Select report type...</option>
  <option value="product">🛍️ Product/Listing</option>
  <option value="user_behavior">👤 User Behavior</option>
  <!-- Post-Purchase Concern only visible when product is sold or traded -->
  <option value="post_purchase_concern" *ngIf="canShowPostPurchaseConcern()">📦 Post-Purchase Concern</option>
</select>
```

### How It Works

1. **Product Selection**: When a user clicks "Report" on a product, the product data (including `sale_status`) is passed to the ReportsComponent via `@Input() prefilledProduct`

2. **Status Detection**: In `ngOnInit()`, the component extracts and stores the product's `sale_status`:
   ```typescript
   this.productSaleStatus = this.prefilledProduct.sale_status || this.prefilledProduct.saleStatus || null;
   ```

3. **Dynamic Status Checking**: When users manually enter a product ID, the component automatically fetches the product's sale_status:
   ```typescript
   onTargetIdentifierChange(): void {
     if (this.reportForm.report_type === 'product' && this.reportForm.target_identifier) {
       const productId = parseInt(this.reportForm.target_identifier);
       if (!isNaN(productId)) {
         this.checkProductSaleStatus(productId);
       }
     }
   }
   ```

4. **Conditional Rendering**: The HTML template calls `canShowPostPurchaseConcern()` which checks:
   - If `productSaleStatus === 'sold'` → Show option
   - If `productSaleStatus === 'traded'` → Show option
   - Otherwise → Hide option

5. **Auto-Correction**: If user selects "Post-Purchase Concern" but product is not sold/traded, the system automatically resets to "Product" report type with an informative message

6. **User Experience**:
   - **Available Products**: User sees only "Product/Listing" and "User Behavior" options
   - **Sold/Traded Products**: User also sees "Post-Purchase Concern" option
   - **Real-time Validation**: Option appears/disappears as user enters different product IDs

### Database Schema Reference

The `products` table includes:
```sql
sale_status ENUM('available', 'sold', 'reserved', 'traded') DEFAULT 'available'
```

### Testing Scenarios

| Scenario | Product Status | Expected Behavior |
|----------|---------------|-------------------|
| Report available product (prefilled) | `available` | Post-Purchase Concern NOT shown |
| Report reserved product (prefilled) | `reserved` | Post-Purchase Concern NOT shown |
| Report sold product (prefilled) | `sold` | Post-Purchase Concern IS shown |
| Report traded product (prefilled) | `traded` | Post-Purchase Concern IS shown |
| Manual entry - available product ID | `available` | Post-Purchase Concern NOT shown after ID entered |
| Manual entry - sold product ID | `sold` | Post-Purchase Concern shown after ID entered |
| Manual entry - invalid product ID | N/A | Post-Purchase Concern NOT shown |
| Select post-purchase then enter available product | `available` | Auto-resets to "Product" report with warning message |

---

## Feature 2: Automatic Buyer Confirmation Messages

### Problem Statement
When a seller marks a product as sold or traded, the buyer should receive an immediate confirmation message with:
- Product name
- Transaction status (sold/traded)
- Product details (price, category, brand, condition, type)
- Rating form prompt

### Solution
Modified the `updateSaleStatus()` method in `post.php` to automatically generate and send personalized confirmation messages to buyers when products are marked as sold/traded.

### Implementation Details

#### PHP Backend Changes (`post.php`)

**Modified System Message Generation**

**BEFORE (Generic System Message)**
```php
$statusText = $sale_status === 'sold' ? 'sold' : 'traded';
$systemMessage = "The " . $conversation['product_name'] . " (₱" . number_format($conversation['price'], 2) . ", " . $specialDetailsText . ") was already " . $statusText . " to " . $conversation['buyer_name'] . ".";
```

**AFTER (Personalized Buyer Message)**
```php
// Create the personalized buyer confirmation message
$statusText = $sale_status === 'sold' ? 'sold' : 'traded';
$systemMessage = "The " . $conversation['product_name'] . " was already " . $statusText . " to you.\n\n";
$systemMessage .= "Product Details:\n";
$systemMessage .= "• Price: ₱" . number_format($conversation['price'], 2) . "\n";
$systemMessage .= "• " . $specialDetailsText . "\n\n";
$systemMessage .= "You may fill up the rating form to complete your transaction.";
```

### Message Format

The auto-generated message follows this structure:

```
The [Product Name] was already [sold/traded] to you.

Product Details:
• Price: ₱[formatted price]
• [Category, Brand, Condition, Type]

You may fill up the rating form to complete your transaction.
```

### Example Messages

**Example 1: Sold Product**
```
The Mountain Bike 29er was already sold to you.

Product Details:
• Price: ₱15,000.00
• Category: Bicycles, Brand: Giant, Condition: Used, Type: For sale

You may fill up the rating form to complete your transaction.
```

**Example 2: Traded Product**
```
The Road Bike Carbon Frame was already traded to you.

Product Details:
• Price: ₱25,000.00
• Category: Bicycles, Brand: Trek, Condition: Excellent, Type: For trade

You may fill up the rating form to complete your transaction.
```

### Message Delivery Flow

1. **Seller Action**: Seller marks product as 'sold' or 'traded' via product management interface

2. **Database Update**: `products.sale_status` is updated to 'sold' or 'traded'

3. **Conversation Lookup**: System queries for the most recent conversation between seller and buyer for that product:
   ```php
   $conversationSql = "SELECT c.conversation_id, c.buyer_id, c.seller_id, 
                             u.full_name as buyer_name, 
                             p.product_name, p.price, p.product_images, p.category, 
                             p.brand_name, p.custom_brand, p.`condition`, p.for_type
                      FROM conversations c
                      JOIN users u ON c.buyer_id = u.id
                      JOIN products p ON c.product_id = p.product_id
                      WHERE c.product_id = :product_id AND c.seller_id = :uploader_id
                      ORDER BY c.created_at DESC LIMIT 1";
   ```

4. **Message Construction**: System builds personalized message with product details

5. **Database Insert**: Message is inserted into `messages` table with `sender_id = 0` (system message):
   ```php
   $messageSql = "INSERT INTO messages (conversation_id, sender_id, message_text, created_at) 
                  VALUES (:conversation_id, 0, :message_text, NOW())";
   ```

6. **Real-time Broadcast**: Message is sent via Socket.IO to both buyer and seller:
   ```php
   $socketData = [
       'conversation_id' => $conversation['conversation_id'],
       'message_id' => $messageId,
       'sender_id' => 0, // System message
       'sender_name' => 'System',
       'message_text' => $systemMessage,
       'is_system_message' => true,
       'system_message_type' => $sale_status,
       'product_status' => $sale_status
   ];
   
   // Emit to buyer and seller rooms
   $this->emitSocketEvent('user_' . $conversation['buyer_id'], 'new_message', $socketData);
   $this->emitSocketEvent('user_' . $conversation['seller_id'], 'new_message', $socketData);
   ```

### Product Details Included

The message automatically extracts and formats:

| Detail | Source Field | Format |
|--------|--------------|--------|
| Price | `products.price` | ₱15,000.00 |
| Category | `products.category` | Category: Bicycles |
| Brand | `products.brand_name` or `custom_brand` | Brand: Giant |
| Condition | `products.condition` | Condition: Used |
| Type | `products.for_type` | Type: For sale |

**Special Brand Handling**:
- If `brand_name = 'no brand'` → Not included
- If `brand_name = 'others'` → Uses `custom_brand` value
- Otherwise → Uses `brand_name`

### System Message Properties

**Database Structure**
```sql
CREATE TABLE messages (
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT,
    sender_id INT,  -- 0 = System message, >0 = User message
    message_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    -- Foreign keys...
)
```

**System Message Identifier**: `sender_id = 0`

**Socket.IO Metadata**:
```javascript
{
    is_system_message: true,
    system_message_type: 'sold' | 'traded',
    product_status: 'sold' | 'traded',
    product_id: number,
    product_name: string
}
```

### Error Handling

**No Conversation Found**
```php
if (!$conversation) {
    error_log("⚠️ No conversation found for product_id: " . $product_id . " with seller_id: " . $uploader_id);
    error_log("🔍 This might be because no buyer has messaged about this product yet");
}
```

**Why this happens**: Seller marked product as sold/traded but no buyer had messaged them about it. This is a valid scenario (e.g., sold outside the platform).

**Solution**: System gracefully continues without sending message. Only products with active conversations receive buyer confirmation messages.

### Logging & Debugging

**Success Logging**
```php
error_log("✅✅✅ SYSTEM MESSAGE SENT SUCCESSFULLY! Message ID: " . $messageId . " ✅✅✅");
error_log("📨 System message: " . $systemMessage);
error_log("🔴 Socket.IO events emitted to buyer and seller");
```

**Conversation Detection**
```php
error_log("📋 Found conversation for system message: " . $conversation['conversation_id']);
error_log("👤 Buyer: " . $conversation['buyer_name'] . " (ID: " . $conversation['buyer_id'] . ")");
error_log("📦 Product: " . $conversation['product_name'] . " - ₱" . $conversation['price']);
```

### Frontend Display

**In Messages Component**:
- System messages display with gray background
- Sender name shows as "System"
- No profile avatar displayed
- Timestamp shows when message was generated

**Visual Indicators**:
- 📦 Icon for product status changes
- Distinct styling from user messages
- Cannot be deleted or reported

---

## API Integration

### Product Sale Status Update Endpoint

**Endpoint**: `POST /api/update-sale-status`

**Request Body**:
```json
{
  "product_id": 123,
  "uploader_id": 45,
  "sale_status": "sold",
  "for_type": "for sale"
}
```

**Success Response**:
```json
{
  "status": "success",
  "data": {
    "product_id": 123,
    "sale_status": "sold",
    "message": "Product status updated successfully"
  }
}
```

**Triggers**:
1. Database update: `products.sale_status`
2. System message generation (if conversation exists)
3. Socket.IO broadcast to buyer and seller
4. Admin notification creation

---

## Database Tables Affected

### 1. products
```sql
UPDATE products 
SET sale_status = 'sold' 
WHERE product_id = ? AND uploader_id = ?
```

### 2. messages
```sql
INSERT INTO messages (conversation_id, sender_id, message_text, created_at) 
VALUES (?, 0, ?, NOW())
```

### 3. conversations
```sql
SELECT c.conversation_id, c.buyer_id, c.seller_id, ...
FROM conversations c
WHERE c.product_id = ? AND c.seller_id = ?
```

### 4. product_status_log
```sql
INSERT INTO product_status_log 
(product_id, previous_status, new_status, for_type, changed_by, changed_at, product_name) 
VALUES (?, ?, ?, ?, ?, ?, ?)
```

---

## User Experience Flow

### Scenario: Successful Product Sale

1. **Initial State**
   - Product status: `available`
   - Buyer has messaged seller about product
   - Conversation exists in database

2. **Seller Marks as Sold**
   - Seller clicks "Mark as Sold" in their listing management
   - Frontend sends `POST /api/update-sale-status` with `sale_status: 'sold'`

3. **Backend Processing**
   - ✅ Validates request parameters
   - ✅ Updates `products.sale_status` to 'sold'
   - ✅ Finds buyer-seller conversation
   - ✅ Constructs personalized message
   - ✅ Inserts system message with `sender_id = 0`
   - ✅ Emits Socket.IO events to buyer and seller
   - ✅ Logs status change for admin

4. **Buyer Experience**
   - 🔴 Real-time notification in messages (Socket.IO)
   - 📬 Sees system message: "The [Product Name] was already sold to you..."
   - 📋 Views product details in message
   - ⭐ Prompted to submit rating

5. **Seller Experience**
   - 🔴 Sees confirmation in their conversation
   - 📦 Product status badge updates to "Sold"
   - ✅ Knows buyer was notified

6. **Report Form Behavior**
   - Buyer can now see "Post-Purchase Concern" option when reporting
   - Can submit specific post-purchase issues if needed

---

## Testing Checklist

### Feature 1: Conditional Post-Purchase Concern

- [ ] **Test 1**: Open report form for product with `sale_status = 'available'`
  - Expected: "Post-Purchase Concern" option NOT visible
  
- [ ] **Test 2**: Open report form for product with `sale_status = 'reserved'`
  - Expected: "Post-Purchase Concern" option NOT visible
  
- [ ] **Test 3**: Open report form for product with `sale_status = 'sold'`
  - Expected: "Post-Purchase Concern" option IS visible
  
- [ ] **Test 4**: Open report form for product with `sale_status = 'traded'`
  - Expected: "Post-Purchase Concern" option IS visible
  
- [ ] **Test 5**: Console logs show correct `productSaleStatus` value
  - Expected: Console shows: `🟢 REPORTS: Product sale_status: [value]`

### Feature 2: Auto-Generated Buyer Messages

- [ ] **Test 6**: Mark product as sold (with existing conversation)
  - Expected: Buyer receives personalized confirmation message
  - Expected: Message includes product name, price, and details
  - Expected: Message ends with rating prompt
  
- [ ] **Test 7**: Mark product as traded (with existing conversation)
  - Expected: Message says "traded to you" instead of "sold to you"
  
- [ ] **Test 8**: Mark product as sold (without conversation)
  - Expected: No message sent, error logged gracefully
  - Expected: Status still updates successfully
  
- [ ] **Test 9**: Check Socket.IO real-time delivery
  - Expected: Both buyer and seller see message instantly
  - Expected: No page refresh needed
  
- [ ] **Test 10**: Verify system message properties
  - Expected: `sender_id = 0`
  - Expected: Gray background styling
  - Expected: "System" sender name displayed
  
- [ ] **Test 11**: Check product details formatting
  - Expected: Price formatted as ₱15,000.00
  - Expected: Category, brand, condition, type included
  - Expected: No-brand products exclude brand line
  
- [ ] **Test 12**: Verify message persistence
  - Expected: Message saved in database
  - Expected: Message visible after page refresh
  - Expected: Message visible in conversation history

### API Testing

- [ ] **Test 13**: POST to `/api/update-sale-status`
  ```bash
  curl -X POST http://localhost/CycleMart-api/api/update-sale-status \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -d '{
      "product_id": 123,
      "uploader_id": 45,
      "sale_status": "sold",
      "for_type": "for sale"
    }'
  ```
  - Expected: 200 response with success message
  - Expected: System message inserted
  - Expected: Socket.IO events emitted

### Database Verification

- [ ] **Test 14**: Check messages table
  ```sql
  SELECT * FROM messages 
  WHERE conversation_id = ? AND sender_id = 0 
  ORDER BY created_at DESC LIMIT 1;
  ```
  - Expected: Most recent message has `sender_id = 0`
  - Expected: `message_text` matches expected format

- [ ] **Test 15**: Check product_status_log table
  ```sql
  SELECT * FROM product_status_log 
  WHERE product_id = ? 
  ORDER BY changed_at DESC LIMIT 1;
  ```
  - Expected: Log entry with `previous_status` → `new_status` transition

---

## Configuration

### No Configuration Required

Both features work out-of-the-box with the existing system:
- ✅ Uses existing `sale_status` ENUM in products table
- ✅ Uses existing `sender_id = 0` convention for system messages
- ✅ Uses existing Socket.IO infrastructure
- ✅ Uses existing conversation and message tables

### Prerequisites

1. **Database**: MySQL with `cyclemart` schema
2. **Backend**: PHP 8.x with PDO, JWT authentication
3. **Frontend**: Angular 19 with Material Design
4. **Real-time**: Socket.IO server running on port 3000
5. **Existing Tables**: products, conversations, messages, users

---

## Troubleshooting

### Issue: Post-Purchase Concern Always Hidden

**Symptoms**: User cannot see "Post-Purchase Concern" option even for sold products

**Possible Causes**:
1. Product data not passed correctly to ReportsComponent
2. `sale_status` field missing in product object
3. Component not in modal mode (`isModal = false`)

**Debug Steps**:
```typescript
// Check console logs
console.log('🟢 REPORTS: Product sale_status:', this.productSaleStatus);
console.log('🔍 canShowPostPurchaseConcern:', { productSaleStatus: this.productSaleStatus, canShow: canShow });
```

**Solution**: Ensure product object includes `sale_status` or `saleStatus` field when passing to component

---

### Issue: Buyer Not Receiving Confirmation Message

**Symptoms**: Seller marks as sold but buyer doesn't see system message

**Possible Causes**:
1. No conversation exists between buyer and seller
2. Socket.IO server not running
3. Buyer not connected to Socket.IO room

**Debug Steps**:
```bash
# Check PHP error logs
tail -f /path/to/php/error.log | grep "SYSTEM MESSAGE"

# Check Socket.IO server
curl http://localhost:3000/health

# Check conversation existence
mysql> SELECT * FROM conversations WHERE product_id = ? AND seller_id = ?;
```

**Solution**: 
- Ensure buyer has messaged seller before marking as sold
- Restart Socket.IO server: `cd socket-server && npm start`
- Verify buyer is logged in and connected

---

### Issue: Message Format Incorrect

**Symptoms**: Message doesn't include all product details or formatting is off

**Possible Causes**:
1. Database fields empty (category, brand, etc.)
2. Newline characters not rendering
3. Special characters in product name

**Debug Steps**:
```php
error_log("📨 System message: " . $systemMessage);
error_log("📦 Product details: " . json_encode($conversation));
```

**Solution**: Check database values, ensure frontend renders `\n` as line breaks

---

## Maintenance Notes

### Future Enhancements

1. **Multi-Buyer Support**: If product traded with multiple users, send message to all buyers
2. **Message Templates**: Create configurable message templates for different transaction types
3. **Language Localization**: Support multiple languages for system messages
4. **Rich Media**: Include product image thumbnail in system message
5. **Action Buttons**: Add "Submit Rating" button directly in message

### Code Locations

**Frontend (Angular)**:
- `src/app/reports/reports.component.ts` - Lines 151-157, 200-205, 695-704
- `src/app/reports/reports.component.html` - Line 332

**Backend (PHP)**:
- `CycleMart-api/api/modules/post.php` - Lines 1137-1350 (`updateSaleStatus()` method)

**Database**:
- `products.sale_status` - ENUM('available', 'sold', 'reserved', 'traded')
- `messages.sender_id` - INT (0 = system message)
- `conversations` - Links products, buyers, and sellers

---

## Security Considerations

### 1. Authorization
- Only product uploader (seller) can mark product as sold/traded
- JWT authentication required for API endpoint
- Verification: `WHERE product_id = :product_id AND uploader_id = :uploader_id`

### 2. Input Validation
```php
// Validate sale_status values
if (!in_array($sale_status, ['available', 'sold', 'reserved', 'traded'])) {
    return $this->sendPayload(null, "error", "Invalid sale status", 400);
}
```

### 3. SQL Injection Prevention
- All queries use prepared statements with bound parameters
- PDO automatically escapes values

### 4. XSS Prevention
- Frontend sanitizes HTML in messages
- Special characters encoded in product names

### 5. Privacy
- System messages only sent to buyer and seller in private conversation
- No public broadcast of transaction details
- Message history tied to authenticated users

---

## Performance Considerations

### Database Queries
- **Conversation Lookup**: Single query with JOINs (users, products)
- **Message Insert**: Single INSERT with `sender_id = 0`
- **Status Update**: Single UPDATE with WHERE clause
- **Total Queries per Sale**: ~4 queries (update, lookup, insert, log)

### Socket.IO Events
- **Per-Transaction**: 4 events total (2 to buyer, 2 to seller)
  - `new_message` × 2
  - `product_status_changed` × 2
- **Payload Size**: ~500 bytes per event

### Optimization Tips
1. **Index**: Ensure indexes on `conversations.product_id` and `conversations.seller_id`
2. **Caching**: Cache product details if marking multiple products
3. **Batch Processing**: If marking many products, use batch API endpoint
4. **Socket.IO Rooms**: Already optimized with user-specific rooms (`user_${userId}`)

---

## Conclusion

These features enhance the post-purchase experience by:

1. **Contextual Reporting**: Users only see post-purchase options when relevant
2. **Immediate Confirmation**: Buyers instantly know transaction completed
3. **Clear Communication**: Formatted product details included automatically
4. **Rating Reminder**: Prompt encourages users to complete transaction feedback

**Benefits**:
- ✅ Reduced user confusion
- ✅ Improved transaction transparency
- ✅ Higher rating completion rates
- ✅ Better post-purchase support

**Zero Breaking Changes**:
- ✅ Backward compatible with existing system
- ✅ No database migrations required
- ✅ Works with existing infrastructure
- ✅ Graceful degradation if no conversation exists

---

*Last Updated: January 2025*
*Version: 1.0.0*
*Author: CycleMart Development Team*
