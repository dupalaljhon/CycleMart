# CycleMart API Deployment Guide - Hostinger

## Current Setup
- **Domain**: cyclemart.shop
- **API Subdomain**: api.cyclemart.shop
- **Document Root**: /home/u385622194/domains/cyclemart.shop/public_html
- **Database Host**: auth-db2054.hstgr.io
- **Database Name**: u385622194_cyclemart

## Deployment Steps

### 1. Upload Files to Hostinger

Upload your `CycleMart-api` folder to:
```
/home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/
```

Your structure should be:
```
/home/u385622194/domains/cyclemart.shop/public_html/
├── CycleMart-api/
│   └── api/
│       ├── .htaccess
│       ├── routes.php
│       ├── health.php
│       ├── config/
│       │   └── database.php
│       ├── modules/
│       │   ├── get.php
│       │   ├── post.php
│       │   ├── global.php
│       │   └── vendor/
│       └── uploads/
```

### 2. Test Health Check

Before testing login, verify the API is working:

**Test URL**: https://api.cyclemart.shop/CycleMart-api/api/health.php

Expected Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-18 12:00:00",
  "checks": {
    "php_version": "8.x",
    "pdo_available": true,
    "pdo_mysql_available": true,
    "composer_autoload": true,
    "database_connection": "success"
  }
}
```

### 3. Common Issues and Fixes

#### Issue 1: 500 Internal Server Error

**Possible Causes:**
1. **Missing PHP extensions**
   - Check if PDO and PDO_MySQL are installed
   - Check if JWT library is available

2. **Composer dependencies not installed**
   ```bash
   cd /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/modules
   composer install
   ```

3. **File permissions**
   ```bash
   chmod -R 755 /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api
   chmod -R 777 /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/uploads
   ```

4. **PHP version**
   - Ensure PHP 7.4+ is selected in Hostinger control panel
   - Go to: Hosting → PHP Configuration → Select PHP 8.0 or higher

#### Issue 2: Database Connection Failed

**Check:**
1. Database credentials in `config/database.php` are correct
2. Database user has proper permissions
3. Database server allows connections from your hosting server

**Test Connection:**
Create a test file `test-db.php`:
```php
<?php
require_once 'config/database.php';
try {
    $con = new Connection();
    $pdo = $con->connect();
    echo "Database connected successfully!";
} catch (Exception $e) {
    echo "Connection failed: " . $e->getMessage();
}
```

#### Issue 3: JWT Token Generation Fails

**Install firebase/php-jwt via Composer:**
```bash
cd /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/modules
composer require firebase/php-jwt
```

#### Issue 4: CORS Errors

The `.htaccess` file already includes CORS headers, but if issues persist:

Add to top of `routes.php`:
```php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
```

### 4. Enable Error Logging

Create `.user.ini` in `/home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/`:
```ini
display_errors = On
error_reporting = E_ALL
log_errors = On
error_log = /home/u385622194/domains/cyclemart.shop/public_html/api_errors.log
```

Then check the error log file for detailed errors.

### 5. Update Angular API URL

In your Angular app, update the API base URL:

**File**: `src/app/api/api.service.ts`
```typescript
export class ApiService {
  baseUrl = 'https://api.cyclemart.shop/CycleMart-api/api/';
  // ... rest of code
}
```

### 6. Testing Endpoints

After deployment, test these endpoints in order:

1. **Health Check**
   ```
   GET https://api.cyclemart.shop/CycleMart-api/api/health.php
   ```

2. **Test Login**
   ```
   POST https://api.cyclemart.shop/CycleMart-api/api/login
   Content-Type: application/json
   
   {
     "email": "test@gmail.com",
     "password": "yourpassword"
   }
   ```

3. **Test GET User**
   ```
   GET https://api.cyclemart.shop/CycleMart-api/api/user?id=1
   ```

### 7. Debugging via Hostinger

1. **Access File Manager**
   - Login to Hostinger
   - Go to File Manager
   - Navigate to your API directory

2. **Check Error Logs**
   - Look for `api_errors.log` in your directory
   - Or check Hostinger's error log in cPanel

3. **Use SSH (if available)**
   ```bash
   ssh u385622194@your-hosting-server.com
   cd domains/cyclemart.shop/public_html/CycleMart-api/api
   tail -f api_errors.log
   ```

### 8. Production Checklist

Before going live:

- [ ] Composer dependencies installed
- [ ] Database credentials are correct
- [ ] File permissions set correctly (755 for folders, 644 for files)
- [ ] Upload directories writable (777 for uploads/)
- [ ] PHP version 7.4+ selected
- [ ] Error logging enabled
- [ ] Health check endpoint returns success
- [ ] Test login endpoint works
- [ ] CORS headers configured
- [ ] SSL certificate installed (HTTPS)
- [ ] Remove debug error messages in production

### 9. Hostinger-Specific Settings

**In Hostinger Control Panel:**

1. **PHP Configuration**
   - Version: PHP 8.0 or 8.1
   - Extensions: Enable PDO, PDO_MySQL, JSON, MBString, OpenSSL

2. **PHP.INI Settings**
   ```ini
   max_execution_time = 300
   max_input_time = 300
   memory_limit = 256M
   post_max_size = 50M
   upload_max_filesize = 50M
   ```

3. **Database Remote Access**
   - If needed, add your IP to MySQL Remote Access in cPanel

### 10. Monitoring

**Set up monitoring for:**
- API uptime (use UptimeRobot or similar)
- Error logs (check daily)
- Database connection status
- Response times

### Quick Fix Commands

If you have SSH access:

```bash
# Navigate to API directory
cd /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api

# Install composer dependencies
cd modules && composer install && cd ..

# Set permissions
chmod -R 755 .
chmod -R 777 uploads/

# View recent errors
tail -50 ../api_errors.log

# Test database connection
php -r "require 'config/database.php'; \$c = new Connection(); \$c->connect(); echo 'OK';"
```

### Support Resources

- **Hostinger Support**: https://www.hostinger.com/support
- **PHP-JWT Documentation**: https://github.com/firebase/php-jwt
- **Your Error Log**: Check `/home/u385622194/domains/cyclemart.shop/public_html/api_errors.log`

## Troubleshooting Current 500 Error

Based on your error, here's what to check **RIGHT NOW**:

1. **SSH into Hostinger and run:**
   ```bash
   cd /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/modules
   composer install
   ```

2. **Check if vendor folder exists:**
   ```bash
   ls -la /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/modules/vendor
   ```

3. **View the actual error:**
   - Go to: https://api.cyclemart.shop/CycleMart-api/api/health.php
   - This will show you exactly what's wrong

4. **Check PHP version:**
   - Login to Hostinger control panel
   - Check if PHP 7.4+ is selected for your domain

5. **Verify database connection:**
   - The credentials in `database.php` must match your Hostinger MySQL database
   - Host: auth-db2054.hstgr.io
   - Database: u385622194_cyclemart
   - User: u385622194_cyclemart_db

Once you run the health check endpoint, you'll see exactly what's causing the 500 error!
