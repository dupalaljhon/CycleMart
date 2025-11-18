# Violation Level Punishment System - Implementation Guide

## Overview
This document describes the complete implementation of the violation level punishment system in CycleMart, which restricts user access based on their violation count and account status.

## System Architecture

### Database Schema
```sql
-- Users table columns
violation_count INT NOT NULL DEFAULT 0
account_status ENUM('active', 'restricted', 'suspended', 'banned') NOT NULL DEFAULT 'active'
```

### Violation Levels
| Violation Count | Account Status | Effect |
|----------------|----------------|--------|
| 0-1 | active | Full access to all features |
| 2 | restricted | Cannot list products, send messages, or submit reports |
| 3 | suspended | Cannot access the app except suspension page |
| 4+ | banned | Cannot log in at all / auto logout |

## Backend Implementation

### 1. Global Middleware (`global.php`)

#### Account Status Checker
```php
public function checkAccountStatus($pdo, $user_id, $action = null)
```
- **Purpose**: Validates if user can perform an action based on their account status
- **Returns**: Error response if blocked, null if allowed
- **Used by**: All restricted endpoints

#### Violation Level Helper
```php
public function getViolationLevels()
```
- Returns violation level configuration array
- Maps violation counts to account statuses

#### Auto Status Updater
```php
public function updateAccountStatusByViolations($pdo, $user_id, $violation_count)
```
- Automatically updates account status based on violation count
- Called when admin marks a violation

### 2. Protected Routes (`routes.php`)

Protected endpoints that check account status:
- `addProduct` - Restricted for restricted/suspended/banned users
- `send-message` - Restricted for restricted/suspended/banned users
- `submit-report` - Restricted for restricted/suspended/banned users
- `submit-user-report` - Restricted for restricted/suspended/banned users

**Implementation Pattern:**
```php
case 'addProduct':
    if (isset($data->uploader_id)) {
        $statusCheck = $global->checkAccountStatus($pdo, $data->uploader_id, 'addProduct');
        if ($statusCheck !== null) {
            echo json_encode($statusCheck);
            break;
        }
    }
    echo json_encode($post->addProduct($data));
    break;
```

### 3. Login Authentication (`post.php`)

**Enhanced Login Response:**
- Returns account_status and violation_count
- Blocks banned users from logging in
- Returns appropriate error messages

```php
// Check if account is banned
if ($user['account_status'] === 'banned') {
    return $this->sendPayload([
        'banned' => true,
        'account_status' => 'banned',
        'violation_count' => $user['violation_count']
    ], "error", "Your account has been permanently banned...", 403);
}
```

### 4. Mark Violation Endpoint (`post.php`)

**Function:** `markUserViolation($data)`

**Process:**
1. Validates violation level (1-4) and reason
2. Increments violation count
3. Updates account status based on level
4. Sends user notification with detailed message
5. Returns updated user information

**Notification Messages by Level:**
- Level 1: ⚠️ Account Warning
- Level 2: 🔒 Account Restricted
- Level 3: 🚫 Account Suspended
- Level 4: ❌ Account Permanently Banned

## Frontend Implementation

### 1. Account Status Service (`account-status.service.ts`)

**Core Methods:**
- `updateAccountStatus(status)` - Updates and stores account status
- `isActive()` - Check if account is active
- `isRestricted()` - Check if account is restricted
- `isSuspended()` - Check if account is suspended
- `isBanned()` - Check if account is banned
- `canPerformAction(action)` - Check if specific action is allowed
- `getRestrictionMessage()` - Get user-friendly restriction message

**Storage:**
- Uses localStorage to persist account status
- Syncs with login response
- Updates on API error responses

### 2. Route Guards

#### Account Status Guard (`account-status.guard.ts`)
```typescript
export const accountStatusGuard: CanActivateFn
```
- Redirects banned users to `/banned`
- Redirects suspended users to `/suspended`
- Applied to all protected routes

**Routes Protected:**
- /home
- /dashboard
- /profile
- /messages
- /notification
- /listing
- /reports
- /user-reports

### 3. JWT Interceptor (`jwt-interceptor.service.ts`)

**Enhanced to handle account status responses:**
- Catches 403 errors with account status data
- Automatically updates AccountStatusService
- Redirects banned/suspended users
- Updates UI for restricted users

### 4. Restriction Pages

#### Suspended Page (`suspended.component.ts`)
- Shows suspension details
- Displays violation count
- Provides contact support option
- Allows logout only

#### Banned Page (`banned.component.ts`)
- Shows permanent ban message
- Cannot access any features
- Provides appeals contact
- Auto-clears authentication data

### 5. Component Updates

#### Home Component
**Restrictions:**
- Shows warning banner for restricted accounts
- Disables "Report Product" button
- Displays restriction tooltip

**UI Changes:**
```html
<!-- Restriction Banner -->
<div *ngIf="accountStatusService.isRestricted()">
  Account Restricted Warning
</div>

<!-- Disabled Report Button -->
<button [disabled]="!accountStatusService.canPerformAction('submit_report')">
```

#### Listing Component
**Restrictions:**
- Shows warning banner
- Disables "Add New Listing" button
- Shows "Listing Disabled" text

**UI Changes:**
```html
<!-- Disabled Add Listing Button -->
<button [disabled]="!accountStatusService.canPerformAction('list_product')">
  {{ canPerformAction ? 'Add New Listing' : 'Listing Disabled' }}
</button>
```

#### Messages Component
**Restrictions:**
- Shows warning banner at top
- Disables message input field
- Disables send button
- Shows restriction message in placeholder

**UI Changes:**
```html
<!-- Disabled Input -->
<input [disabled]="!accountStatusService.canPerformAction('send_message')"
       [placeholder]="canSend ? 'Type a message...' : 'Messaging disabled'">

<!-- Disabled Send Button -->
<button [disabled]="!canSend">Send</button>
```

## Authentication Flow

### Login Process
1. User submits credentials
2. Backend validates and checks account_status
3. Banned users: Login rejected with 403 error
4. Active/Restricted/Suspended: Login allowed, returns account_status
5. Frontend stores account_status in localStorage
6. AccountStatusService loads status
7. Guards redirect suspended/banned users

### Violation Marking Process
1. Admin marks user violation with level (1-4)
2. Backend increments violation_count
3. Backend updates account_status based on level
4. Backend sends notification to user
5. User receives notification in-app
6. On next action, middleware checks status
7. API returns 403 with account status data
8. JWT Interceptor catches error and updates frontend
9. User is redirected or sees restriction message

## API Response Formats

### Successful Login (Active/Restricted)
```json
{
  "status": "success",
  "data": {
    "token": "jwt_token",
    "userID": 123,
    "email": "user@example.com",
    "full_name": "John Doe",
    "account_status": "active",
    "violation_count": 0
  }
}
```

### Banned Login Attempt
```json
{
  "status": "error",
  "message": "Your account has been permanently banned...",
  "data": {
    "banned": true,
    "account_status": "banned",
    "violation_count": 4
  },
  "code": 403
}
```

### Restricted Action Attempt
```json
{
  "status": "error",
  "message": "Your account is restricted. You cannot perform this action.",
  "data": {
    "restricted": true,
    "account_status": "restricted",
    "violation_count": 2
  },
  "code": 403
}
```

### Suspended Action Attempt
```json
{
  "status": "error",
  "message": "Your account is suspended. Please contact support.",
  "data": {
    "suspended": true,
    "account_status": "suspended",
    "violation_count": 3
  },
  "code": 403
}
```

## User Experience

### Active Users (0-1 violations)
- ✅ Full access to all features
- ✅ Can list products
- ✅ Can send messages
- ✅ Can submit reports

### Restricted Users (2 violations)
- ⚠️ Warning banner shown on all pages
- ❌ Cannot list products
- ❌ Cannot send messages
- ❌ Cannot submit reports
- ✅ Can browse products
- ✅ Can view messages (read-only)

### Suspended Users (3 violations)
- 🚫 Redirected to suspension page
- ❌ Cannot access any features
- ❌ Cannot navigate away from suspension page
- ✅ Can logout
- ✅ Can contact support

### Banned Users (4+ violations)
- ⛔ Cannot login
- ⛔ Auto-logout on any attempt
- ❌ No access to any features
- ✅ Can view ban appeal information

## Testing Scenarios

### Test Restricted Account
1. Admin marks user with Level 2 violation
2. User tries to list a product
3. API returns 403 error
4. User sees disabled button and warning banner
5. User tries to send message
6. Input field is disabled with explanation

### Test Suspended Account
1. Admin marks user with Level 3 violation
2. User tries to access /home
3. Guard redirects to /suspended
4. User sees suspension page
5. User tries to navigate to /messages
6. Guard blocks and stays on /suspended

### Test Banned Account
1. Admin marks user with Level 4 violation
2. User's session expires or logs out
3. User tries to login
4. Login API rejects with ban message
5. User is shown /banned page
6. User cannot access any feature

## Maintenance & Monitoring

### Admin Tasks
- Monitor user violation counts via admin dashboard
- Review appeals for suspensions/bans
- Adjust violation levels if needed
- Send follow-up notifications

### Database Queries
```sql
-- Count users by status
SELECT account_status, COUNT(*) 
FROM users 
GROUP BY account_status;

-- Find users at risk (2 violations)
SELECT id, full_name, email, violation_count 
FROM users 
WHERE violation_count = 2;

-- Recent violations
SELECT id, full_name, violation_count, account_status, updated_at 
FROM users 
WHERE updated_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
AND violation_count > 0
ORDER BY updated_at DESC;
```

## Security Considerations

1. **Backend Validation**: All restrictions enforced server-side
2. **Token Validation**: JWT tokens don't override account status checks
3. **Consistent Checking**: Every API call validates account status
4. **Audit Trail**: Violations logged with timestamps
5. **Appeal Process**: Banned users can contact appeals team

## Future Enhancements

- [ ] Add violation expiration (violations expire after X months)
- [ ] Implement appeal workflow in admin panel
- [ ] Add violation history view for users
- [ ] Send email notifications for violations
- [ ] Add temporary suspension option (expires automatically)
- [ ] Track who issued each violation
- [ ] Add violation severity levels (minor vs major)

## Support Contacts

- Technical Support: support@cyclemart.com
- Appeals Team: appeals@cyclemart.com
- Emergency: Contact admin directly

---
**Last Updated**: November 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
