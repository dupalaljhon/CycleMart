# JWT Token Authentication Fix

## Problem
When uploading a new listing, you're getting this error:
```json
{
  "status": "error",
  "code": 401,
  "message": "Invalid or expired JWT token",
  "data": null
}
```

## Root Cause
The JWT token was created by the **PHP backend** with a different secret key, but you're now using the **Node.js backend** which has a different JWT_SECRET. The Node.js backend cannot verify tokens created by the PHP backend.

## Solution: Re-login to Get New Token

### Quick Fix (Immediate)
1. **Logout** from the application
2. **Login again** - This will create a new JWT token from the Node.js backend
3. **Try uploading** a new listing - It should work now!

### Why This Works
- When you login through Node.js backend, it creates a JWT token using the Node.js JWT_SECRET
- This token can be verified by the Node.js backend
- All subsequent requests (like adding products) will work

## Step-by-Step Instructions

### 1. Logout
- Click your profile icon
- Click "Logout"
- Or clear localStorage in browser console: `localStorage.clear()`

### 2. Login Again
- Go to login page
- Enter your credentials
- Login

### 3. Test Upload
- Go to "Add New Product"
- Fill the form
- Upload images
- Submit
- Should work! ✅

## Technical Details

### JWT Token Structure

**PHP Backend Token** (Old):
- Secret: Different from Node.js
- Cannot be verified by Node.js backend

**Node.js Backend Token** (New):
- Secret: `cyclemart_secret_key_2026`
- Can be verified by Node.js backend
- Payload includes:
  ```json
  {
    "iss": "http://example.org",
    "aud": "http://example.com",
    "iat": 1745654400,
    "exp": 1745658000,
    "uid": 123,
    "role": "user",
    "email": "user@example.com"
  }
  ```

### How Authentication Works

1. **Login Request**:
   ```
   POST /api/login
   Body: { email, password }
   ```

2. **Backend Response**:
   ```json
   {
     "status": "success",
     "data": {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "userID": 123,
       "email": "user@example.com",
       "role": "user"
     }
   }
   ```

3. **Frontend Stores Token**:
   ```typescript
   localStorage.setItem('authToken', response.data.token);
   ```

4. **Subsequent Requests**:
   ```
   POST /api/addProduct
   Headers: {
     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   }
   ```

5. **Backend Verifies Token**:
   ```javascript
   const claims = jwt.verify(token, JWT_SECRET);
   // If secret matches, verification succeeds
   // If secret doesn't match, throws error
   ```

## Alternative Solution: Sync JWT Secrets

If you want to avoid re-login, you can sync the JWT secrets between PHP and Node.js backends.

### Option A: Use Same Secret in Both Backends

**PHP Backend** (`CycleMart-api/api/config/jwt.php`):
```php
define('JWT_SECRET', 'cyclemart_secret_key_2026');
```

**Node.js Backend** (`.env`):
```env
JWT_SECRET=cyclemart_secret_key_2026
```

### Option B: Update Node.js to Match PHP

Find the PHP JWT secret and update Node.js `.env` to match.

**Note**: This requires restarting the Node.js backend.

## Prevention

To avoid this issue in the future:

1. **Use Same JWT Secret** across all backends
2. **Document the Secret** in a secure location
3. **Re-login After Backend Changes** when switching backends

## Verification

After re-login, verify the token is working:

### Check Token in Browser Console
```javascript
// Get the token
const token = localStorage.getItem('authToken');
console.log('Token:', token);

// Decode the token (without verification)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Payload:', payload);

// Check expiration
const now = Math.floor(Date.now() / 1000);
const isExpired = payload.exp < now;
console.log('Is Expired:', isExpired);
console.log('Expires At:', new Date(payload.exp * 1000));
```

### Expected Output
```javascript
{
  iss: "http://example.org",
  aud: "http://example.com",
  iat: 1745654400,
  exp: 1745658000,  // 1 hour from iat
  uid: 123,
  role: "user",
  email: "user@example.com"
}
Is Expired: false
Expires At: Sat Apr 25 2026 13:00:00 GMT+0800
```

## Troubleshooting

### Still Getting 401 Error After Re-login?

1. **Check Backend is Running**:
   ```
   http://localhost:3001/
   ```
   Should return: `{"name": "CycleMart Node API", ...}`

2. **Check Token Exists**:
   ```javascript
   console.log(localStorage.getItem('authToken'));
   ```
   Should show a long string starting with `eyJ...`

3. **Check Token is Being Sent**:
   - Open Browser DevTools (F12)
   - Go to Network tab
   - Try uploading a product
   - Click the request
   - Check Headers tab
   - Look for: `Authorization: Bearer eyJ...`

4. **Check JWT_SECRET in Backend**:
   ```bash
   cd CycleMart/CycleMart-api-node
   cat .env | grep JWT_SECRET
   ```
   Should show: `JWT_SECRET=cyclemart_secret_key_2026`

5. **Restart Backend**:
   ```bash
   # Stop the backend (Ctrl+C)
   # Start again
   npm start
   ```

### Token Expired?

JWT tokens expire after 1 hour. If you see this error after being logged in for a while:

1. **Logout**
2. **Login again**
3. **Continue working**

## Security Notes

- JWT tokens are stored in localStorage
- Tokens expire after 1 hour for security
- Never share your JWT token
- Logout when done using the application
- Clear browser data if using a shared computer

## Summary

**Problem**: JWT token from PHP backend doesn't work with Node.js backend

**Solution**: Logout and login again to get a new token from Node.js backend

**Prevention**: Use the same JWT_SECRET in both backends

**Status**: ✅ Easy fix - just re-login!
