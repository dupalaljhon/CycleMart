# Conversation Archive and Delete Feature Implementation

## Overview
This implementation adds conversation archiving and deletion functionality to the CycleMart messaging system based on the updated database schema with separate tracking for buyer and seller actions.

## Database Schema Updates
The `conversations` table now includes these fields:
- `buyer_archived` (tinyint(1)) - Whether buyer has archived the conversation
- `seller_archived` (tinyint(1)) - Whether seller has archived the conversation  
- `buyer_deleted` (tinyint(1)) - Whether buyer has deleted the conversation
- `seller_deleted` (tinyint(1)) - Whether seller has deleted the conversation

## Backend Implementation

### 1. API Endpoints Added

#### GET Endpoints
- `GET /api/conversations?user_id={id}` - Updated to filter out archived/deleted conversations
- `GET /api/archived-conversations?user_id={id}` - New endpoint to get archived conversations

#### POST Endpoints
- `POST /api/archive-conversation` - Archive a conversation for current user
- `POST /api/restore-conversation` - Restore an archived conversation 
- `POST /api/delete-conversation` - Delete a conversation (soft delete)

### 2. PHP Methods Added

#### In `get.php`:
- `getUserConversations()` - Updated with proper filtering
- `getUserArchivedConversations()` - New method for archived conversations

#### In `post.php`:
- `archiveConversation()` - Sets appropriate archive flag (buyer_archived or seller_archived)
- `restoreConversation()` - Unsets archive flag
- `deleteConversation()` - Sets delete flag, permanently deletes if both users delete

### 3. Request/Response Format

#### Archive/Restore/Delete Request:
```json
{
    "conversation_id": 123,
    "user_id": 456
}
```

#### Success Response:
```json
{
    "status": "success",
    "code": 200,
    "message": "Conversation archived successfully",
    "data": {
        "conversation_id": 123,
        "archived": true
    }
}
```

## Frontend Implementation

### 1. Angular Service Updates

#### In `api.service.ts`:
- `getUserArchivedConversations(userId)` - Get archived conversations
- `archiveConversation(data)` - Archive a conversation
- `restoreConversation(data)` - Restore a conversation  
- `deleteConversation(data)` - Delete a conversation

### 2. Component Updates

#### In `messages.component.ts`:
- `loadArchivedConversations()` - Load archived conversations from API
- `archiveChat(index)` - Updated to use API call
- `restoreChat(index)` - Updated to use API call
- `deleteChat(index)` - Updated to use API call
- `deleteArchivedChat(index)` - New method for deleting archived chats
- `toggleArchivedMessages()` - Updated to load from API

#### In `messages.component.html`:
- Updated archived message display with restore and delete buttons
- Added proper styling and icons for actions

## Features

### 1. Archive Functionality
- Users can archive conversations they no longer want to see in main list
- Archived conversations are stored separately and can be viewed via toggle
- Each user (buyer/seller) can independently archive conversations

### 2. Restore Functionality  
- Users can restore archived conversations back to active list
- Restored conversations appear at the top of the active list

### 3. Delete Functionality
- Soft delete - conversation is marked as deleted for current user
- If both users delete the conversation, it's permanently removed from database
- Includes deletion of associated messages when permanently deleted

### 4. Visual Indicators
- Archive button in conversation list
- Archive indicator icon on archived messages
- Restore and delete buttons for archived conversations
- Success/error notifications for all actions

## Security Features
- Validates user participation in conversation before allowing actions
- Prevents unauthorized access to conversations
- Proper error handling and user feedback

## Testing
A test file `test-conversation-management.php` has been created to verify all endpoints work correctly. Update the user ID and conversation ID variables before testing.

## Usage Instructions

### For Users:
1. **Archive**: Click archive button on any active conversation
2. **View Archived**: Click archive icon in messages header to toggle view
3. **Restore**: In archived view, click restore button
4. **Delete**: Click delete button (permanent action, warns user)

### For Developers:
1. Ensure database schema is updated with new fields
2. Test all API endpoints using the provided test file
3. Verify proper error handling and user feedback
4. Check that conversations are properly filtered by user role (buyer/seller)

## Database Migration Notes
If upgrading existing system, run this SQL to add the new fields:

```sql
ALTER TABLE conversations 
ADD COLUMN buyer_archived TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN seller_archived TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN buyer_deleted TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN seller_deleted TINYINT(1) NOT NULL DEFAULT 0;
```