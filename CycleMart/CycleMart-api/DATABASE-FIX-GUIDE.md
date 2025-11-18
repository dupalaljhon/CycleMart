# Database Connection Fix Guide - Hostinger

## Current Error
```
Access denied for user 'u385622194_cyclemart_db'@'2a02:4780:5c:1234::32' (using password: YES)
```

This error means either:
1. The database host is incorrect
2. The database password is wrong
3. The database user doesn't have proper permissions
4. Remote access is not allowed

## Fix Steps

### Step 1: Verify Database Credentials in Hostinger

1. **Login to Hostinger Control Panel**
2. **Go to MySQL Databases**
3. **Check the following:**
   - Database name (should be: `u385622194_cyclemart`)
   - Database user (should be: `u385622194_cyclemart_db`)
   - Database host (usually `localhost` NOT `auth-db2054.hstgr.io`)

### Step 2: Important - Hostinger Database Host

**Most Hostinger accounts use `localhost` or `127.0.0.1` as the database host, NOT the external hostname!**

The external host (`auth-db2054.hstgr.io`) is typically only for remote connections from outside Hostinger's network.

### Step 3: Test Database Connections

Upload the `test-db-connection.php` file and access it:

```
https://api.cyclemart.shop/CycleMart-api/api/test-db-connection.php
```

This will test 3 different configurations and tell you which one works.

### Step 4: Update Database Configuration

Based on the test results, update `config/database.php`:

#### If localhost works:
```php
define("SERVER", "localhost");
define("DATABASE", "u385622194_cyclemart");
define("USER", "u385622194_cyclemart_db");
define("PASSWORD", "CycleMart_CTP");
define("DRIVER", "mysql");
```

#### If 127.0.0.1 works:
```php
define("SERVER", "127.0.0.1");
define("DATABASE", "u385622194_cyclemart");
define("USER", "u385622194_cyclemart_db");
define("PASSWORD", "CycleMart_CTP");
define("DRIVER", "mysql");
```

### Step 5: Verify Database User Permissions

In Hostinger Control Panel → MySQL Databases:

1. **Check Current Users**
   - Find user: `u385622194_cyclemart_db`
   - Check if it's assigned to database: `u385622194_cyclemart`

2. **If user not assigned to database:**
   - Under "Add User To Database"
   - Select user: `u385622194_cyclemart_db`
   - Select database: `u385622194_cyclemart`
   - Click "Add"
   - Grant ALL PRIVILEGES

### Step 6: Reset Database Password (If Needed)

If you're not sure about the password:

1. Go to **MySQL Databases** in Hostinger
2. Find user: `u385622194_cyclemart_db`
3. Click **Change Password**
4. Set new password: `CycleMart_CTP` (or your preferred password)
5. Update `config/database.php` with the new password

### Step 7: Check Remote Access Settings

If you MUST use the external host (`auth-db2054.hstgr.io`):

1. Go to **Remote MySQL** in Hostinger control panel
2. Add your server's IP address to allowed hosts
3. The IP in the error is: `2a02:4780:5c:1234::32`

**However, for same-server connections, always use `localhost`!**

## Quick Fix Commands (If you have SSH)

```bash
# Test database connection from command line
mysql -h localhost -u u385622194_cyclemart_db -p u385622194_cyclemart

# If that works, your host should be "localhost"
```

## Common Hostinger Database Configurations

### Shared Hosting (Most Common)
```php
define("SERVER", "localhost");
```

### VPS/Cloud Hosting
```php
define("SERVER", "127.0.0.1");
// or
define("SERVER", "localhost");
```

### Remote Connection (Usually not needed for same-server apps)
```php
define("SERVER", "auth-db2054.hstgr.io");
```

## Troubleshooting Checklist

- [ ] Verified database name in Hostinger control panel
- [ ] Verified database username in Hostinger control panel
- [ ] Verified/reset database password
- [ ] Confirmed database user is assigned to database with ALL PRIVILEGES
- [ ] Tested with `localhost` as host
- [ ] Tested with `127.0.0.1` as host
- [ ] Ran test-db-connection.php to identify working configuration
- [ ] Updated config/database.php with working configuration

## Next Steps After Fixing

1. **Update the database.php file** with the working configuration
2. **Re-upload** the updated file to Hostinger
3. **Test the API** again:
   ```
   POST https://api.cyclemart.shop/CycleMart-api/api/login
   ```
4. **Clear any cache** in your browser or Angular app

## Contact Hostinger Support

If none of these work, contact Hostinger support and ask:

1. "What is the correct MySQL host for my hosting account?"
2. "How do I verify my database user has proper permissions?"
3. "Why am I getting 'Access denied' when connecting from the same server?"

Provide them:
- Your hosting username: `u385622194`
- Database name: `u385622194_cyclemart`
- Database user: `u385622194_cyclemart_db`
- The error message you're getting

---

**MOST LIKELY FIX**: Change the SERVER from `auth-db2054.hstgr.io` to `localhost` in your database.php file!
