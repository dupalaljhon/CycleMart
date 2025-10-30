# Reports Component - Database Alignment

## Database Table Structure
```sql
CREATE TABLE `reports` (
  `report_id` int(11) NOT NULL,
  `reporter_id` int(11) NOT NULL,
  `reported_user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `product_images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`product_images`)),
  `product_description` text DEFAULT NULL,
  `reason_type` enum('scam','fake product','spam','inappropriate content','misleading information','stolen item','others') NOT NULL,
  `reason_details` text DEFAULT NULL,
  `status` enum('pending','reviewed','action_taken') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

## Component Alignment Features

### ✅ Perfectly Aligned Fields
1. **report_id** - Auto-increment primary key
2. **reporter_id** - Required, matches logged-in user ID
3. **reported_user_id** - NULL when reporting products
4. **product_id** - NULL when reporting users
5. **reason_type** - Exact enum match with database
6. **reason_details** - Text field for detailed explanation
7. **status** - Enum with proper default 'pending'
8. **created_at** - Automatic timestamp

### 🔧 Enhanced Features
1. **product_images** - Validates JSON format before submission
2. **product_description** - Automatically captured from product data
3. **Form Validation** - Ensures database constraints are met
4. **Status Display** - Visual indicators for each status type

### 📝 Report Types (Exact Database Match)
- ⚠️ **scam** - Scam/Fraud activities
- 🚫 **fake product** - Counterfeit items
- 📧 **spam** - Spam content
- 🔞 **inappropriate content** - Offensive material
- ❌ **misleading information** - False claims
- 🚨 **stolen item** - Stolen goods
- 📝 **others** - Other issues

### 🎯 Status Types (Exact Database Match)
- **pending** - Default status, awaiting review
- **reviewed** - Under review by administrators
- **action_taken** - Administrative action completed

### 🔒 Database Constraints Validation
1. **JSON Validation** - Ensures product_images field contains valid JSON
2. **Enum Validation** - Validates reason_type and status against database enums
3. **Required Fields** - Enforces reporter_id and reason_type requirements
4. **Mutual Exclusivity** - Ensures either user OR product is reported, not both
5. **NULL Handling** - Properly handles NULL values for optional fields

### 📊 Data Flow
1. **Form Input** → **Validation** → **Database Format** → **API Submission**
2. **Product Images** → **JSON String** → **Database Storage**
3. **User Selection** → **Enum Value** → **Database Constraint Check**

### 🎨 UI Features
- Clean black/white design matching app theme
- Material Design components
- Responsive form layout
- Real-time validation feedback
- Status chips with color coding
- Modal integration with home component

## Usage Examples

### Reporting a Product
```typescript
reportData = {
  reporter_id: 123,
  reported_user_id: null,
  product_id: 456,
  product_images: '["image1.jpg","image2.jpg"]', // Valid JSON
  product_description: "Bike helmet description",
  reason_type: "fake product",
  reason_details: "This appears to be a counterfeit item",
  status: "pending"
}
```

### Reporting a User
```typescript
reportData = {
  reporter_id: 123,
  reported_user_id: 789,
  product_id: null,
  product_images: null,
  product_description: null,
  reason_type: "spam",
  reason_details: "User is sending spam messages",
  status: "pending"
}
```

## Technical Implementation
- **TypeScript Interfaces** match database schema exactly
- **Validation Methods** ensure database constraint compliance
- **JSON Handling** for product_images field with proper error handling
- **Enum Type Safety** prevents invalid reason_type/status values
- **NULL Safety** handles optional fields correctly