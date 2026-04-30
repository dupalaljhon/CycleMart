# 🔧 Quick Fix: JWT Token Error

## Error You're Seeing
```json
{
  "status": "error",
  "code": 401,
  "message": "Invalid or expired JWT token",
  "data": null
}
```

## ⚡ Quick Solution (30 seconds)

### Step 1: Logout
Click your profile icon → Click "Logout"

### Step 2: Login Again
Go to login page → Enter credentials → Login

### Step 3: Try Again
Go to "Add New Product" → Upload images → Submit

**Done!** ✅ It should work now!

---

## Why This Happens

Your JWT token was created by the **PHP backend**, but you're now using the **Node.js backend** which has a different secret key.

Think of it like this:
- PHP backend locked the door with Key A
- Node.js backend tries to unlock with Key B
- Keys don't match = Access denied!

**Solution**: Get a new key (token) from Node.js backend by logging in again.

---

## Detailed Steps with Screenshots

### 1. Logout

**Option A: Use Logout Button**
- Click your profile icon (top right)
- Click "Logout"

**Option B: Clear Browser Storage**
- Press F12 (open DevTools)
- Go to Console tab
- Type: `localStorage.clear()`
- Press Enter
- Refresh page

### 2. Login Again

- Go to: http://localhost:4200/login
- Enter your email and password
- Click "Login"

**What happens**: Node.js backend creates a new JWT token with the correct secret key and sends it to your browser.

### 3. Test Upload

- Go to "Add New Product"
- Fill in product details
- Upload images
- Click "Post Product"

**Result**: Should work perfectly! ✅

---

## Verify It's Fixed

### Check Token in Browser Console

1. Press F12 (open DevTools)
2. Go to Console tab
3. Type:
   ```javascript
   const token = localStorage.getItem('authToken');
   console.log('Token exists:', !!token);
   console.log('Token length:', token?.length);
   ```

**Expected Output**:
```
Token exists: true
Token length: 200+ characters
```

### Check Token Payload

```javascript
const token = localStorage.getItem('authToken');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('User ID:', payload.uid);
console.log('Email:', payload.email);
console.log('Expires:', new Date(payload.exp * 1000));
```

**Expected Output**:
```
User ID: 123
Email: your@email.com
Expires: Sat Apr 25 2026 13:00:00 GMT+0800
```

---

## Still Not Working?

### Check 1: Backend Running?
Open: http://localhost:3001/

Should show:
```json
{
  "name": "CycleMart Node API",
  "version": "1.0.0",
  "status": "active"
}
```

If not, start the backend:
```bash
cd CycleMart/CycleMart-api-node
START_BACKEND.bat
```

### Check 2: Token Being Sent?

1. Open DevTools (F12)
2. Go to Network tab
3. Try uploading a product
4. Click the request (should be `addProduct`)
5. Go to Headers tab
6. Look for: `Authorization: Bearer eyJ...`

If missing, the JWT interceptor isn't working. Check:
```javascript
console.log('Auth Token:', localStorage.getItem('authToken'));
console.log('Admin Token:', localStorage.getItem('admin_token'));
```

### Check 3: Correct Backend?

Verify environment configuration:
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3001/api/',  // ← Should be 3001
  apiUploadsBaseUrl: 'http://localhost:3001/uploads/'
};
```

---

## Prevention

To avoid this in the future:

### Always Use Node.js Backend

Make sure you're always logging in through the Node.js backend:
- Login URL: http://localhost:4200/login
- Backend: http://localhost:3001/api/login

### Don't Mix Backends

If you switch between PHP and Node.js backends:
1. Logout first
2. Switch backend
3. Login again

### Keep Backend Running

Start Node.js backend before using the app:
```bash
cd CycleMart/CycleMart-api-node
START_BACKEND.bat
```

---

## Technical Explanation

### JWT Token Structure

A JWT token has 3 parts separated by dots:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEyMywiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0.signature
│                                      │                                                    │
│                                      │                                                    └─ Signature (created with secret)
│                                      └─ Payload (user data)
└─ Header (algorithm)
```

### Why Verification Fails

**PHP Backend**:
- Creates token with Secret A
- Signature = hash(header + payload + Secret A)

**Node.js Backend**:
- Tries to verify with Secret B
- Calculates: hash(header + payload + Secret B)
- Compares with signature
- **Mismatch!** = Invalid token

### Solution

Get a new token from Node.js backend:
- Creates token with Secret B
- Signature = hash(header + payload + Secret B)
- Node.js can verify because it uses the same Secret B

---

## Summary

**Problem**: JWT token secret mismatch between PHP and Node.js backends

**Solution**: Logout and login again (30 seconds)

**Why**: Creates new token with correct secret key

**Status**: ✅ Easy fix!

---

## Related Documentation

- **JWT_TOKEN_FIX.md** - Detailed technical explanation
- **START_HERE.md** - Complete setup guide
- **MIGRATION_GUIDE.md** - Backend migration details

---

**Need more help?** Check the troubleshooting section in START_HERE.md
