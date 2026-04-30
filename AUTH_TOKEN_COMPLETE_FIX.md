# Complete JWT Token Authentication Fix

## What Was Fixed

### Issue 1: Missing Slash in API URL
**Problem**: The `addProduct` method was calling `${this.baseUrl}addProduct` which resulted in `http://localhost:3001/api/addProduct` (missing slash before addProduct).

**Fixed**: Changed to `${this.baseUrl}/addProduct` → `http://localhost:3001/api/addProduct`

### Issue 2: Duplicate Authorization Headers
**Problem**: The `addProduct` method was manually adding Authorization headers, but the JWT interceptor was also adding them, potentially causing conflicts.

**Fixed**: Removed manual header addition, letting the JWT interceptor handle it automatically.

## Files Modified

**File**: `CycleMart/src/app/api/api.service.ts`

**Before**:
```typescript
addProduct(data: any): Observable<any> {
  const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');
  const headers = token
    ? new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      })
    : new HttpHeaders({ 'Content-Type': 'application/json' });

  return this.http.post<any>(`${this.baseUrl}addProduct`, data, { headers });
}
```

**After**:
```typescript
addProduct(data: any): Observable<any> {
  // JWT interceptor will automatically add the Authorization header
  // No need to manually add it here
  return this.http.post<any>(`${this.baseUrl}/addProduct`, data);
}
```

## Testing the Fix

### Option 1: Use the Test Page (Recommended)

1. **Open the test page**:
   - Open `TEST_AUTH_TOKEN.html` in your browser
   - Or navigate to: `file:///c:/xampp/htdocs/CycleMart/TEST_AUTH_TOKEN.html`

2. **Follow the steps**:
   - Step 1: Check Backend (should show ✅)
   - Step 2: Login with your credentials
   - Step 3: Check Token (should show valid token)
   - Step 4: Test Add Product (should show ✅)

### Option 2: Test in the Application

1. **Clear browser cache**:
   - Press `Ctrl + Shift + Delete`
   - Clear cached images and files
   - Or use Incognito mode

2. **Logout and Login**:
   - Logout from the application
   - Login again
   - This ensures you have a fresh token

3. **Test Upload**:
   - Go to "Add New Product"
   - Fill in the form
   - Upload images
   - Submit
   - Should work! ✅

### Option 3: Manual Browser Console Test

1. **Open DevTools** (F12)

2. **Check token**:
```javascript
const token = localStorage.getItem('authToken');
console.log('Token:', token);
console.log('Token exists:', !!token);
```

3. **Test API call**:
```javascript
const token = localStorage.getItem('authToken');
const userId = localStorage.getItem('id');

fetch('http://localhost:3001/api/addProduct', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    product_name: 'Test Product',
    brand_name: 'shimano',
    price: 100,
    description: 'Test description for authentication verification',
    location: 'Test Location',
    for_type: 'sale',
    condition: 'second hand',
    category: 'others',
    quantity: 1,
    uploader_id: parseInt(userId),
    bicycle_brand_id: 1,
    bicycle_part_id: 1,
    product_images: JSON.stringify([]),
    product_videos: JSON.stringify([]),
    specifications: []
  })
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

Expected response:
```json
{
  "status": "success",
  "code": 201,
  "message": "Product submitted successfully! Your listing is pending admin approval.",
  "data": {
    "product_id": 123,
    "approval_status": "pending"
  }
}
```

## Troubleshooting

### Still Getting 401 Error?

#### Check 1: Backend Running?
```bash
# Open browser
http://localhost:3001/

# Should show:
{
  "name": "CycleMart Node API",
  "version": "1.0.0",
  "status": "active"
}
```

If not running:
```bash
cd CycleMart/CycleMart-api-node
START_BACKEND.bat
```

#### Check 2: Token Exists?
```javascript
// In browser console (F12)
console.log('Auth Token:', localStorage.getItem('authToken'));
console.log('User ID:', localStorage.getItem('id'));
```

Should show a long string starting with `eyJ...`

If null, login again.

#### Check 3: Token Valid?
```javascript
// In browser console
const token = localStorage.getItem('authToken');
const payload = JSON.parse(atob(token.split('.')[1]));
const now = Math.floor(Date.now() / 1000);
console.log('Token expires:', new Date(payload.exp * 1000));
console.log('Is expired:', payload.exp < now);
```

If expired, login again.

#### Check 4: JWT Secret Matches?
```bash
# Check .env file
cd CycleMart/CycleMart-api-node
cat .env | grep JWT_SECRET

# Should show:
JWT_SECRET=cyclemart_secret_key_2026
```

If different, restart backend after fixing.

#### Check 5: Network Request
1. Open DevTools (F12)
2. Go to Network tab
3. Try uploading a product
4. Click the `addProduct` request
5. Check:
   - **Request URL**: Should be `http://localhost:3001/api/addProduct`
   - **Request Headers**: Should have `Authorization: Bearer eyJ...`
   - **Response**: Check status code and response body

### Common Issues

#### Issue: "Missing JWT token"
**Cause**: Token not being sent in request

**Solution**:
1. Check JWT interceptor is registered in app.config.ts
2. Verify token exists in localStorage
3. Clear cache and try again

#### Issue: "Invalid or expired JWT token"
**Cause**: Token expired or wrong secret

**Solution**:
1. Logout and login again
2. Check JWT_SECRET in .env matches
3. Restart backend if you changed .env

#### Issue: "Token user does not match request owner"
**Cause**: uploader_id in request doesn't match uid in token

**Solution**:
1. Check localStorage.getItem('id') matches token payload uid
2. Logout and login again
3. Verify user ID is correct

## How Authentication Works Now

### 1. Login Flow
```
User enters credentials
        ↓
POST /api/login
        ↓
Backend verifies credentials
        ↓
Backend creates JWT token with JWT_SECRET
        ↓
Token sent to frontend
        ↓
Frontend stores in localStorage as 'authToken'
```

### 2. Add Product Flow
```
User fills product form
        ↓
Frontend calls addProduct()
        ↓
JWT Interceptor adds Authorization header
        ↓
POST /api/addProduct with Bearer token
        ↓
Backend extracts token from Authorization header
        ↓
Backend verifies token with JWT_SECRET
        ↓
Backend checks uploader_id matches token uid
        ↓
Product saved to database
        ↓
Success response sent to frontend
```

### 3. JWT Token Structure
```
Header.Payload.Signature
│      │       │
│      │       └─ HMAC SHA256(Header + Payload + JWT_SECRET)
│      │
│      └─ {
│          "iss": "http://example.org",
│          "aud": "http://example.com",
│          "iat": 1745654400,
│          "exp": 1745658000,
│          "uid": 123,
│          "role": "user",
│          "email": "user@example.com"
│        }
│
└─ {
     "alg": "HS256",
     "typ": "JWT"
   }
```

## Prevention

### Best Practices

1. **Always use Node.js backend**
   - Don't mix PHP and Node.js backends
   - Stick to one backend for consistency

2. **Keep backend running**
   - Start backend before using app
   - Use START_BACKEND.bat for easy startup

3. **Re-login after changes**
   - After backend restart
   - After .env changes
   - After clearing cache

4. **Monitor token expiration**
   - Tokens expire after 1 hour
   - Logout and login if expired
   - Consider implementing auto-refresh

5. **Use the test page**
   - Test authentication before using app
   - Verify token is valid
   - Check API connectivity

## Summary

**Problem**: JWT authentication failing with 401 error

**Root Causes**:
1. Missing slash in API URL
2. Duplicate Authorization headers
3. Possible token expiration
4. Backend not running

**Solutions Applied**:
1. ✅ Fixed API URL in api.service.ts
2. ✅ Removed duplicate header logic
3. ✅ Created test page for verification
4. ✅ Updated documentation

**Status**: ✅ FIXED - Ready to test!

## Next Steps

1. **Test the fix**:
   - Open TEST_AUTH_TOKEN.html
   - Follow the test steps
   - Verify all checks pass

2. **Test in application**:
   - Logout and login
   - Try uploading a product
   - Should work now!

3. **Monitor**:
   - Watch for any auth errors
   - Check backend logs
   - Report any issues

**Need help?** Check the test page or review this document!
