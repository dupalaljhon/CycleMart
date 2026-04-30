# 🔧 Step-by-Step Fix for 401 Error

You're still getting 401 error even after logging in. Let's diagnose and fix this systematically.

## 🚀 Step 1: Run Diagnostic Tool

1. **Open** `DEBUG_UPLOAD.html` in your browser (double-click it)
2. **Wait** for all tests to run automatically
3. **Read** the results carefully

The diagnostic tool will tell you EXACTLY what's wrong.

---

## 📊 What to Look For

### Test 1: Check Token
- ✅ **If shows "TOKEN VALID"**: Token is good, continue to next test
- ❌ **If shows "NO TOKEN FOUND"**: You're not actually logged in
- ❌ **If shows "TOKEN EXPIRED"**: Token expired, need to login again
- ❌ **If shows "INVALID TOKEN"**: Token is corrupted

### Test 2: Check Backend
- ✅ **If shows "BACKEND IS RUNNING"**: Backend is working
- ❌ **If shows "CANNOT CONNECT"**: Backend is not running

### Test 3: Test Upload Endpoint
- ✅ **If shows "UPLOAD ENDPOINT WORKS"**: Everything is fine!
- ❌ **If shows "401 UNAUTHORIZED"**: This is the problem - read the diagnosis

### Test 4: Check localStorage
- Look for any warnings about UID mismatch
- Verify userID is present

---

## 🔧 Common Issues & Fixes

### Issue 1: Backend Not Running
**Symptoms**: Test 2 fails with "CANNOT CONNECT"

**Fix**:
```bash
cd CycleMart/CycleMart-api-node
npm start
```

Or double-click `START_BACKEND.bat`

---

### Issue 2: Not Actually Logged In
**Symptoms**: Test 1 shows "NO TOKEN FOUND"

**Fix**:
1. Go to CycleMart app
2. Click Login
3. Enter your credentials
4. After successful login, run DEBUG_UPLOAD.html again

---

### Issue 3: Token Expired
**Symptoms**: Test 1 shows "TOKEN EXPIRED"

**Fix**:
1. Go to CycleMart app
2. Logout
3. Login again
4. Try uploading

---

### Issue 4: Old PHP Token
**Symptoms**: Test 3 shows "401 UNAUTHORIZED" with message about JWT verification

**Fix**:
1. In `DEBUG_UPLOAD.html`, click **"Clear Everything & Force Logout"**
2. Go to CycleMart app
3. You should be logged out
4. Login again
5. Try uploading

---

### Issue 5: User ID Mismatch
**Symptoms**: Test 4 shows warning about UID mismatch

**Fix**:
1. Clear localStorage: Click "Clear Everything & Force Logout" in DEBUG_UPLOAD.html
2. Login again
3. Try uploading

---

## 🎯 Nuclear Option (If Nothing Works)

If all else fails, do this:

### Step 1: Clear Browser Completely
```javascript
// Open browser console (F12 → Console)
localStorage.clear();
sessionStorage.clear();
```

### Step 2: Close ALL Browser Tabs
- Close every tab of your CycleMart app
- Close the browser completely

### Step 3: Restart Backend
```bash
# Stop backend (Ctrl+C in terminal)
# Start again:
cd CycleMart/CycleMart-api-node
npm start
```

### Step 4: Open Fresh Browser Tab
1. Open new browser tab
2. Go to http://localhost:4200
3. Login with credentials
4. Try uploading

---

## 🔍 Advanced Debugging

If you're still having issues, check these:

### Check 1: Verify JWT_SECRET in .env
```bash
# Open: CycleMart/CycleMart-api-node/.env
# Should contain:
JWT_SECRET=cyclemart_secret_key_2026
```

### Check 2: Verify Backend Logs
Look at the terminal where backend is running. When you try to upload, you should see:
- Request received
- Any error messages

### Check 3: Check Browser Network Tab
1. Open browser (F12 → Network tab)
2. Try uploading a product
3. Find the `addProduct` request
4. Click on it
5. Check:
   - **Headers** → Authorization header should be present
   - **Response** → What error message does it show?

### Check 4: Verify Token Format
```javascript
// In browser console:
const token = localStorage.getItem('authToken');
console.log('Token:', token);

// Decode it:
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log('Payload:', payload);

// Check:
// - Does it have 'uid' field?
// - Does it have 'exp' field?
// - Is exp in the future?
```

---

## 📞 Provide These Details

If still not working, provide:

1. **Screenshot of DEBUG_UPLOAD.html** showing all 4 test results
2. **Backend terminal output** (copy the last 20 lines)
3. **Browser console errors** (F12 → Console tab)
4. **Network tab screenshot** showing the failed addProduct request

---

## 🎯 Most Likely Solution

Based on your symptoms, the most likely issue is:

**You logged in, but the token is still from the old PHP backend.**

This can happen if:
- You logged in before the Node.js backend was running
- Browser cached the old login response
- localStorage wasn't properly cleared

**Solution**:
1. Click "Clear Everything & Force Logout" in DEBUG_UPLOAD.html
2. Close ALL browser tabs
3. Make sure Node.js backend is running
4. Open fresh browser tab
5. Login again
6. Try uploading

This should work 100%.

---

## ✅ Success Indicators

After fixing, you should see:
- ✅ Test 1: TOKEN VALID
- ✅ Test 2: BACKEND IS RUNNING
- ✅ Test 3: UPLOAD ENDPOINT WORKS (or at least not 401)
- ✅ Test 4: No warnings

Then try uploading in the actual app - should work!

---

## 🚨 Emergency Contact

If NOTHING works after trying everything above:

1. Run `DEBUG_UPLOAD.html`
2. Take screenshot of all results
3. Copy backend terminal output
4. Copy browser console errors
5. Provide all of these

We'll figure it out!
