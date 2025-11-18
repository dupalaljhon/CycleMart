# Fixing "Forbidden" Error on API

## Current Issue
```
{"status":"error","message":"Forbidden"}
```

This error occurs when:
1. The endpoint exists but the request doesn't match the switch case
2. The .htaccess rewrite rule isn't working correctly
3. The request parameter isn't being passed properly

## Debugging Steps

### Step 1: Test Basic Routing
```
https://api.cyclemart.shop/CycleMart-api/api/test-routing.php
```

This should show if the server can execute PHP and return request information.

### Step 2: Test Database Connection
```
https://api.cyclemart.shop/CycleMart-api/api/test-db-connection.php
```

This verifies database connectivity with different host configurations.

### Step 3: Test Direct Login (Bypassing .htaccess)
```
POST https://api.cyclemart.shop/CycleMart-api/api/routes.php?request=login
Content-Type: application/json

{
  "email": "test@gmail.com",
  "password": "yourpassword"
}
```

If this works, the issue is with .htaccess rewriting.

### Step 4: Check .htaccess Rewrite

The .htaccess should be rewriting:
```
/CycleMart-api/api/login → /CycleMart-api/api/routes.php?request=login
```

#### Verify .htaccess is Working:

Test this URL:
```
https://api.cyclemart.shop/CycleMart-api/api/login
```

Check server error logs to see if `request` parameter is being set.

### Step 5: Check Error Logs

In Hostinger File Manager, check for error log files:
- `/home/u385622194/domains/cyclemart.shop/public_html/api_errors.log`
- Or check cPanel → Error Log

Look for lines like:
```
Request endpoint: login
POST Endpoint: login
```

## Common Causes & Fixes

### Cause 1: .htaccess Not Working

**Symptom**: `{"status":"error","message":"Not Found","debug":"No request parameter"}`

**Fix**: Verify .htaccess file exists and mod_rewrite is enabled

Create a test .htaccess in `/CycleMart-api/api/`:
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Test if rewrite is working
    RewriteRule ^test-rewrite$ test-routing.php?rewrite=working [L]
    
    # Your actual rules
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^(.*)$ routes.php?request=$1 [L,QSA]
</IfModule>
```

Then test: `https://api.cyclemart.shop/CycleMart-api/api/test-rewrite`

### Cause 2: Wrong Endpoint Name

**Symptom**: Reaches default case with "Forbidden"

**Fix**: Ensure you're calling `/login` not `/loginUser`

Correct endpoints:
- `POST /login` (not /loginUser)
- `POST /register` (not /registerUser)
- `GET /user?id=1` (not /getUser?id=1)

### Cause 3: Request Not Being Parsed

**Symptom**: Error logs show "Request: NONE"

**Fix**: Check if $_REQUEST['request'] is being set by .htaccess

Add this to routes.php temporarily:
```php
error_log("REQUEST array: " . print_r($_REQUEST, true));
error_log("SERVER REQUEST_URI: " . $_SERVER['REQUEST_URI']);
```

### Cause 4: JSON Not Being Parsed

**Symptom**: Error about invalid JSON

**Fix**: Ensure you're sending proper JSON:
```javascript
fetch('https://api.cyclemart.shop/CycleMart-api/api/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@gmail.com',
    password: 'yourpassword'
  })
})
```

## Testing with cURL

Test login directly from command line:

```bash
curl -X POST https://api.cyclemart.shop/CycleMart-api/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com","password":"Test123!@#"}'
```

Or with explicit query parameter:
```bash
curl -X POST "https://api.cyclemart.shop/CycleMart-api/api/routes.php?request=login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com","password":"Test123!@#"}'
```

## Testing with Postman

1. **Method**: POST
2. **URL**: `https://api.cyclemart.shop/CycleMart-api/api/login`
3. **Headers**:
   - Content-Type: `application/json`
4. **Body** (raw JSON):
```json
{
  "email": "test@gmail.com",
  "password": "Test123!@#"
}
```

## Quick Checklist

- [ ] Database connection works (test-db-connection.php shows SUCCESS)
- [ ] Basic PHP execution works (test-routing.php returns JSON)
- [ ] .htaccess file exists in `/CycleMart-api/api/` directory
- [ ] mod_rewrite is enabled on server
- [ ] Using correct endpoint names (e.g., `/login` not `/loginUser`)
- [ ] Sending proper JSON with Content-Type header
- [ ] Request parameter is being set by .htaccess
- [ ] Error logs show endpoint is being reached

## Updated Files to Upload

Make sure these files are uploaded to your server:

1. **routes.php** - Updated with better error logging
2. **.htaccess** - Updated with proper rewrite rules
3. **database.php** - Updated to use `localhost`
4. **test-routing.php** - NEW - Test basic routing
5. **test-db-connection.php** - NEW - Test database connections
6. **health.php** - NEW - Health check endpoint

## Next Steps

1. Upload all updated files to Hostinger
2. Test endpoints in this order:
   - test-routing.php
   - test-db-connection.php
   - health.php
   - login (via routes.php?request=login)
   - login (via clean URL /login)

3. Check error logs after each test
4. Report back which tests pass/fail

## If Still Getting "Forbidden"

The error logs will now show:
- Exact endpoint being called
- Whether request parameter is set
- JSON parsing status
- Which switch case is being hit

Check the logs and share the output!
