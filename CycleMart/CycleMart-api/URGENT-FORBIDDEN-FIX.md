# URGENT: Fixing "Forbidden" Error on ALL PHP Files

## Problem
Getting `{"status":"error","message":"Forbidden"}` on ALL PHP files, even simple test files.

This is NOT a PHP error - it's an Apache/Server configuration blocking access to your files.

## Immediate Fix Steps

### Step 1: Check File Permissions in Hostinger

1. **Login to Hostinger File Manager**
2. **Navigate to**: `/home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/`
3. **Right-click on any PHP file → Permissions**
4. **Set permissions to**: `644` (or `-rw-r--r--`)
5. **For directories**: Set to `755` (or `drwxr-xr-x`)

**Quick Fix via File Manager:**
- Select all files in the `api` folder
- Right-click → Change Permissions
- Set: Owner: Read+Write, Group: Read, Public: Read
- Check: Apply to all files recursively

### Step 2: Upload Updated Files

Upload these NEW/UPDATED files:
1. ✅ `.htaccess` (in `/CycleMart-api/api/`) - Updated with access permissions
2. ✅ `.htaccess` (in `/CycleMart-api/`) - NEW parent directory config
3. ✅ `index.php` (in `/CycleMart-api/api/`) - Updated with API info
4. ✅ `simple-test.php` (in `/CycleMart-api/api/`) - NEW ultra-simple test

### Step 3: Test in This Order

**Test 1 - Ultra Simple (No JSON, No Headers):**
```
https://api.cyclemart.shop/CycleMart-api/api/simple-test.php
```
Expected: `PHP is working! Server time: 2025-11-18 12:00:00`

If this fails → File permissions issue

**Test 2 - API Index:**
```
https://api.cyclemart.shop/CycleMart-api/api/
```
or
```
https://api.cyclemart.shop/CycleMart-api/api/index.php
```
Expected: JSON with API information

**Test 3 - Then try other files:**
```
https://api.cyclemart.shop/CycleMart-api/api/test-routing.php
https://api.cyclemart.shop/CycleMart-api/api/test-db-connection.php
```

## Common Causes & Solutions

### Cause 1: Wrong File Permissions (MOST LIKELY)

**Symptoms**: 
- 403 Forbidden on all PHP files
- Works locally but not on Hostinger

**Fix**:
```bash
# Via SSH (if available)
cd /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api
chmod -R 755 .
chmod -R 644 api/*.php
chmod 755 api/
```

**Via File Manager**:
- Select all files → Right-click → Permissions
- Files: `644`
- Folders: `755`
- Apply recursively

### Cause 2: .htaccess Blocking Access

**Symptoms**:
- Forbidden on specific directory
- Other PHP files work but not in this directory

**Fix**: The updated `.htaccess` now includes:
```apache
<FilesMatch "\.php$">
    Require all granted
</FilesMatch>
```

### Cause 3: Security Plugin/Firewall

**Symptoms**:
- Works for some IPs but not others
- Random blocks

**Fix in Hostinger**:
1. Go to Security → Firewall
2. Check if your IP is blocked
3. Whitelist necessary IPs
4. Disable ModSecurity temporarily for testing

### Cause 4: PHP Execution Disabled

**Symptoms**:
- PHP files download instead of execute
- Or show 403 Forbidden

**Fix in Hostinger**:
1. Go to Advanced → PHP Configuration
2. Ensure PHP is enabled
3. Select PHP 7.4+ or 8.0+
4. Save and reload

### Cause 5: Index.php Causing Issues

**Symptoms**:
- Directory access works but files don't

**Fix**: Upload the updated `index.php` which now provides API info instead of being commented out.

## Hostinger-Specific Checks

### Check 1: PHP Version
1. Login to Hostinger hPanel
2. Go to: Advanced → PHP Configuration
3. Select: PHP 8.0 or 8.1
4. Extensions: Enable PDO, PDO_MySQL, MBString, JSON

### Check 2: Directory Protection
1. Go to: Files → Directory Privacy
2. Check if `/CycleMart-api/api/` is password protected
3. If yes, remove protection for testing

### Check 3: IP Blocking
1. Go to: Security → IP Blocker
2. Check if your IP is blocked
3. Check CloudFlare settings if enabled

### Check 4: ModSecurity
1. Go to: Security → ModSecurity
2. Temporarily disable for testing
3. Re-enable after fixing permissions

## Alternative: Create Outside api Folder

If nothing works, test if the issue is specific to the `/api/` folder:

Create this file at: `/home/u385622194/domains/cyclemart.shop/public_html/test.php`

```php
<?php
echo "Test from root: " . date('Y-m-d H:i:s');
```

Access: `https://api.cyclemart.shop/test.php`

If this works but files in `/api/` don't → Permissions issue with `/api/` directory

## Nuclear Option: Recreate Directory

If absolutely nothing works:

1. **Rename current folder**:
   - Rename `/CycleMart-api/api/` to `/CycleMart-api/api-backup/`

2. **Create fresh folder**:
   ```bash
   mkdir /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api
   chmod 755 /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api
   ```

3. **Upload files one by one**:
   - Start with `simple-test.php`
   - Test after each upload
   - Once working, copy all files

4. **Set permissions**:
   ```bash
   chmod 644 /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/*.php
   ```

## Contact Hostinger Support

If none of these work, contact Hostinger support with this information:

**Subject**: "Getting 403 Forbidden on all PHP files in specific directory"

**Message**:
```
I'm getting 403 Forbidden errors on all PHP files in this directory:
/home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/

The error occurs even on a simple test file:
https://api.cyclemart.shop/CycleMart-api/api/simple-test.php

- File permissions are set to 644
- Directory permissions are set to 755
- PHP version is 8.0+
- The same files work in the parent directory
- No .htpasswd protection is set

Please help me identify what's blocking PHP execution in this directory.
```

## Quick Diagnostic Commands (SSH)

If you have SSH access:

```bash
# Check current permissions
ls -la /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/

# Fix all permissions at once
cd /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

# Test PHP execution
php /home/u385622194/domains/cyclemart.shop/public_html/CycleMart-api/api/simple-test.php

# Check if .htaccess is causing issues
mv api/.htaccess api/.htaccess.bak
# Then test if files work
```

## Expected Behavior After Fix

1. ✅ `simple-test.php` shows: "PHP is working! Server time: ..."
2. ✅ `index.php` shows: JSON with API info
3. ✅ `test-routing.php` shows: JSON with request details
4. ✅ `test-db-connection.php` shows: Database test results
5. ✅ `/login` endpoint accepts POST requests

---

## MOST IMPORTANT

The fact that ALL PHP files return the same error means it's NOT a code issue - it's a **file permission or server configuration issue**.

**Top priority**: Fix file permissions to 644 for PHP files and 755 for directories!
