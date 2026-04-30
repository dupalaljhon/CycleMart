# 🔧 Fix 401 Unauthorized Error - Complete Guide

## 🎯 The Problem

You're getting this error when trying to upload a product:
```
POST http://localhost:3001/api/addProduct 401 (Unauthorized)
Error: Invalid or expired JWT token
```

## 🔍 Root Cause

Your current JWT token was created by the **old PHP backend** with a different `JWT_SECRET`. The **new Node.js backend** cannot verify this token because it uses a different secret key:

- **PHP Backend**: Used its own JWT_SECRET (unknown/different)
- **Node.js Backend**: Uses `JWT_SECRET=cyclemart_secret_key_2026` (from `.env` file)

When you try to upload a product, the Node.js backend tries to verify your token using its secret key, but fails because your token was signed with a different key.

## ✅ The Solution (3 Steps)

### Step 1: Check Your Token
1. Open `CHECK_TOKEN.html` in your browser (double-click the file)
2. Click **"Check My Token"** button
3. If it says **"Old PHP Token Detected"** or **"Token Expired"**, proceed to Step 2

### Step 2: Clear Your Token
**Option A - Using CHECK_TOKEN.html:**
1. Click **"Clear Token & Logout"** button in `CHECK_TOKEN.html`

**Option B - Using Browser Console:**
1. Open your CycleMart application in browser
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Run this command:
```javascript
localStorage.clear();
```

### Step 3: Login Again
1. Go to your CycleMart application
2. If you're still logged in, click **Logout**
3. Click **Login** and enter your credentials
4. After successful login, try uploading a product again

## 🧪 Verify the Fix

After logging in again, open `CHECK_TOKEN.html` and click "Check My Token". You should see:
- ✅ **Valid Token**
- ✅ **From Node.js backend**
- ✅ **Not expired**

## 📊 Technical Details

### How JWT Authentication Works

1. **Login**: User enters email/password
2. **Token Creation**: Backend creates JWT token signed with `JWT_SECRET`
3. **Token Storage**: Frontend stores token in `localStorage.authToken`
4. **API Requests**: Frontend sends token in `Authorization: Bearer <token>` header
5. **Token Verification**: Backend verifies token using same `JWT_SECRET`

### Why Your Token Failed

```javascript
// Your current token (from PHP backend)
{
  "iat": 1745280000,  // Created before Node.js backend existed
  "exp": 1745283600,
  "uid": 123,
  "email": "user@example.com"
}
// Signed with: PHP_JWT_SECRET (unknown)

// Node.js backend tries to verify with: cyclemart_secret_key_2026
// Result: ❌ Verification fails → 401 Unauthorized
```

### Authentication Flow in Code

**Frontend (api.service.ts):**
```typescript
addProduct(data: any): Observable<any> {
  // JWT interceptor automatically adds Authorization header
  return this.http.post<any>(`${this.baseUrl}addProduct`, data);
}
```

**JWT Interceptor (jwt-interceptor.service.ts):**
```typescript
const token = localStorage.getItem('authToken');
authReq = req.clone({
  setHeaders: {
    Authorization: `Bearer ${token}`  // Adds your token here
  }
});
```

**Backend (compat.js):**
```javascript
router.post('/:endpoint/:action?', async (req, res) => {
  // Line 3632: Auth guard checks token BEFORE processing request
  if (!applyAuthGuards(req, res, endpoint, action)) return;
  
  // If token is invalid, applyAuthGuards returns false and sends 401 error
  // Request never reaches the addProduct case
});
```

**Auth Guard (compat.js - line 122):**
```javascript
function applyAuthGuards(req, res, endpoint, action) {
  const token = extractBearerToken(req);  // Gets token from Authorization header
  
  try {
    const claims = verifyToken(token);  // Verifies with JWT_SECRET
    req.jwt = claims;
  } catch (error) {
    // ❌ Your token fails here because it was signed with different secret
    respond(res, sendPayload(null, 'error', 'Invalid or expired JWT token', 401));
    return false;
  }
  
  // Check if token user matches request owner
  if (Number(req.body.uploader_id) !== Number(req.jwt.uid)) {
    respond(res, sendPayload(null, 'error', 'Token user does not match request owner', 403));
    return false;
  }
  
  return true;
}
```

**Token Verification (auth.js):**
```javascript
export function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'your_secret_key';
  // Uses: cyclemart_secret_key_2026
  return jwt.verify(token, secret);  // ❌ Fails if token was signed with different secret
}
```

## 🚨 Common Mistakes

### ❌ Don't Do This:
- **Don't** just refresh the page (token is still old)
- **Don't** clear browser cache (doesn't clear localStorage)
- **Don't** restart the backend (doesn't fix old token)
- **Don't** change JWT_SECRET in .env (will break all existing tokens)

### ✅ Do This:
- **Do** clear localStorage
- **Do** logout and login again
- **Do** get a fresh token from Node.js backend

## 🔐 Security Note

The JWT_SECRET in your `.env` file is:
```
JWT_SECRET=cyclemart_secret_key_2026
```

**Important:**
- This secret is used to sign and verify ALL JWT tokens
- Never share this secret publicly
- Never commit it to version control (already in `.gitignore`)
- All users must login again when you change this secret

## 📝 Summary

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Old PHP token | Logout & login again |
| Invalid JWT token | Token signed with different secret | Get new token from Node.js backend |
| Token expired | Token older than 1 hour | Login again |
| Token user mismatch | uploader_id ≠ token.uid | Use correct user account |

## 🎉 After Fix

Once you login again with the Node.js backend, you'll get a fresh token that:
- ✅ Is signed with `cyclemart_secret_key_2026`
- ✅ Can be verified by Node.js backend
- ✅ Allows you to upload products
- ✅ Works for all authenticated endpoints
- ✅ Expires in 1 hour (then you need to login again)

## 🆘 Still Having Issues?

If you still get 401 errors after following these steps:

1. **Check backend is running:**
   ```bash
   # Should show: Server running on http://localhost:3001
   ```

2. **Check token in console:**
   ```javascript
   console.log(localStorage.getItem('authToken'));
   // Should show a long string starting with "eyJ..."
   ```

3. **Check token payload:**
   ```javascript
   const token = localStorage.getItem('authToken');
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log(payload);
   // Should show: { uid: 123, email: "...", iat: ..., exp: ... }
   ```

4. **Check if uploader_id matches token uid:**
   - Your token has `uid: 123`
   - Your request must have `uploader_id: 123`
   - If they don't match, you'll get 403 Forbidden

5. **Check backend logs:**
   - Look at the terminal where backend is running
   - Should show any errors or authentication failures

## 📞 Need More Help?

If none of this works, provide:
1. Screenshot of `CHECK_TOKEN.html` results
2. Backend terminal output
3. Browser console errors (F12 → Console tab)
4. Network tab showing the failed request (F12 → Network tab)
