<?php
// ðŸ”¹ CORS headers (must be first, before any output)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");


// ðŸ”¹ Handle preflight request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}


require_once "global.php"; 
require_once 'vendor/autoload.php';
use Firebase\JWT\JWT;

class Post extends GlobalMethods {
    private $pdo;
    private $key;

    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
        $this->key = getenv('JWT_SECRET') ?: 'your_secret_key';
    }

    // âœ… Registration with hashing and email verification
    // RESTRICTED TO OLONGAPO CITY ONLY
    public function registerUser($data) {
        $full_name = $data->full_name ?? '';
        $email = $data->email ?? '';
        $password = $data->password ?? '';
        $phone = $data->phone ?? '';
        $street = $data->street ?? '';
        $barangay = $data->barangay ?? '';
        $terms_accepted = $data->terms_accepted ?? 0;

        // Automatically set city to Olongapo City (no user input needed)
        $city = 'Olongapo City';

        // Define valid barangays for Olongapo City
        $validBarangays = [
            'Asinan', 'Banicain', 'Barretto', 'East Bajac-Bajac', 'Gordon Heights',
            'Kalaklan', 'Mabayuan', 'New Cabalan', 'Old Cabalan', 'Pag-asa',
            'Santa Rita', 'West Bajac-Bajac', 'East Tapinac', 'West Tapinac',
            'New Kalalake', 'Kababae', 'Ilalim'
        ];

        // Validate required fields (province removed)
        if (!$full_name || !$email || !$password || !$phone || !$street || !$barangay) {
            return $this->sendPayload(null, "error", "All fields are required", 400);
        }

        // Validate barangay against allowed list
        if (!in_array($barangay, $validBarangays)) {
            return $this->sendPayload(null, "error", "Invalid barangay. Please select a valid barangay from Olongapo City.", 400);
        }

        // Validate email format
        if (!preg_match('/^[^\s@]+@gmail\.com$/i', $email)) {
            return $this->sendPayload(null, "error", "Invalid email format", 400);
        }

        // Check if user already exists
        $sql = "SELECT id FROM users WHERE email = :email";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':email' => $email]);
            if ($stmt->fetch()) {
                return $this->sendPayload(null, "error", "Email already registered", 409);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        // Generate verification token
        $verificationToken = bin2hex(random_bytes(32));
        $tokenExpiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

        // Insert new user with verification token (province removed)
        $sql = "INSERT INTO users (full_name, email, password, phone, street, barangay, city, terms_accepted, verification_token, token_expires_at, is_verified) 
                VALUES (:full_name, :email, :password, :phone, :street, :barangay, :city, :terms_accepted, :verification_token, :token_expires_at, 0)";

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':full_name' => $full_name,
                ':email' => $email,
                ':password' => $hashedPassword,
                ':phone' => $phone,
                ':street' => $street,
                ':barangay' => $barangay,
                ':city' => $city,
                ':terms_accepted' => $terms_accepted,
                ':verification_token' => $verificationToken,
                ':token_expires_at' => $tokenExpiresAt
            ]);

            $userId = $this->pdo->lastInsertId();

            // Send verification email
            require_once __DIR__ . '/../../sendMail.php';
            $emailResult = sendVerificationEmail(
                $email, 
                $full_name, 
                $verificationToken, 
                'http://localhost:4200'
                // 'https://cyclemart.shop'
            );

            $responseData = [
                "userID" => $userId,
                "email" => $email,
                "full_name" => $full_name,
                "city" => $city,
                "barangay" => $barangay,
                "verification_email_sent" => $emailResult['status'] === 'success'
            ];

            if ($emailResult['status'] === 'success') {
                return $this->sendPayload($responseData, "success", "Registration successful! Please check your email to verify your account.", 201);
            } else {
                // User registered but email failed
                return $this->sendPayload($responseData, "warning", "Registration successful but verification email failed to send. Please contact support.", 201);
            }

        } catch (\PDOException $e) {
            error_log("Registration error: " . $e->getMessage());
            if ($e->getCode() == 23000) { // Duplicate entry
                return $this->sendPayload(null, "error", "Email already exists", 409);
            }
            return $this->sendPayload(null, "error", "Registration failed: " . $e->getMessage(), 500);
        }
    }

    // ✅ Email verification method
    public function verifyEmail($data) {
        $token = $data->token ?? '';

        if (empty($token)) {
            return $this->sendPayload(null, "error", "Verification token is required", 400);
        }

        $sql = "SELECT id, email, full_name, is_verified, token_expires_at FROM users WHERE verification_token = :token";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':token' => $token]);
            $user = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$user) {
                return $this->sendPayload(null, "error", "Invalid verification token", 400);
            }

            // Check if user is already verified
            if ($user['is_verified']) {
                return $this->sendPayload([
                    "userID" => $user['id'],
                    "email" => $user['email'],
                    "full_name" => $user['full_name'],
                    "verified" => true
                ], "success", "Your account is already verified! You can login to your account.", 200);
            }

            // Check if token has expired
            if (strtotime($user['token_expires_at']) < time()) {
                return $this->sendPayload(null, "error", "Verification token has expired", 400);
            }

            // Update user as verified and clear token
            $updateSql = "UPDATE users SET is_verified = 1, verification_token = NULL, token_expires_at = NULL WHERE id = :user_id";
            $updateStmt = $this->pdo->prepare($updateSql);
            $updateStmt->execute([':user_id' => $user['id']]);

            return $this->sendPayload([
                "userID" => $user['id'],
                "email" => $user['email'],
                "full_name" => $user['full_name'],
                "verified" => true
            ], "success", "Email verified successfully! You can now login to your account.", 200);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Verification failed: " . $e->getMessage(), 500);
        }
    }

    // ✅ Resend verification email
    public function resendVerificationEmail($data) {
        $email = $data->email ?? '';

        if (empty($email)) {
            return $this->sendPayload(null, "error", "Email is required", 400);
        }

        if (!preg_match('/^[^\s@]+@gmail\.com$/i', $email)) {
            return $this->sendPayload(null, "error", "Invalid email format", 400);
        }

        $sql = "SELECT id, full_name, is_verified FROM users WHERE email = :email";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':email' => $email]);
            $user = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$user) {
                return $this->sendPayload(null, "error", "User not found", 404);
            }

            // Check if user is already verified
            if ($user['is_verified']) {
                return $this->sendPayload([
                    "email" => $email,
                    "full_name" => $user['full_name'],
                    "verified" => true
                ], "success", "Your account is already verified! You can login to your account.", 200);
            }

            // Generate new verification token
            $verificationToken = bin2hex(random_bytes(32));
            $tokenExpiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

            // Update user with new token
            $updateSql = "UPDATE users SET verification_token = :token, token_expires_at = :expires WHERE id = :user_id";
            $updateStmt = $this->pdo->prepare($updateSql);
            $updateStmt->execute([
                ':token' => $verificationToken,
                ':expires' => $tokenExpiresAt,
                ':user_id' => $user['id']
            ]);

            // Send verification email
            require_once __DIR__ . '/../../sendMail.php';
            $emailResult = sendVerificationEmail(
                $email, 
                $user['full_name'], 
                $verificationToken, 
                'http://localhost:4200'
                // 'https://cyclemart.shop'
            );

            if ($emailResult['status'] === 'success') {
                return $this->sendPayload([
                    "email" => $email,
                    "message" => "Verification email sent"
                ], "success", "Verification email sent successfully! Please check your inbox.", 200);
            } else {
                return $this->sendPayload(null, "error", "Failed to send verification email", 500);
            }

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Failed to resend verification email: " . $e->getMessage(), 500);
        }
    }

    // âœ… Login with bcrypt + JWT
public function loginUser($data) {
    $email = $data->email ?? null;
    $password = $data->password ?? null;

    if (!$email || !$password) {
        return $this->sendPayload(null, "error", "Email and password required", 400);
    }

    $sql = "SELECT * FROM users WHERE email = :email";
    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password'])) {
            // Check if email is verified
            if (!$user['is_verified']) {
                return $this->sendPayload([
                    'email' => $user['email'],
                    'requires_verification' => true
                ], "error", "Please verify your email address before logging in. Check your inbox for the verification email.", 403);
            }

            // Check if account is banned
            if ($user['account_status'] === 'banned') {
                return $this->sendPayload([
                    'banned' => true,
                    'account_status' => 'banned',
                    'violation_count' => $user['violation_count']
                ], "error", "Your account has been permanently banned due to multiple violations. Please contact support.", 403);
            }

            $payload = [
                'iss' => "http://example.org", 
                'aud' => "http://example.com", 
                'iat' => time(), 
                'exp' => time() + 3600, 
                'uid' => $user['id'],
                'role' => $user['role'] ?? 'user',
                'email' => $user['email']
            ];
            $jwt = JWT::encode($payload, $this->key, 'HS256');

            // If this user is an approved moderator, include linked admin account info
            // (admins are created during moderator approval, using the same email)
            $adminSession = null;
            if (!empty($user['role']) && $user['role'] === 'moderator') {
                try {
                    // Prefer a stable linkage (admins.user_id -> users.id) if present.
                    // Fallback to email matching for older schemas.
                    $admin = null;

                    try {
                        $adminLookupSql = "SELECT admin_id, username, email, full_name, role, status FROM admins WHERE user_id = :uid LIMIT 1";
                        $adminLookupStmt = $this->pdo->prepare($adminLookupSql);
                        $adminLookupStmt->execute([':uid' => $user['id']]);
                        $admin = $adminLookupStmt->fetch(\PDO::FETCH_ASSOC);
                    } catch (\PDOException $e) {
                        // Most likely: unknown column 'user_id' (schema not migrated yet).
                        $admin = null;
                    }

                    if (!$admin) {
                        $adminLookupSql = "SELECT admin_id, username, email, full_name, role, status FROM admins WHERE email = :email LIMIT 1";
                        $adminLookupStmt = $this->pdo->prepare($adminLookupSql);
                        $adminLookupStmt->execute([':email' => $user['email']]);
                        $admin = $adminLookupStmt->fetch(\PDO::FETCH_ASSOC);
                    }

                    if ($admin) {
                        $adminSession = [
                            'admin_id' => $admin['admin_id'],
                            'username' => $admin['username'],
                            'email' => $admin['email'] ?? '',
                            'full_name' => $admin['full_name'] ?? '',
                            'role' => $admin['role'] ?? 'moderator',
                            'status' => $admin['status'] ?? 'active'
                        ];
                    }
                } catch (\PDOException $e) {
                    // Do not block login if admin lookup fails
                    error_log('Moderator admin lookup failed: ' . $e->getMessage());
                }
            }

            $loginData = [
                'token' => $jwt,
                'userID' => $user['id'],
                'email' => $user['email'],
                'role' => $user['role'] ?? 'user',
                'full_name' => $user['full_name'],
                'phone' => $user['phone'],
                'street' => $user['street'],
                'barangay' => $user['barangay'],
                'city' => $user['city'],
                // 'province' => $user['province'], // Removed - province no longer exists
                'profile_image' => $user['profile_image'],
                'is_verified' => $user['is_verified'],
                'account_status' => $user['account_status'],
                'violation_count' => $user['violation_count']
            ];

            if ($adminSession) {
                $loginData['admin_session'] = $adminSession;
            }

            return $this->sendPayload($loginData, "success", "Login successful", 200);
        } else {
            return $this->sendPayload(null, "error", "Invalid credentials", 401);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}

// Admin Login
public function adminLogin($data) {
    $username = $data->username ?? null;
    $password = $data->password ?? null;

    if (!$username || !$password) {
        return $this->sendPayload(null, "error", "Username and password required", 400);
    }

    // Use the correct column names based on the actual table structure
    $sql = "SELECT * FROM admins WHERE username = :username";
    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['username' => $username]);
        $admin = $stmt->fetch();

        if ($admin && password_verify($password, $admin['password'])) {
            $payload = [
                'iss' => "http://example.org", 
                'aud' => "http://example.com", 
                'iat' => time(), 
                'exp' => time() + 3600, 
                'admin_id' => $admin['admin_id'], // Use admin_id instead of id
                'role' => $admin['role'] ?? 'admin',
                'username' => $admin['username']
            ];
            $jwt = JWT::encode($payload, $this->key, 'HS256');

            // Build user data with correct column names
            $userData = [
                'id' => $admin['admin_id'], // Map admin_id to id for frontend compatibility
                'username' => $admin['username'],
                'email' => $admin['email'] ?? '',
                'role' => $admin['role'] ?? 'admin',
                'full_name' => $admin['full_name'] ?? ''
            ];

            // Add optional fields if they exist
            if (isset($admin['status'])) {
                $userData['status'] = $admin['status'];
            }
            if (isset($admin['created_at'])) {
                $userData['created_at'] = $admin['created_at'];
            }

            return $this->sendPayload([
                'token' => $jwt,
                'user' => $userData
            ], "success", "Admin login successful", 200);
        } else {
            return $this->sendPayload(null, "error", "Invalid admin credentials", 401);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}


//profile update - RESTRICTED TO OLONGAPO CITY ONLY
public function uploadProfile($data) {
    error_log("Received profile data: " . print_r($data, true)); 

    $full_name = $data->full_name ?? '';
    $phone     = $data->phone ?? '';
    $street    = $data->street ?? '';
    $barangay  = $data->barangay ?? '';
    $user_id   = $data->user_id ?? '';

    // Automatically set city to Olongapo City
    $city = 'Olongapo City';

    // Define valid barangays for Olongapo City
    $validBarangays = [
        'Asinan', 'Banicain', 'Barretto', 'East Bajac-Bajac', 'Gordon Heights',
        'Kalaklan', 'Mabayuan', 'New Cabalan', 'Old Cabalan', 'Pag-asa',
        'Santa Rita', 'West Bajac-Bajac', 'East Tapinac', 'West Tapinac',
        'New Kalalake', 'Kababae', 'Ilalim'
    ];

    // Validate required fields
    if (empty($full_name) || empty($user_id)) {
        return $this->sendPayload(null, "error", "Full name and user ID are required", 400);
    }

    // Validate barangay if provided
    if (!empty($barangay) && !in_array($barangay, $validBarangays)) {
        return $this->sendPayload(null, "error", "Invalid barangay. Please select a valid barangay from Olongapo City.", 400);
    }

    $imagePath = null;
    
    // Handle base64 image decoding if provided
    if (isset($data->image) && !empty($data->image)) {
        if (preg_match('/^data:image\/(\w+);base64,/', $data->image, $matches)) {
            $ext = strtolower($matches[1]);
            $imageData = base64_decode(str_replace($matches[0], '', $data->image));
        } else {
            $ext = 'png';
            $imageData = base64_decode($data->image);
        }

        if ($imageData === false) {
            return $this->sendPayload(null, "error", "Invalid image data", 400);
        }

        // Create uploads directory if it doesn't exist
        $uploadDir = __DIR__ . '/../../uploads/';
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true)) {
                error_log("Failed to create uploads directory: " . $uploadDir);
                return $this->sendPayload(null, "error", "Failed to create upload directory", 500);
            }
        }

        // Save image to uploads folder
        $imageName = uniqid('profile_') . '.' . $ext;
        $imagePath = 'uploads/' . $imageName;
        $fullImagePath = __DIR__ . '/../../' . $imagePath;

        if (!file_put_contents($fullImagePath, $imageData)) {
            error_log("Failed to save image to: " . $fullImagePath);
            return $this->sendPayload(null, "error", "Failed to save image", 500);
        }
        
        error_log("Image saved successfully to: " . $fullImagePath);
    }

    // Update user profile in users table (province removed)
    $sql = "UPDATE users SET full_name = :full_name, phone = :phone, street = :street, barangay = :barangay, city = :city";
    $params = [
        'full_name' => $full_name,
        'phone'     => $phone,
        'street'    => $street,
        'barangay'  => $barangay,
        'city'      => $city,
        'user_id'   => $user_id
    ];
    
    if ($imagePath) {
        $sql .= ", profile_image = :profile_image";
        $params['profile_image'] = $imagePath;
    }
    
    $sql .= " WHERE id = :user_id";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        // Return updated data back to Angular
        return $this->sendPayload([
            "full_name" => $full_name,
            "phone"     => $phone,
            "street"    => $street,
            "barangay"  => $barangay,
            "city"      => $city,
            "profile_image" => $imagePath
        ], "success", "Profile updated successfully", 200);

    } catch (\PDOException $e) {
        error_log("Database Error: " . $e->getMessage()); 
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}






// Edit/Update profile - RESTRICTED TO OLONGAPO CITY ONLY
public function editProfile($data) {
    $full_name = $data->full_name ?? '';
    $email = $data->email ?? '';
    $phone     = $data->phone ?? '';
    $street    = $data->street ?? '';
    $barangay  = $data->barangay ?? '';
    $user_id   = $data->user_id ?? '';
    $email_changed = $data->email_changed ?? false;
    $image     = $data->image ?? null;
    $imagePath = null;

    // Automatically set city to Olongapo City
    $city = 'Olongapo City';

    // Define valid barangays for Olongapo City
    $validBarangays = [
        'Asinan', 'Banicain', 'Barretto', 'East Bajac-Bajac', 'Gordon Heights',
        'Kalaklan', 'Mabayuan', 'New Cabalan', 'Old Cabalan', 'Pag-asa',
        'Santa Rita', 'West Bajac-Bajac', 'East Tapinac', 'West Tapinac',
        'New Kalalake', 'Kababae', 'Ilalim'
    ];

    // Validate required fields
    if (empty($full_name) || empty($user_id) || empty($email)) {
        return $this->sendPayload(null, "error", "Full name, email and user ID are required", 400);
    }

    // Validate barangay if provided
    if (!empty($barangay) && !in_array($barangay, $validBarangays)) {
        return $this->sendPayload(null, "error", "Invalid barangay. Please select a valid barangay from Olongapo City.", 400);
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return $this->sendPayload(null, "error", "Invalid email format", 400);
    }

    // If email is being changed, check if new email already exists
    if ($email_changed) {
        $checkEmailSql = "SELECT id FROM users WHERE email = :email AND id != :user_id";
        try {
            $checkStmt = $this->pdo->prepare($checkEmailSql);
            $checkStmt->execute([':email' => $email, ':user_id' => $user_id]);
            if ($checkStmt->fetch()) {
                return $this->sendPayload(null, "error", "Email already registered by another user", 409);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    // If image is provided and is base64, update the image file
    if ($image && preg_match('/^data:image\/(\w+);base64,/', $image, $matches)) {
        $ext = strtolower($matches[1]);
        $imageData = base64_decode(str_replace($matches[0], '', $image));
        if ($imageData === false) {
            return $this->sendPayload(null, "error", "Invalid image data", 400);
        }
        
        // Create uploads directory if it doesn't exist
        $uploadDir = __DIR__ . '/../../uploads/';
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true)) {
                error_log("Failed to create uploads directory: " . $uploadDir);
                return $this->sendPayload(null, "error", "Failed to create upload directory", 500);
            }
        }
        
        // $imageName = uniqid('profile_') . '.' . $ext;
        $imageName = uniqid('profile_image') . '.' . $ext;
        $imagePath = 'uploads/' . $imageName;
        $fullImagePath = __DIR__ . '/../../' . $imagePath;
        
        if (!file_put_contents($fullImagePath, $imageData)) {
            error_log("Failed to save image to: " . $fullImagePath);
            return $this->sendPayload(null, "error", "Failed to save image", 500);
        }
        
        error_log("Image saved successfully to: " . $fullImagePath);
    }

    // Build SQL and params (province removed)
    $sql = "UPDATE users SET full_name = :full_name, email = :email, phone = :phone, street = :street, barangay = :barangay, city = :city";
    $params = [
        'full_name' => $full_name,
        'email'     => $email,
        'phone'     => $phone,
        'street'    => $street,
        'barangay'  => $barangay,
        'city'      => $city,
        'user_id'   => $user_id
    ];

    // If email is changed, reset verification status and generate new token
    if ($email_changed) {
        $verificationToken = bin2hex(random_bytes(32));
        $tokenExpiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        
        $sql .= ", is_verified = 0, verification_token = :verification_token, token_expires_at = :token_expires_at";
        $params['verification_token'] = $verificationToken;
        $params['token_expires_at'] = $tokenExpiresAt;
    }
    
    if ($imagePath) {
        $sql .= ", profile_image = :profile_image";
        $params['profile_image'] = $imagePath;
    }
    
    $sql .= " WHERE id = :user_id";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        // If email was changed, send verification email
        if ($email_changed) {
            // Include sendMail.php for email functionality
            require_once __DIR__ . '/../../sendMail.php';
            
            $emailResult = sendEmailChangeVerificationEmail($email, $full_name, $verificationToken, 'https://cyclemart.shop');
            
            if ($emailResult['status'] !== 'success') {
                // Email sending failed, but profile was updated - log this
                error_log("Failed to send verification email to {$email}: " . $emailResult['message']);
            }
        }

        // Get the current user data after update to return the latest profile image
        $getUserSql = "SELECT profile_image FROM users WHERE id = :user_id";
        $getUserStmt = $this->pdo->prepare($getUserSql);
        $getUserStmt->execute(['user_id' => $user_id]);
        $currentUser = $getUserStmt->fetch(\PDO::FETCH_ASSOC);

        return $this->sendPayload([
            "full_name" => $full_name,
            "email"     => $email,
            "phone"     => $phone,
            "street"    => $street,
            "barangay"  => $barangay,
            "city"      => $city,
            "profile_image" => $currentUser['profile_image'], // Return current profile image from DB
            "email_changed" => $email_changed,
            "verification_sent" => $email_changed
        ], "success", $email_changed ? "Profile updated successfully. Verification email sent to new email address." : "Profile updated successfully", 200);

    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}











// public function addProduct($data) {
//     $product_name = $data->product_name ?? '';
//     $price        = $data->price ?? 0;
//     $description  = $data->description ?? '';
//     $location     = $data->location ?? '';
//     $for_type     = $data->for_type ?? 'sale';
//     $uploader_id  = $data->uploader_id ?? null;
//     $images       = $data->images ?? [];

//     if (!$product_name || !$price || !$description || !$location || !$uploader_id) {
//         return $this->sendPayload(null, "error", "Missing required fields", 400);
//     }

//     // Save base64 images to uploads/
//     $savedPaths = [];
//     foreach ($images as $img) {
//         if (preg_match('/^data:image\/(\w+);base64,/', $img, $matches)) {
//             $ext = strtolower($matches[1]);
//             $imageData = base64_decode(str_replace($matches[0], '', $img));
//             $imageName = uniqid('prod_') . '.' . $ext;
//             $imagePath = 'uploads/' . $imageName;
//             if (file_put_contents($imagePath, $imageData)) {
//                 $savedPaths[] = $imagePath;
//             }
//         }
//     }

//     $jsonImages = json_encode($savedPaths);

//     $sql = "INSERT INTO products (product_name, product_images, price, description, location, for_type, uploader_id) 
//             VALUES (:product_name, :product_images, :price, :description, :location, :for_type, :uploader_id)";

//     try {
//         $stmt = $this->pdo->prepare($sql);
//         $stmt->execute([
//             'product_name'    => $product_name,
//             'product_images'  => $jsonImages,
//             'price'           => $price,
//             'description'     => $description,
//             'location'        => $location,
//             'for_type'        => $for_type,
//             'uploader_id'     => $uploader_id
//         ]);

//         $lastId = $this->pdo->lastInsertId();

//         return $this->sendPayload([
//             "product_id" => $lastId,
//             "product_name" => $product_name,
//             "price" => $price,
//             "description" => $description,
//             "location" => $location,
//             "for_type" => $for_type,
//             "images" => $savedPaths
//         ], "success", "Product added successfully", 201);

//     } catch (\PDOException $e) {
//         return $this->sendPayload(null, "error", $e->getMessage(), 400);
//     }
// }


private function ensureListingAutoApprovalConfigTable() {
    $this->pdo->exec("CREATE TABLE IF NOT EXISTS listing_auto_approval_config (
        config_id INT PRIMARY KEY DEFAULT 1,
        is_enabled TINYINT(1) NOT NULL DEFAULT 0,
        updated_by INT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_single_config CHECK (config_id = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $this->pdo->exec("INSERT IGNORE INTO listing_auto_approval_config (config_id, is_enabled) VALUES (1, 0)");
}

private function isListingAutoApprovalEnabled() {
    $this->ensureListingAutoApprovalConfigTable();

    $stmt = $this->pdo->prepare("SELECT is_enabled FROM listing_auto_approval_config WHERE config_id = 1 LIMIT 1");
    $stmt->execute();
    $config = $stmt->fetch(\PDO::FETCH_ASSOC);

    return $config && (int)$config['is_enabled'] === 1;
}

private function evaluateListingForAutomation($listing) {
    $name = trim((string)($listing['product_name'] ?? ''));
    $description = trim((string)($listing['description'] ?? ''));
    $location = trim((string)($listing['location'] ?? ''));
    $price = (float)($listing['price'] ?? 0);
    $quantity = (int)($listing['quantity'] ?? 0);
    $images = $listing['images'] ?? [];
    $forType = trim((string)($listing['for_type'] ?? ''));
    $condition = trim((string)($listing['condition'] ?? ''));
    $category = trim((string)($listing['category'] ?? ''));
    $brandName = strtolower(trim((string)($listing['brand_name'] ?? '')));
    $customBrand = trim((string)($listing['custom_brand'] ?? ''));
    $bicycleBrandId = $listing['bicycle_brand_id'] ?? null;
    $bicyclePartId = $listing['bicycle_part_id'] ?? null;
    $specifications = $listing['specifications'] ?? [];

    $combinedText = strtolower($name . ' ' . $description);
    $descriptionWordCount = preg_match_all('/[a-z0-9]+/i', $description);
    $specCount = is_array($specifications) ? count($specifications) : 0;

    $bikeKeywordRegex = '/\b(?:bike|bicycle|frame|frameset|wheel|wheelset|groupset|drivetrain|fork|shock|brake|cassette|chain|derailleur|shifter|road|roadbike|mtb|gravel|dropbar|handlebar|stem|saddle|seatpost|tires?|trek|giant|specialized|shimano|sram|campagnolo)\b/i';
    $technicalDetailRegex = '/\b(?:\d{2,4}\s?(?:mm|cm|inch|in)|\d{1,2}\s?speed|\d{1,2}x\d{1,2}|xx1|x01|deore|slx|xt|xtr|tiagra|105|ultegra|dura-ace|nx|gx|axs)\b/i';

    $autoRejectPatterns = [
        '/\\b(?:fake|counterfeit|replica|class a|clone)\\b/i' => 'Potential counterfeit or replica terms detected.',
        '/\\b(?:stolen|smuggled|illegal|prohibited|drugs?|weapon|gun)\\b/i' => 'Prohibited or illegal terms detected.',
        '/(?:https?:\\/\\/|www\\.|t\\.me\\/|telegram|whatsapp|viber|@gmail\\.com|@yahoo\\.com|09\\d{9})/i' => 'Off-platform contact details detected.',
        '/\\b(?:nude|porn|sex|adult)\\b/i' => 'Inappropriate terms detected.'
    ];

    foreach ($autoRejectPatterns as $regex => $reason) {
        if (preg_match($regex, $combinedText)) {
            return [
                'action' => 'reject',
                'reason' => $reason
            ];
        }
    }

    $criteriaPassed = true;
    $criteriaFailures = [];

    if ($name === '' || strlen($name) < 4) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Product name is too short';
    }

    if (strlen($name) > 120) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Product name exceeds 120 characters';
    }

    if (!preg_match('/[a-z]/i', $name)) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Product name must contain readable letters';
    }

    if ($description === '' || strlen($description) < 20) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Description must be at least 20 characters';
    }

    if (strlen($description) > 2000) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Description must be 2000 characters or less';
    }

    if ($descriptionWordCount < 3) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Description must include at least 3 words';
    }

    if (preg_match('/\b([a-z]{2,})\b(?:\s+\1){1,}/i', $description)) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Description appears repetitive or spam-like';
    }

    if (!preg_match($bikeKeywordRegex, $combinedText)) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Description must include at least one bike-related keyword';
    }

    if ($location === '') {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Location is required';
    }

    if (strlen($location) > 120) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Location must be 120 characters or less';
    }

    if ($price <= 0) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Price must be greater than 0';
    }

    if ($price > 10000000) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Price exceeds allowed limit';
    }

    if ($quantity < 1) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Quantity must be at least 1';
    }

    if ($quantity > 999) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Quantity must be 999 or less';
    }

    if (!is_array($images) || count($images) < 1) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'At least one product image is required';
    }

    if (is_array($images) && count($images) > 10) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Maximum 10 product images allowed';
    }

    if (!in_array($forType, ['sale', 'trade', 'both'], true)) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Listing type must be sale, trade, or both';
    }

    if (!in_array($condition, ['brand new', 'second hand'], true)) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Condition must be brand new or second hand';
    }

    if ($category === '') {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Category is required';
    }

    if ($brandName === 'others' && $customBrand === '') {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Custom brand detail is required for Others';
    }

    if ($bicycleBrandId === null || $bicyclePartId === null) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Bicycle brand and part must be selected';
    }

    if ($specCount < 1 && !preg_match($technicalDetailRegex, $description)) {
        $criteriaPassed = false;
        $criteriaFailures[] = 'Provide at least one specification or technical detail';
    }

    if ($criteriaPassed) {
        return [
            'action' => 'approve',
            'reason' => 'Listing matched all auto-approval criteria.'
        ];
    }

    return [
        'action' => 'pending',
        'reason' => implode('; ', $criteriaFailures)
    ];
}

private function applyListingAutomationDecision($productId, $uploaderId, $productName, $decision) {
    $action = $decision['action'] ?? 'pending';
    $reason = $decision['reason'] ?? '';

    if ($action === 'approve') {
        $stmt = $this->pdo->prepare("UPDATE products
            SET approval_status = 'approved',
                status = 'active',
                approval_date = NOW(),
                approved_by = NULL
            WHERE product_id = :product_id");
        $stmt->execute([':product_id' => $productId]);

        $this->createUserNotification(
            $uploaderId,
            'listing auto approved',
            'Listing Auto Approved',
            "Your listing '{$productName}' was automatically approved after passing listing criteria.",
            $productId
        );

        return [
            'approval_status' => 'approved',
            'message' => 'Product auto-approved successfully.'
        ];
    }

    if ($action === 'reject') {
        $stmt = $this->pdo->prepare("UPDATE products
            SET approval_status = 'rejected',
                status = 'inactive',
                approval_date = NOW(),
                approved_by = NULL,
                rejection_reason = :rejection_reason
            WHERE product_id = :product_id");
        $stmt->execute([
            ':product_id' => $productId,
            ':rejection_reason' => $reason
        ]);

        $this->createUserNotification(
            $uploaderId,
            'listing_auto_rejected',
            'Listing Auto-Rejected',
            "Your listing '{$productName}' was automatically rejected. Reason: {$reason}",
            $productId
        );

        return [
            'approval_status' => 'rejected',
            'message' => 'Product auto-rejected by regex criteria.'
        ];
    }

    return [
        'approval_status' => 'pending',
        'message' => 'Product submitted and kept for manual review.'
    ];
}

public function updateListingAutoApprovalConfig($data) {
    $enabled = isset($data->enabled) ? (int)((bool)$data->enabled) : null;
    $admin_id = $data->admin_id ?? null;
    $admin_role = $data->admin_role ?? null;

    if ($enabled === null || !$admin_id || !$admin_role) {
        return $this->sendPayload(null, 'error', 'Missing required fields', 400);
    }

    if (!in_array($admin_role, ['super admin', 'moderator', 'admin'])) {
        return $this->sendPayload(null, 'error', 'Unauthorized access', 403);
    }

    try {
        $this->ensureListingAutoApprovalConfigTable();

        $stmt = $this->pdo->prepare("UPDATE listing_auto_approval_config
            SET is_enabled = :enabled,
                updated_by = :updated_by,
                updated_at = NOW()
            WHERE config_id = 1");
        $stmt->execute([
            ':enabled' => $enabled,
            ':updated_by' => $admin_id
        ]);

        return $this->sendPayload([
            'enabled' => ((int)$enabled === 1),
            'updated_by' => (int)$admin_id
        ], 'success', 'Listing auto-approval configuration updated', 200);
    } catch (\PDOException $e) {
        return $this->sendPayload(null, 'error', $e->getMessage(), 500);
    }
}

public function addProduct($data) {
    // 🔍 DEBUG: Log incoming data
    error_log("=== ADD PRODUCT REQUEST ===");
    error_log("Product Name: " . ($data->product_name ?? 'NOT SET'));
    error_log("Has product_videos property: " . (isset($data->product_videos) ? 'YES' : 'NO'));
    if (isset($data->product_videos)) {
        error_log("product_videos type: " . gettype($data->product_videos));
        error_log("product_videos value (first 200 chars): " . substr($data->product_videos, 0, 200));
    }
    error_log("========================");
    
    $product_name = $data->product_name ?? '';
    $brand_name   = $data->brand_name ?? 'no brand';
    $custom_brand = $data->custom_brand ?? null;
    $price        = $data->price ?? 0;
    $description  = $data->description ?? '';
    $location     = $data->location ?? '';
    $for_type     = $data->for_type ?? 'sale';
    $condition    = $data->condition ?? 'second hand';
    $category     = $data->category ?? 'others';
    $quantity     = $data->quantity ?? 1;
    $uploader_id  = $data->uploader_id ?? null;
    $images       = $data->images ?? [];
    $specifications = $data->specifications ?? [];
    
    // 🚲 Bicycle Taxonomy Fields
    $bicycle_brand_id = isset($data->bicycle_brand_id) && $data->bicycle_brand_id !== null ? (int)$data->bicycle_brand_id : null;
    $bicycle_part_id = isset($data->bicycle_part_id) && $data->bicycle_part_id !== null ? (int)$data->bicycle_part_id : null;
    
    error_log("🚲 Bicycle Brand ID: " . ($bicycle_brand_id ?? 'NULL'));
    error_log("🚲 Bicycle Part ID: " . ($bicycle_part_id ?? 'NULL'));

    if (!$product_name || !$price || !$description || !$location || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing required fields", 400);
    }

    // ⚠️ Check if user is restricted from creating listings
    $restrictionCheck = $this->checkUserRestriction($uploader_id);
    
    error_log("addProduct: Checking restriction for user_id=$uploader_id. Restricted: " . ($restrictionCheck['is_restricted'] ? 'YES' : 'NO'));
    
    if ($restrictionCheck['is_restricted']) {
        error_log("User is restricted! Blocking listing creation.");
        
        $expiryMessage = '';
        if ($restrictionCheck['expires_at']) {
            $expiryDate = date('F j, Y \a\t g:i A', strtotime($restrictionCheck['expires_at']));
            $expiryMessage = " Your restriction will be lifted on {$expiryDate}.";
        } else {
            $expiryMessage = " Your account has been permanently banned from creating listings.";
        }
        
        return $this->sendPayload(null, "error", 
            "You are currently restricted from creating new listings due to previous violations ({$restrictionCheck['violation_count']} violations). Reason: {$restrictionCheck['reason']}.{$expiryMessage}", 
            403);
    }

    if ($quantity < 1) {
        return $this->sendPayload(null, "error", "Quantity must be at least 1", 400);
    }

    // Validate brand fields
    if ($brand_name === 'others' && (empty($custom_brand) || trim($custom_brand) === '')) {
        return $this->sendPayload(null, "error", "Custom brand is required when 'others' is selected", 400);
    }

    // Clear custom_brand if not "others"
    if ($brand_name !== 'others') {
        $custom_brand = null;
    }

    // Handle product_images from frontend
    $product_images = $data->product_images ?? '[]';
    $imageData = json_decode($product_images, true);
    
    // Save base64 images to uploads/
    $savedPaths = [];
    if (is_array($imageData)) {
        foreach ($imageData as $img) {
            if (preg_match('/^data:image\/(\w+);base64,/', $img, $matches)) {
                $ext = strtolower($matches[1]);
                $decodedImage = base64_decode(str_replace($matches[0], '', $img));
                $imageName = uniqid('prod_') . '.' . $ext;
                $imagePath = 'uploads/' . $imageName;

                if (file_put_contents($imagePath, $decodedImage)) {
                    error_log("Saved file: " . realpath($imagePath));
                    $savedPaths[] = $imagePath;
                }
            }
        }
    }

    // Also handle legacy images array for backward compatibility
    if (!empty($images)) {
        foreach ($images as $img) {
            if (preg_match('/^data:image\/(\w+);base64,/', $img, $matches)) {
                $ext = strtolower($matches[1]);
                $imageData = base64_decode(str_replace($matches[0], '', $img));
                $imageName = uniqid('prod_') . '.' . $ext;
                $imagePath = 'uploads/' . $imageName;

                if (file_put_contents($imagePath, $imageData)) {
                    $savedPaths[] = $imagePath;
                }
            }
        }
    }

    // Handle product_videos from frontend
    $product_videos = $data->product_videos ?? '[]';
    $videoData = json_decode($product_videos, true);
    
    // 🔍 DEBUG: Log video processing
    error_log("=== VIDEO UPLOAD DEBUG ===");
    error_log("Raw product_videos from frontend: " . substr($product_videos, 0, 200));
    error_log("Video data type: " . gettype($videoData));
    error_log("Video data is_array: " . (is_array($videoData) ? 'YES' : 'NO'));
    error_log("Video data count: " . (is_array($videoData) ? count($videoData) : 0));
    
    // Create videos directory if it doesn't exist
    $videosDir = 'uploads/videos';
    if (!is_dir($videosDir)) {
        mkdir($videosDir, 0755, true);
        error_log("Created videos directory: " . $videosDir);
    }
    
    // Save base64 videos to uploads/videos/
    $savedVideoPaths = [];
    if (is_array($videoData)) {
        error_log("Processing " . count($videoData) . " videos...");
        
        foreach ($videoData as $index => $vid) {
            error_log("Video #" . ($index + 1) . " - First 50 chars: " . substr($vid, 0, 50));
            
            if (preg_match('/^data:video\/(\w+);base64,/', $vid, $matches)) {
                $ext = strtolower($matches[1]);
                error_log("Video #" . ($index + 1) . " - Detected format: " . $ext);
                
                // Validate video format (including MKV/Matroska)
                $allowedVideoFormats = ['mp4', 'mov', 'avi', 'webm', 'ogg', 'mkv', 'x-matroska', 'matroska'];
                if (!in_array($ext, $allowedVideoFormats)) {
                    error_log("Video #" . ($index + 1) . " - SKIPPED: Invalid format " . $ext);
                    continue; // Skip invalid formats
                }
                
                $decodedVideo = base64_decode(str_replace($matches[0], '', $vid));
                $videoSize = strlen($decodedVideo);
                error_log("Video #" . ($index + 1) . " - Decoded size: " . number_format($videoSize) . " bytes (" . number_format($videoSize / 1024 / 1024, 2) . " MB)");
                
                // Validate file size (50MB limit)
                if ($videoSize > 50 * 1024 * 1024) {
                    error_log("Video #" . ($index + 1) . " - SKIPPED: File too large (" . number_format($videoSize / 1024 / 1024, 2) . " MB)");
                    continue; // Skip files larger than 50MB
                }
                
                $videoName = uniqid('video_') . '.' . $ext;
                $videoPath = $videosDir . '/' . $videoName;

                if (file_put_contents($videoPath, $decodedVideo)) {
                    error_log("Video #" . ($index + 1) . " - ✅ SAVED: " . realpath($videoPath));
                    $savedVideoPaths[] = $videoPath;
                } else {
                    error_log("Video #" . ($index + 1) . " - ❌ FAILED to save to: " . $videoPath);
                }
            } else {
                error_log("Video #" . ($index + 1) . " - SKIPPED: Does not match base64 video pattern");
            }
        }
    } else {
        error_log("⚠️ videoData is not an array!");
    }

    error_log("Total videos saved: " . count($savedVideoPaths));
    error_log("Saved video paths: " . json_encode($savedVideoPaths));
    
    $jsonImages = json_encode($savedPaths);
    $jsonVideos = json_encode($savedVideoPaths);
    
    error_log("Final jsonVideos to be inserted: " . $jsonVideos);
    error_log("=== END VIDEO DEBUG ===");
    
    // Process specifications - convert to JSON format
    $jsonSpecifications = null;
    if (!empty($specifications) && is_array($specifications)) {
        $processedSpecs = [];
        foreach ($specifications as $spec) {
            // Handle both object notation (from Angular) and array notation
            $specName = '';
            $specValue = '';
            
            if (is_object($spec)) {
                $specName = $spec->spec_name ?? $spec->name ?? '';
                $specValue = $spec->spec_value ?? $spec->value ?? '';
            } elseif (is_array($spec)) {
                $specName = $spec['spec_name'] ?? $spec['name'] ?? '';
                $specValue = $spec['spec_value'] ?? $spec['value'] ?? '';
            }
            
            if (!empty(trim($specName)) && !empty(trim($specValue))) {
                $processedSpecs[] = [
                    'name' => trim($specName),
                    'value' => trim($specValue)
                ];
            }
        }
        $jsonSpecifications = json_encode($processedSpecs);
    }

        $sql = "INSERT INTO products (product_name, brand_name, custom_brand, bicycle_brand_id, bicycle_part_id, product_images, product_videos, price, description, location, for_type, `condition`, category, quantity, status, sale_status, approval_status, uploader_id, specifications) 
            VALUES (:product_name, :brand_name, :custom_brand, :bicycle_brand_id, :bicycle_part_id, :product_images, :product_videos, :price, :description, :location, :for_type, :condition, :category, :quantity, 'active', 'available', 'pending', :uploader_id, :specifications)";

    try {
        $stmt = $this->pdo->prepare($sql);
        
        // 🔍 DEBUG: Log the values being inserted
        error_log("=== PRODUCT INSERT DEBUG ===");
        error_log("Product Name: " . $product_name);
        error_log("Brand Name: " . $brand_name);
        error_log("Bicycle Brand ID: " . ($bicycle_brand_id ?? 'NULL'));
        error_log("Bicycle Part ID: " . ($bicycle_part_id ?? 'NULL'));
        error_log("Images JSON: " . $jsonImages);
        error_log("Videos JSON: " . $jsonVideos);
        error_log("Videos JSON length: " . strlen($jsonVideos));
        error_log("Price: " . $price);
        error_log("Uploader ID: " . $uploader_id);
        error_log("=== ATTEMPTING INSERT ===");
        
        $executeResult = $stmt->execute([
            'product_name'    => $product_name,
            'brand_name'      => $brand_name,
            'custom_brand'    => $custom_brand,
            'bicycle_brand_id'=> $bicycle_brand_id,
            'bicycle_part_id' => $bicycle_part_id,
            'product_images'  => $jsonImages,
            'product_videos'  => $jsonVideos,
            'price'           => $price,
            'description'     => $description,
            'location'        => $location,
            'for_type'        => $for_type,
            'condition'       => $condition,
            'category'        => $category,
            'quantity'        => $quantity,
            'uploader_id'     => $uploader_id,
            'specifications'  => $jsonSpecifications
        ]);

        error_log("✅ INSERT SUCCESSFUL! Execute result: " . ($executeResult ? 'true' : 'false'));
        
        $lastId = $this->pdo->lastInsertId();
        error_log("✅ Product ID created: " . $lastId);
        error_log("=== END INSERT DEBUG ===");
        
        // Create notification for new listing
        $userName = $this->getUserNameById($uploader_id);
        $notificationTitle = "New listing uploaded";
        $notificationMessage = sprintf(
            "%s uploaded a new %s: '%s' for ₱%s in %s",
            $userName,
            $this->getForTypeText($for_type),
            $product_name,
            number_format($price),
            $location
        );
        
        $this->createNotification(
            'new_listing',
            $notificationTitle,
            $notificationMessage,
            $lastId, // reference_id points to product_id
            $uploader_id // created_by
        );

        $finalApprovalStatus = 'pending';
        $finalMessage = "Product submitted successfully! Your listing is pending admin approval.";

        if ($this->isListingAutoApprovalEnabled()) {
            $decision = $this->evaluateListingForAutomation([
                'product_name' => $product_name,
                'description' => $description,
                'location' => $location,
                'price' => $price,
                'quantity' => $quantity,
                'images' => $savedPaths,
                'for_type' => $for_type,
                'condition' => $condition,
                'category' => $category,
                'brand_name' => $brand_name,
                'custom_brand' => $custom_brand,
                'bicycle_brand_id' => $bicycle_brand_id,
                'bicycle_part_id' => $bicycle_part_id,
                'specifications' => $specifications
            ]);

            $decisionResult = $this->applyListingAutomationDecision(
                $lastId,
                $uploader_id,
                $product_name,
                $decision
            );

            $finalApprovalStatus = $decisionResult['approval_status'] ?? 'pending';
            $finalMessage = $decisionResult['message'] ?? $finalMessage;
        }

        return $this->sendPayload([
            "product_id"   => $lastId,
            "product_name" => $product_name,
            "price"        => $price,
            "description"  => $description,
            "location"     => $location,
            "for_type"     => $for_type,
            "condition"    => $condition,
            "category"     => $category,
            "images"       => $savedPaths,
            "videos"       => $savedVideoPaths,
            "approval_status" => $finalApprovalStatus
        ], "success", $finalMessage, 201);

    } catch (\PDOException $e) {
        error_log("❌❌❌ PRODUCT INSERT FAILED! ❌❌❌");
        error_log("Error Message: " . $e->getMessage());
        error_log("Error Code: " . $e->getCode());
        error_log("SQL State: " . ($e->errorInfo[0] ?? 'N/A'));
        error_log("Driver Error Code: " . ($e->errorInfo[1] ?? 'N/A'));
        error_log("Driver Error Message: " . ($e->errorInfo[2] ?? 'N/A'));
        error_log("Stack Trace: " . $e->getTraceAsString());
        return $this->sendPayload(null, "error", "Failed to create product: " . $e->getMessage(), 400);
    }
}

public function updateProduct($data) {
    $product_id = $data->product_id ?? null;
    $product_name = $data->product_name ?? '';
    $brand_name   = $data->brand_name ?? 'no brand';
    $custom_brand = $data->custom_brand ?? null;
    $price = $data->price ?? 0;
    $description = $data->description ?? '';
    $location = $data->location ?? '';
    $for_type = $data->for_type ?? 'sale';
    $condition = $data->condition ?? 'second hand';
    $category = $data->category ?? 'others';
    $quantity = $data->quantity ?? 1;
    $uploader_id = $data->uploader_id ?? null;
    $product_images = $data->product_images ?? '[]';
    $product_videos = $data->product_videos ?? '[]';
    $specifications = $data->specifications ?? [];
    $bicycle_brand_id = isset($data->bicycle_brand_id) && $data->bicycle_brand_id !== null ? (int)$data->bicycle_brand_id : null;
    $bicycle_part_id = isset($data->bicycle_part_id) && $data->bicycle_part_id !== null ? (int)$data->bicycle_part_id : null;

    $product_name = trim((string)$product_name);
    $description = trim((string)$description);
    $location = trim((string)$location);
    $brand_name = strtolower(trim((string)$brand_name));
    $custom_brand = $custom_brand !== null ? trim((string)$custom_brand) : null;
    $for_type = strtolower(trim((string)$for_type));
    $condition = strtolower(trim((string)$condition));
    $category = trim((string)$category);
    $price = (float)$price;
    $quantity = (int)$quantity;

    if (!$product_id || !$product_name || !$price || !$description || !$location || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing required fields", 400);
    }

    if (strlen($product_name) < 4 || strlen($product_name) > 120) {
        return $this->sendPayload(null, "error", "Product name must be between 4 and 120 characters", 400);
    }

    if (!preg_match('/[a-z]/i', $product_name)) {
        return $this->sendPayload(null, "error", "Product name must contain readable letters", 400);
    }

    if (!preg_match('/^[A-Za-z0-9\s.,\'"()&\-\/#:+]+$/', $product_name)) {
        return $this->sendPayload(null, "error", "Product name contains invalid characters", 400);
    }

    if ($description === '' || strlen($description) < 20 || strlen($description) > 2000) {
        return $this->sendPayload(null, "error", "Description must be between 20 and 2000 characters", 400);
    }

    if (strlen($location) > 120) {
        return $this->sendPayload(null, "error", "Location must be 120 characters or less", 400);
    }

    if (!preg_match('/^[A-Za-z0-9\s.,\'"()&\-\/#:+]+$/', $location)) {
        return $this->sendPayload(null, "error", "Location contains invalid characters", 400);
    }

    if ($price <= 0 || $price > 10000000) {
        return $this->sendPayload(null, "error", "Price must be greater than 0 and not exceed 10000000", 400);
    }

    if (!preg_match('/^\d+(\.\d{1,2})?$/', (string)$price)) {
        return $this->sendPayload(null, "error", "Price can only have up to 2 decimal places", 400);
    }

    if ($quantity < 1) {
        return $this->sendPayload(null, "error", "Quantity must be at least 1", 400);
    }

    if ($quantity > 999) {
        return $this->sendPayload(null, "error", "Quantity must be 999 or less", 400);
    }

    if (!in_array($for_type, ['sale', 'trade', 'both'], true)) {
        return $this->sendPayload(null, "error", "Invalid listing type", 400);
    }

    if (!in_array($condition, ['brand new', 'second hand'], true)) {
        return $this->sendPayload(null, "error", "Invalid condition", 400);
    }

    if ($category === '') {
        return $this->sendPayload(null, "error", "Category is required", 400);
    }

    // Load existing product to preserve taxonomy fields when client does not send them.
    $existingStmt = $this->pdo->prepare("SELECT bicycle_brand_id, bicycle_part_id, approval_status FROM products WHERE product_id = :product_id AND uploader_id = :uploader_id LIMIT 1");
    $existingStmt->execute([
        ':product_id' => $product_id,
        ':uploader_id' => $uploader_id
    ]);
    $existingProduct = $existingStmt->fetch(\PDO::FETCH_ASSOC);

    if (!$existingProduct) {
        return $this->sendPayload(null, "error", "Product not found or unauthorized.", 404);
    }

    if ($bicycle_brand_id === null) {
        $bicycle_brand_id = isset($existingProduct['bicycle_brand_id']) ? (int)$existingProduct['bicycle_brand_id'] : null;
    }
    if ($bicycle_part_id === null) {
        $bicycle_part_id = isset($existingProduct['bicycle_part_id']) ? (int)$existingProduct['bicycle_part_id'] : null;
    }

    // Validate brand fields
    if ($brand_name === 'others' && ($custom_brand === null || $custom_brand === '')) {
        return $this->sendPayload(null, "error", "Custom brand is required when 'others' is selected", 400);
    }

    if ($custom_brand !== null && strlen($custom_brand) > 100) {
        return $this->sendPayload(null, "error", "Custom brand must be 100 characters or less", 400);
    }

    // Clear custom_brand if not "others"
    if ($brand_name !== 'others') {
        $custom_brand = null;
    }

    // Handle images if they contain base64 data
    $imageData = json_decode($product_images, true);
    $savedPaths = [];
    
    if (is_array($imageData)) {
        if (count($imageData) > 10) {
            return $this->sendPayload(null, "error", "Maximum 10 images allowed", 400);
        }

        foreach ($imageData as $img) {
            if (is_string($img) && preg_match('/^data:image\/(\w+);base64,/', $img, $matches)) {
                // It's a new base64 image, save it
                $ext = strtolower($matches[1]);
                $decodedImage = base64_decode(str_replace($matches[0], '', $img));
                $imageName = uniqid('prod_') . '.' . $ext;
                $imagePath = 'uploads/' . $imageName;
                
                if (file_put_contents($imagePath, $decodedImage)) {
                    $savedPaths[] = $imagePath;
                }
            } else {
                // It's an existing image path, keep it
                $savedPaths[] = $img;
            }
        }
    }

    // Handle videos if they contain base64 data
    $videoData = json_decode($product_videos, true);
    $savedVideoPaths = [];
    
    // Create videos directory if it doesn't exist
    $videosDir = 'uploads/videos';
    if (!is_dir($videosDir)) {
        mkdir($videosDir, 0755, true);
    }
    
    if (is_array($videoData)) {
        foreach ($videoData as $vid) {
            if (is_string($vid) && preg_match('/^data:video\/(\w+);base64,/', $vid, $matches)) {
                // It's a new base64 video, save it
                $ext = strtolower($matches[1]);
                
                // Validate video format (including MKV/Matroska)
                $allowedVideoFormats = ['mp4', 'mov', 'avi', 'webm', 'ogg', 'mkv', 'x-matroska', 'matroska'];
                if (!in_array($ext, $allowedVideoFormats)) {
                    continue; // Skip invalid formats
                }
                
                $decodedVideo = base64_decode(str_replace($matches[0], '', $vid));
                
                // Validate file size (50MB limit)
                if (strlen($decodedVideo) > 50 * 1024 * 1024) {
                    continue; // Skip files larger than 50MB
                }
                
                $videoName = uniqid('video_') . '.' . $ext;
                $videoPath = $videosDir . '/' . $videoName;
                
                if (file_put_contents($videoPath, $decodedVideo)) {
                    $savedVideoPaths[] = $videoPath;
                }
            } else {
                // It's an existing video path, keep it
                $savedVideoPaths[] = $vid;
            }
        }
    }

    $finalImages = json_encode($savedPaths);
    $finalVideos = json_encode($savedVideoPaths);
    
    // Process specifications - convert to JSON format
    $jsonSpecifications = null;
    $processedSpecs = [];
    if (!empty($specifications) && is_array($specifications)) {
        foreach ($specifications as $spec) {
            // Handle both object notation (from Angular) and array notation
            $specName = '';
            $specValue = '';
            
            if (is_object($spec)) {
                $specName = $spec->spec_name ?? $spec->name ?? '';
                $specValue = $spec->spec_value ?? $spec->value ?? '';
            } elseif (is_array($spec)) {
                $specName = $spec['spec_name'] ?? $spec['name'] ?? '';
                $specValue = $spec['spec_value'] ?? $spec['value'] ?? '';
            }
            
            if (!empty(trim($specName)) && !empty(trim($specValue))) {
                $processedSpecs[] = [
                    'name' => trim($specName),
                    'value' => trim($specValue)
                ];
            }
        }
        $jsonSpecifications = json_encode($processedSpecs);
    }

    $sql = "UPDATE products SET 
                product_name = :product_name,
                brand_name = :brand_name,
                custom_brand = :custom_brand,
                bicycle_brand_id = :bicycle_brand_id,
                bicycle_part_id = :bicycle_part_id,
                product_images = :product_images,
                product_videos = :product_videos,
                price = :price,
                description = :description,
                location = :location,
                for_type = :for_type,
                `condition` = :condition,
                category = :category,
                quantity = :quantity,
                specifications = :specifications
            WHERE product_id = :product_id AND uploader_id = :uploader_id";

    try {
        // 🔍 Debug logging - log the exact values being used
        error_log("🔍 UpdateProduct Debug - Product ID: $product_id (type: " . gettype($product_id) . ")");
        error_log("🔍 UpdateProduct Debug - Uploader ID: $uploader_id (type: " . gettype($uploader_id) . ")");
        error_log("🔍 UpdateProduct Debug - Product Name: $product_name");
        
        $stmt = $this->pdo->prepare($sql);
        $executeParams = [
            ':product_name' => $product_name,
            ':brand_name' => $brand_name,
            ':custom_brand' => $custom_brand,
            ':bicycle_brand_id' => $bicycle_brand_id,
            ':bicycle_part_id' => $bicycle_part_id,
            ':product_images' => $finalImages,
            ':product_videos' => $finalVideos,
            ':price' => $price,
            ':description' => $description,
            ':location' => $location,
            ':for_type' => $for_type,
            ':condition' => $condition,
            ':category' => $category,
            ':quantity' => $quantity,
            ':specifications' => $jsonSpecifications,
            ':product_id' => $product_id,
            ':uploader_id' => $uploader_id
        ];
        
        // 🔍 Log the exact parameters being passed
        error_log("🔍 UpdateProduct Debug - Execute params: " . json_encode($executeParams));
        
        $executed = $stmt->execute($executeParams);
        error_log("🔍 UpdateProduct Debug - Query executed: " . ($executed ? "TRUE" : "FALSE"));
        error_log("🔍 UpdateProduct Debug - Row count: " . $stmt->rowCount());

        if ($stmt->rowCount() > 0) {
            // If auto-approval is enabled, re-evaluate edited pending listings.
            $statusStmt = $this->pdo->prepare("SELECT approval_status FROM products WHERE product_id = :product_id AND uploader_id = :uploader_id LIMIT 1");
            $statusStmt->execute([
                ':product_id' => $product_id,
                ':uploader_id' => $uploader_id
            ]);
            $productStatus = $statusStmt->fetch(\PDO::FETCH_ASSOC);
            $currentApprovalStatus = $productStatus['approval_status'] ?? ($existingProduct['approval_status'] ?? 'pending');

            $finalApprovalStatus = $currentApprovalStatus;
            $message = "Product updated successfully";

            if ($this->isListingAutoApprovalEnabled() && $currentApprovalStatus === 'pending') {
                $decision = $this->evaluateListingForAutomation([
                    'product_name' => $product_name,
                    'description' => $description,
                    'location' => $location,
                    'price' => $price,
                    'quantity' => $quantity,
                    'images' => $savedPaths,
                    'for_type' => $for_type,
                    'condition' => $condition,
                    'category' => $category,
                    'brand_name' => $brand_name,
                    'custom_brand' => $custom_brand,
                    'bicycle_brand_id' => $bicycle_brand_id,
                    'bicycle_part_id' => $bicycle_part_id,
                    'specifications' => $processedSpecs
                ]);

                $decisionResult = $this->applyListingAutomationDecision(
                    $product_id,
                    $uploader_id,
                    $product_name,
                    $decision
                );

                $finalApprovalStatus = $decisionResult['approval_status'] ?? $currentApprovalStatus;

                if ($finalApprovalStatus === 'approved') {
                    $message = 'Product updated and auto-approved successfully';
                } elseif ($finalApprovalStatus === 'rejected') {
                    $message = 'Product updated but auto-rejected by moderation rules';
                } else {
                    $message = 'Product updated and kept pending for manual review';
                }
            }

            return $this->sendPayload([
                "product_id" => $product_id,
                "message" => $message,
                "approval_status" => $finalApprovalStatus
            ], "success", $message, 200);
        } else {
            // 🔍 Enhanced debugging for authorization failures
            $debugSql = "SELECT uploader_id FROM products WHERE product_id = :product_id";
            $debugStmt = $this->pdo->prepare($debugSql);
            $debugStmt->execute([':product_id' => $product_id]);
            $actualOwner = $debugStmt->fetch(\PDO::FETCH_ASSOC);
            
            if ($actualOwner) {
                $errorMsg = "Product not found or unauthorized. Product belongs to user ID {$actualOwner['uploader_id']}, but you attempted to update as user ID {$uploader_id}.";
            } else {
                $errorMsg = "Product not found or unauthorized. Product ID {$product_id} does not exist.";
            }
            
            return $this->sendPayload(null, "error", $errorMsg, 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}

public function submitForApproval($data) {
    $product_id = $data->product_id ?? null;
    $uploader_id = $data->uploader_id ?? null;

    if (!$product_id || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing product ID or uploader ID", 400);
    }

    // You can add an 'approval_status' field to your products table
    // For now, we'll just add a timestamp to indicate submission
    $sql = "UPDATE products SET approval_submitted_at = NOW() 
            WHERE product_id = :product_id AND uploader_id = :uploader_id";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':product_id' => $product_id,
            ':uploader_id' => $uploader_id
        ]);

        if ($stmt->rowCount() > 0) {
            return $this->sendPayload([
                "product_id" => $product_id,
                "message" => "Product submitted for approval"
            ], "success", "Product submitted for approval", 200);
        } else {
            return $this->sendPayload(null, "error", "Product not found or unauthorized", 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}

public function deleteProduct($data) {
    $product_id = $data->product_id ?? null;
    $uploader_id = $data->uploader_id ?? null;

    if (!$product_id || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing product ID or uploader ID", 400);
    }

    $sql = "DELETE FROM products WHERE product_id = :product_id AND uploader_id = :uploader_id";
    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':product_id' => $product_id,
            ':uploader_id' => $uploader_id
        ]);

        if ($stmt->rowCount() > 0) {
            return $this->sendPayload(null, "success", "Product deleted successfully", 200);
        } else {
            return $this->sendPayload(null, "error", "Product not found or unauthorized", 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}

// Update sale status for listings
public function updateSaleStatus($data) {
    $product_id = $data->product_id ?? null;
    $uploader_id = $data->uploader_id ?? null;
    $sale_status = $data->sale_status ?? null;
    $for_type = $data->for_type ?? null;
    $conversation_id = $data->conversation_id ?? null; // Track which conversation made the sale
    $buyer_id = $data->buyer_id ?? null; // Track the buyer directly
    $seller_id = $data->seller_id ?? null;

    if (!$product_id || !$uploader_id || !$sale_status) {
        return $this->sendPayload(null, "error", "Missing required fields", 400);
    }

    // Validate sale_status values
    if (!in_array($sale_status, ['available', 'sold', 'reserved', 'traded'])) {
        return $this->sendPayload(null, "error", "Invalid sale status", 400);
    }

    // Get current product info for logging
    $getCurrentSql = "SELECT sale_status, product_name FROM products WHERE product_id = :product_id";
    $getCurrentStmt = $this->pdo->prepare($getCurrentSql);
    $getCurrentStmt->execute([':product_id' => $product_id]);
    $currentProduct = $getCurrentStmt->fetch(\PDO::FETCH_ASSOC);

    if (!$currentProduct) {
        return $this->sendPayload(null, "error", "Product not found", 404);
    }

    // Get current timestamp for logging
    $updated_at = date('Y-m-d H:i:s');

    // Resolve missing buyer_id from explicit conversation when available.
    if (($sale_status === 'sold' || $sale_status === 'traded') && !$buyer_id && $conversation_id) {
        try {
            $resolveBuyerSql = "SELECT buyer_id FROM conversations WHERE conversation_id = :conversation_id AND product_id = :product_id AND seller_id = :seller_id LIMIT 1";
            $resolveBuyerStmt = $this->pdo->prepare($resolveBuyerSql);
            $resolveBuyerStmt->execute([
                ':conversation_id' => $conversation_id,
                ':product_id' => $product_id,
                ':seller_id' => $uploader_id
            ]);
            $resolvedConversation = $resolveBuyerStmt->fetch(\PDO::FETCH_ASSOC);

            if ($resolvedConversation && !empty($resolvedConversation['buyer_id'])) {
                $buyer_id = (int)$resolvedConversation['buyer_id'];
                error_log("✅ Resolved buyer_id from conversation: $buyer_id for product $product_id");
            }
        } catch (\Throwable $resolveError) {
            error_log("⚠️ Failed to resolve buyer_id from conversation: " . $resolveError->getMessage());
        }
    }

    // Fallback: if seller marks sold/traded outside a specific chat context,
    // infer the buyer from the most recently active conversation for this product.
    if (($sale_status === 'sold' || $sale_status === 'traded') && !$buyer_id && !$conversation_id) {
        try {
            $inferConversationSql = "SELECT conversation_id, buyer_id
                                     FROM conversations
                                     WHERE product_id = :product_id
                                       AND seller_id = :seller_id
                                       AND buyer_id IS NOT NULL
                                     ORDER BY COALESCE(updated_at, created_at) DESC, conversation_id DESC
                                     LIMIT 1";
            $inferConversationStmt = $this->pdo->prepare($inferConversationSql);
            $inferConversationStmt->execute([
                ':product_id' => $product_id,
                ':seller_id' => $uploader_id
            ]);
            $inferredConversation = $inferConversationStmt->fetch(\PDO::FETCH_ASSOC);

            if ($inferredConversation && !empty($inferredConversation['buyer_id'])) {
                $buyer_id = (int)$inferredConversation['buyer_id'];
                $conversation_id = (int)$inferredConversation['conversation_id'];
                error_log("✅ Inferred buyer_id $buyer_id and conversation_id $conversation_id for product $product_id");
            }
        } catch (\Throwable $inferError) {
            error_log("⚠️ Failed to infer buyer/conversation for product $product_id: " . $inferError->getMessage());
        }
    }

    // Build SQL based on whether this is a sale transaction with buyer info
    if (($sale_status === 'sold' || $sale_status === 'traded') && $buyer_id) {
        error_log("✅ Storing buyer info - buyer_id: $buyer_id, conversation_id: " . ($conversation_id ?? 'N/A') . " for product $product_id");
        $sql = "UPDATE products SET 
                    sale_status = :sale_status,
                    buyer_id = :buyer_id,
                    transaction_date = NOW()
                WHERE product_id = :product_id AND uploader_id = :uploader_id";

        if ($conversation_id) {
            $sql = "UPDATE products SET 
                        sale_status = :sale_status,
                        buyer_id = :buyer_id,
                        sale_conversation_id = :conversation_id,
                        transaction_date = NOW()
                    WHERE product_id = :product_id AND uploader_id = :uploader_id";
        }
    } else {
        $sql = "UPDATE products SET 
                    sale_status = :sale_status 
                WHERE product_id = :product_id AND uploader_id = :uploader_id";
    }

    try {
        $stmt = $this->pdo->prepare($sql);
        
        $params = [
            ':sale_status' => $sale_status,
            ':product_id' => $product_id,
            ':uploader_id' =>$uploader_id
        ];
        
        // Add buyer info params if storing
        if (($sale_status === 'sold' || $sale_status === 'traded') && $buyer_id) {
            $params[':buyer_id'] = $buyer_id;
            if ($conversation_id) {
                $params[':conversation_id'] = $conversation_id;
            }
        }
        
        $stmt->execute($params);

        if ($stmt->rowCount() > 0) {
            // 🧾 AUTOMATICALLY SEND SYSTEM MESSAGE FOR SOLD/TRADED STATUS
            if ($sale_status === 'sold' || $sale_status === 'traded') {
                error_log("🟢🟢🟢 PRODUCT MARKED AS " . strtoupper($sale_status) . " - SENDING SYSTEM MESSAGE 🟢🟢🟢");
                
                // Find the conversation for this product where the seller (uploader) is involved
                $conversationSql = "SELECT c.conversation_id, c.buyer_id, c.seller_id, 
                                          u.full_name as buyer_name, 
                                          p.product_name, p.price, p.product_images, p.category, 
                                          p.brand_name, p.custom_brand, p.`condition`, p.for_type
                                   FROM conversations c
                                   JOIN users u ON c.buyer_id = u.id
                                   JOIN products p ON c.product_id = p.product_id
                                   WHERE c.product_id = :product_id AND c.seller_id = :uploader_id
                                   ORDER BY c.created_at DESC LIMIT 1";
                
                $conversationStmt = $this->pdo->prepare($conversationSql);
                $conversationStmt->execute([
                    ':product_id' => $product_id,
                    ':uploader_id' => $uploader_id
                ]);
                
                $conversation = $conversationStmt->fetch(\PDO::FETCH_ASSOC);
                
                if ($conversation) {
                    error_log("📋 Found conversation for system message: " . $conversation['conversation_id']);
                    error_log("👤 Buyer: " . $conversation['buyer_name'] . " (ID: " . $conversation['buyer_id'] . ")");
                    error_log("📦 Product: " . $conversation['product_name'] . " - ₱" . $conversation['price']);
                    
                    // Build special details
                    $specialDetails = [];
                    
                    // Add category
                    if (!empty($conversation['category'])) {
                        $specialDetails[] = "Category: " . $conversation['category'];
                    }
                    
                    // Add brand
                    if (!empty($conversation['brand_name']) && $conversation['brand_name'] !== 'no brand') {
                        if ($conversation['brand_name'] === 'others' && !empty($conversation['custom_brand'])) {
                            $specialDetails[] = "Brand: " . $conversation['custom_brand'];
                        } else {
                            $specialDetails[] = "Brand: " . $conversation['brand_name'];
                        }
                    }
                    
                    // Add condition
                    if (!empty($conversation['condition'])) {
                        $specialDetails[] = "Condition: " . ucfirst($conversation['condition']);
                    }
                    
                    // Add listing type
                    if (!empty($conversation['for_type'])) {
                        $specialDetails[] = "Type: " . ucfirst($conversation['for_type']);
                    }
                    
                    // Format special details
                    $specialDetailsText = !empty($specialDetails) ? implode(", ", $specialDetails) : "No additional details";
                    
                    // Create the personalized buyer confirmation message
                    $statusText = $sale_status === 'sold' ? 'sold' : 'traded';
                    $systemMessage = "The " . $conversation['product_name'] . " was already " . $statusText . " to you.\n\n";
                    $systemMessage .= "Product Details:\n";
                    $systemMessage .= "• Price: ₱" . number_format($conversation['price'], 2) . "\n";
                    $systemMessage .= "• " . $specialDetailsText . "\n\n";
                    $systemMessage .= "You may fill up the rating form to complete your transaction.";
                    
                    // Insert the system message (sender_id = 0)
                    $messageSql = "INSERT INTO messages (conversation_id, sender_id, message_text, created_at) 
                                  VALUES (:conversation_id, 0, :message_text, NOW())";
                    
                    try {
                        $messageStmt = $this->pdo->prepare($messageSql);
                        $messageResult = $messageStmt->execute([
                            ':conversation_id' => $conversation['conversation_id'],
                            ':message_text' => $systemMessage
                        ]);
                        
                        if ($messageResult) {
                            $messageId = $this->pdo->lastInsertId();
                            error_log("✅✅✅ SYSTEM MESSAGE SENT SUCCESSFULLY! Message ID: " . $messageId . " ✅✅✅");
                            error_log("📨 System message: " . $systemMessage);
                            
                            // 🔴 BROADCAST SYSTEM MESSAGE VIA SOCKET.IO
                            // Emit the message to both buyer and seller rooms
                            $socketData = [
                                'conversation_id' => $conversation['conversation_id'],
                                'message_id' => $messageId,
                                'sender_id' => 0, // System message
                                'sender_name' => 'System',
                                'sender_avatar' => '',
                                'message_text' => $systemMessage,
                                'created_at' => date('Y-m-d H:i:s'),
                                'is_read' => false,
                                'is_system_message' => true,
                                'system_message_type' => $sale_status,
                                'product_id' => $product_id,
                                'product_name' => $conversation['product_name'],
                                'product_status' => $sale_status
                            ];
                            
                            // Emit to buyer room
                            $this->emitSocketEvent('user_' . $conversation['buyer_id'], 'new_message', $socketData);
                            
                            // Emit to seller room
                            $this->emitSocketEvent('user_' . $conversation['seller_id'], 'new_message', $socketData);
                            
                            // Also emit product status change event
                            $statusChangeData = [
                                'product_id' => $product_id,
                                'conversation_id' => $conversation['conversation_id'],
                                'new_status' => $sale_status,
                                'product_name' => $conversation['product_name']
                            ];
                            
                            $this->emitSocketEvent('user_' . $conversation['buyer_id'], 'product_status_changed', $statusChangeData);
                            $this->emitSocketEvent('user_' . $conversation['seller_id'], 'product_status_changed', $statusChangeData);
                            
                            error_log("🔴 Socket.IO events emitted to buyer and seller");
                        } else {
                            error_log("❌ Failed to insert system message");
                        }
                    } catch (\PDOException $messageError) {
                        error_log("❌ System message error: " . $messageError->getMessage());
                    }
                } else {
                    error_log("⚠️ No conversation found for product_id: " . $product_id . " with seller_id: " . $uploader_id);
                    error_log("🔍 This might be because no buyer has messaged about this product yet");
                }
            }
            
            // Log the status change for admin monitoring
            $logSql = "INSERT INTO product_status_log (product_id, previous_status, new_status, for_type, changed_by, changed_at, product_name) 
                       VALUES (:product_id, :previous_status, :new_status, :for_type, :changed_by, :changed_at, :product_name)";
            
            try {
                $logStmt = $this->pdo->prepare($logSql);
                $logStmt->execute([
                    ':product_id' => $product_id,
                    ':previous_status' => $currentProduct['sale_status'],
                    ':new_status' => $sale_status,
                    ':for_type' => $for_type,
                    ':changed_by' => $uploader_id,
                    ':changed_at' => $updated_at,
                    ':product_name' => $currentProduct['product_name']
                ]);
            } catch (\PDOException $logError) {
                // Log error but don't fail the main operation
                error_log("Failed to log status change: " . $logError->getMessage());
            }

            // Create notification for admin about the sale status change
            $notificationData = $this->createSaleStatusNotification(
                $product_id, 
                $currentProduct['product_name'], 
                $currentProduct['sale_status'], 
                $sale_status, 
                $for_type, 
                $uploader_id
            );

            // Get the updated product info for response
            $getProduct = $this->pdo->prepare("SELECT * FROM products WHERE product_id = :product_id");
            $getProduct->execute([':product_id' => $product_id]);
            $product = $getProduct->fetch(\PDO::FETCH_ASSOC);

            return $this->sendPayload([
                "product_id" => $product_id,
                "sale_status" => $sale_status,
                "for_type" => $for_type,
                "previous_status" => $currentProduct['sale_status'],
                "updated_at" => $updated_at,
                "product" => $product
            ], "success", "Sale status updated successfully", 200);
        } else {
            return $this->sendPayload(null, "error", "Product not found or unauthorized", 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}

// 🔹 Report Methods
public function submitReport($data) {
    $reporter_id = $data->reporter_id ?? null;
    $reported_user_id = $data->reported_user_id ?? null;
    $product_id = $data->product_id ?? null;
    $conversation_id = $data->conversation_id ?? null;
    
    // New schema fields
    $report_type = $data->report_type ?? null;
    $product_reason_type = $data->product_reason_type ?? null;
    $user_reason_type = $data->user_reason_type ?? null;
    
    $reason_details = $data->reason_details ?? null;
    $proof = $data->proof ?? null;  // JSON string from frontend
    $status = $data->status ?? 'pending';

    // Validate required fields
    if (!$reporter_id) {
        return $this->sendPayload(null, "error", "Reporter ID is required", 400);
    }

    if (!$report_type) {
        return $this->sendPayload(null, "error", "Report type is required", 400);
    }

    // Validate report_type enum
    $valid_report_types = ['product', 'user_behavior', 'post_purchase_concern'];
    if (!in_array($report_type, $valid_report_types)) {
        return $this->sendPayload(null, "error", "Invalid report type", 400);
    }

    // Validate reason types based on report type
    if ($report_type === 'product') {
        if (!$product_reason_type) {
            return $this->sendPayload(null, "error", "Product reason type is required for product reports", 400);
        }
        $valid_product_reasons = ['scam', 'fake product', 'spam', 'inappropriate content', 'misleading information', 'stolen item', 'others'];
        if (!in_array($product_reason_type, $valid_product_reasons)) {
            return $this->sendPayload(null, "error", "Invalid product reason type", 400);
        }
    } else if ($report_type === 'user_behavior' || $report_type === 'post_purchase_concern') {
        if (!$user_reason_type) {
            return $this->sendPayload(null, "error", "User reason type is required for user behavior reports", 400);
        }
        $valid_user_reasons = ['rude behavior', 'harassment', 'threats', 'scamming attempt', 'not cooperative', 'refund issue', 'item not as described', 'damaged item', 'post purchase issue', 'others'];
        if (!in_array($user_reason_type, $valid_user_reasons)) {
            return $this->sendPayload(null, "error", "Invalid user reason type", 400);
        }
    }

    // Ensure at least one target is provided.
    // For product reports, reported_user_id may be auto-resolved from product uploader.
    if (!$reported_user_id && !$product_id) {
        return $this->sendPayload(null, "error", "Either reported_user_id or product_id must be provided", 400);
    }

    // Process proof files if provided (proof is now a JSON string from frontend)
    $proofFilePaths = null;
    if ($proof && is_string($proof)) {
        // Proof is already a JSON string from frontend
        $proofFilePaths = $proof;
    } else if ($proof && is_array($proof)) {
        $savedProofPaths = [];
        
        foreach ($proof as $index => $base64File) {
            // Validate and save each proof file
            if (preg_match('/^data:(image|video)\/(\w+);base64,/', $base64File, $matches)) {
                $fileType = $matches[1];  // 'image' or 'video'
                $ext = strtolower($matches[2]);
                
                // Validate file extension
                $allowedImageExts = ['jpeg', 'jpg', 'png', 'gif'];
                $allowedVideoExts = ['mp4', 'webm', 'mov'];
                
                if (($fileType === 'image' && !in_array($ext, $allowedImageExts)) ||
                    ($fileType === 'video' && !in_array($ext, $allowedVideoExts))) {
                    return $this->sendPayload(null, "error", "Unsupported file type: {$ext}", 400);
                }
                
                // Decode base64 data
                $imageData = base64_decode(str_replace($matches[0], '', $base64File));
                
                if ($imageData === false) {
                    return $this->sendPayload(null, "error", "Invalid base64 data for proof file", 400);
                }
                
                // Validate file size (10MB limit)
                $maxSize = 10 * 1024 * 1024; // 10MB
                if (strlen($imageData) > $maxSize) {
                    return $this->sendPayload(null, "error", "Proof file too large. Maximum size is 10MB", 400);
                }
                
                // Generate unique filename
                $filename = 'proof_' . uniqid() . '_' . $index . '.' . $ext;
                $filePath = 'uploads/proof/' . $filename;
                
                // Create uploads/proof directory if it doesn't exist
                $uploadDir = dirname($filePath);
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }
                
                // Save file
                if (file_put_contents($filePath, $imageData)) {
                    $savedProofPaths[] = $filePath;
                } else {
                    return $this->sendPayload(null, "error", "Failed to save proof file", 500);
                }
            } else {
                return $this->sendPayload(null, "error", "Invalid proof file format", 400);
            }
        }
        
        // Convert to JSON for database storage
        if (!empty($savedProofPaths)) {
            $proofFilePaths = json_encode($savedProofPaths);
            
            // Validate JSON format for database constraint
            if (!$this->isValidJson($proofFilePaths)) {
                return $this->sendPayload(null, "error", "Failed to encode proof files as JSON", 500);
            }
        }
    }

    // Check if reporter exists
    try {
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE id = :reporter_id");
        $stmt->execute([':reporter_id' => $reporter_id]);
        if (!$stmt->fetch()) {
            return $this->sendPayload(null, "error", "Reporter not found", 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
    }

    // Check if reported user exists (if reporting a user)
    if ($reported_user_id) {
        try {
            $stmt = $this->pdo->prepare("SELECT id FROM users WHERE id = :reported_user_id");
            $stmt->execute([':reported_user_id' => $reported_user_id]);
            if (!$stmt->fetch()) {
                return $this->sendPayload(null, "error", "Reported user not found", 404);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    // Check if product exists (if reporting a product)
    if ($product_id) {
        try {
            $stmt = $this->pdo->prepare("SELECT product_id, uploader_id FROM products WHERE product_id = :product_id");
            $stmt->execute([':product_id' => $product_id]);
            $product = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (!$product) {
                return $this->sendPayload(null, "error", "Product not found", 404);
            }

            // Auto-link product reports to the product owner when not explicitly provided.
            if (!$reported_user_id && !empty($product['uploader_id'])) {
                $reported_user_id = (int)$product['uploader_id'];
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    // Insert report with exact database field mapping
        $sql = "INSERT INTO reports (
                reporter_id, 
                reported_user_id, 
                product_id,
                conversation_id,
                report_type,
                product_reason_type,
                user_reason_type, 
                reason_details, 
                proof,
                status, 
                created_at
            ) VALUES (
                :reporter_id, 
                :reported_user_id, 
                :product_id,
                :conversation_id,
                :report_type,
                :product_reason_type,
                :user_reason_type, 
                :reason_details, 
                :proof,
                :status, 
                NOW()
            )";    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':reporter_id' => $reporter_id,
            ':reported_user_id' => $reported_user_id,
            ':product_id' => $product_id,
            ':conversation_id' => $conversation_id,
            ':report_type' => $report_type,
            ':product_reason_type' => $product_reason_type,
            ':user_reason_type' => $user_reason_type,
            ':reason_details' => $reason_details,
            ':proof' => $proofFilePaths,
            ':status' => $status
        ]);

        $report_id = $this->pdo->lastInsertId();

        return $this->sendPayload([
            "report_id" => $report_id,
            "reporter_id" => $reporter_id,
            "reported_user_id" => $reported_user_id,
            "product_id" => $product_id,
            "conversation_id" => $conversation_id,
            "report_type" => $report_type,
            "product_reason_type" => $product_reason_type,
            "user_reason_type" => $user_reason_type,
            "status" => $status,
            "message" => "Report submitted successfully"
        ], "success", "Report submitted successfully", 201);

    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Failed to submit report: " . $e->getMessage(), 500);
    }
}

// 🔹 Submit User Report (for user_reports table)
public function submitUserReport($data) {
    $reporter_id = $data->reporter_id ?? null;
    $reported_user_id = $data->reported_user_id ?? null;
    $conversation_id = $data->conversation_id ?? null;
    $product_id = $data->product_id ?? null;
    $report_type = $data->report_type ?? null;
    $reason_type = $data->reason_type ?? null;
    $reason_details = $data->reason_details ?? null;
    $explanation = $data->explanation ?? null;
    $message_reference = $data->message_reference ?? null;
    $proof_files = $data->proof_files ?? null;

    // Validate required fields
    if (!$reporter_id || !$reported_user_id || !$report_type || !$reason_type) {
        return $this->sendPayload(null, "error", "Reporter ID, reported user ID, report type, and reason type are required", 400);
    }

    // Validate report_type enum
    $valid_report_types = ['user_behavior', 'post_purchase_concern'];
    if (!in_array($report_type, $valid_report_types)) {
        return $this->sendPayload(null, "error", "Invalid report type", 400);
    }

    // Validate reason_type enum based on report_type
    $valid_reason_types = [
        'user_behavior' => ['rude behavior', 'harassment', 'threats', 'scamming attempt', 'spam messages', 'others'],
        'post_purchase_concern' => ['refund issue', 'item not as described', 'damaged item', 'others']
    ];
    
    if (!in_array($reason_type, $valid_reason_types[$report_type])) {
        return $this->sendPayload(null, "error", "Invalid reason type for the selected report type", 400);
    }

    // Check if reason_details is required (when reason_type is 'others')
    if ($reason_type === 'others' && empty($reason_details)) {
        return $this->sendPayload(null, "error", "Reason details are required when reason type is 'others'", 400);
    }

    // Process proof files if provided
    $proofFilesJson = null;
    if ($proof_files && is_array($proof_files)) {
        $savedProofPaths = [];
        
        foreach ($proof_files as $index => $base64File) {
            // Check if it's a base64 string
            if (is_string($base64File) && !empty($base64File)) {
                // Generate filename for base64 data
                $ext = 'jpg'; // Default extension
                $fileName = 'user_report_' . $reporter_id . '_' . time() . '_' . $index . '.' . $ext;
                $filePath = 'uploads/user_reports/' . $fileName;
                
                // Create directory if it doesn't exist
                if (!file_exists('uploads/user_reports/')) {
                    mkdir('uploads/user_reports/', 0777, true);
                }
                
                // Decode and save base64 data
                $fileData = base64_decode($base64File);
                if ($fileData && file_put_contents($filePath, $fileData)) {
                    $savedProofPaths[] = $filePath;
                } else {
                    error_log("Failed to save proof file: " . $fileName);
                }
            }
        }
        
        if (!empty($savedProofPaths)) {
            $proofFilesJson = json_encode($savedProofPaths);
        }
    }

    // Process message reference if provided
    $messageReferenceJson = null;
    if ($message_reference && is_array($message_reference)) {
        $messageReferenceJson = json_encode($message_reference);
    }

    try {
        $sql = "INSERT INTO user_reports (
                    reporter_id, 
                    reported_user_id, 
                    conversation_id, 
                    product_id, 
                    report_type, 
                    reason_type, 
                    reason_details, 
                    explanation,
                    message_reference, 
                    proof_files, 
                    status, 
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            $reporter_id,
            $reported_user_id,
            $conversation_id,
            $product_id,
            $report_type,
            $reason_type,
            $reason_details,
            $explanation,
            $messageReferenceJson,
            $proofFilesJson
        ]);

        $reportId = $this->pdo->lastInsertId();

        return $this->sendPayload([
            "user_report_id" => $reportId,
            "reporter_id" => $reporter_id,
            "reported_user_id" => $reported_user_id,
            "conversation_id" => $conversation_id,
            "product_id" => $product_id,
            "report_type" => $report_type,
            "reason_type" => $reason_type,
            "status" => "pending",
            "message" => "User report submitted successfully"
        ], "success", "User report submitted successfully", 201);

    } catch (\PDOException $e) {
        error_log("Error submitting user report: " . $e->getMessage());
        return $this->sendPayload(null, "error", "Failed to submit user report: " . $e->getMessage(), 500);
    }
}

// Update user report status (for admin)
public function updateUserReportStatus($data) {
    $user_report_id = $data->user_report_id ?? null;
    $status = $data->status ?? null;

    if (!$user_report_id || !$status) {
        return $this->sendPayload(null, "error", "User report ID and status are required", 400);
    }

    // Validate status enum
    $valid_statuses = ['pending', 'reviewed', 'action_taken'];
    if (!in_array($status, $valid_statuses)) {
        return $this->sendPayload(null, "error", "Invalid status. Must be: pending, reviewed, or action_taken", 400);
    }

    // Check if user report exists
    try {
        $stmt = $this->pdo->prepare("SELECT user_report_id FROM user_reports WHERE user_report_id = ?");
        $stmt->execute([$user_report_id]);
        if (!$stmt->fetch()) {
            return $this->sendPayload(null, "error", "User report not found", 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
    }

    // Update user report status
    $sql = "UPDATE user_reports SET status = ? WHERE user_report_id = ?";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$status, $user_report_id]);

        if ($stmt->rowCount() > 0) {
            return $this->sendPayload([
                "user_report_id" => $user_report_id,
                "status" => $status,
                "updated_at" => date('Y-m-d H:i:s')
            ], "success", "User report status updated successfully", 200);
        } else {
            return $this->sendPayload(null, "error", "No changes made", 400);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Failed to update user report status: " . $e->getMessage(), 500);
    }
}

// Get reports by user (reports they made)
public function getUserReports($user_id) {
    if (!$user_id) {
        return $this->sendPayload(null, "error", "User ID is required", 400);
    }

    // Check if user exists
    try {
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE id = :user_id");
        $stmt->execute([':user_id' => $user_id]);
        if (!$stmt->fetch()) {
            return $this->sendPayload(null, "error", "User not found", 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
    }

    // Get all reports made by this user with exact database field mapping
    $sql = "SELECT 
                r.report_id,
                r.reporter_id,
                r.reported_user_id,
                r.product_id,
                r.product_images,
                r.product_description,
                r.reason_type,
                r.reason_details,
                r.proof,
                r.status,
                r.created_at,
                r.reviewed_by,
                r.reviewed_at,
                CASE 
                    WHEN r.reported_user_id IS NOT NULL THEN 
                        (SELECT full_name FROM users WHERE id = r.reported_user_id)
                    ELSE NULL 
                END as reported_user_name,
                CASE 
                    WHEN r.reported_user_id IS NOT NULL THEN 
                        (SELECT email FROM users WHERE id = r.reported_user_id)
                    ELSE NULL 
                END as reported_user_email,
                CASE 
                    WHEN r.product_id IS NOT NULL THEN 
                        (SELECT product_name FROM products WHERE product_id = r.product_id)
                    ELSE NULL 
                END as product_name
            FROM reports r 
            WHERE r.reporter_id = ? 
            ORDER BY r.created_at DESC";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$user_id]);
        $reports = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        // Convert JSON strings to arrays for product_images and proof if they exist
        foreach ($reports as &$report) {
            if ($report['product_images'] && $this->isValidJson($report['product_images'])) {
                $report['product_images'] = json_decode($report['product_images'], true);
            }
            if ($report['proof'] && $this->isValidJson($report['proof'])) {
                $report['proof'] = json_decode($report['proof'], true);
            }
        }

        return $this->sendPayload($reports, "success", "Reports retrieved successfully", 200);
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Failed to retrieve reports: " . $e->getMessage(), 500);
    }
}

// Admin: Get all reports
public function getAllReports() {
    // Get all reports with proper joins to related tables
    $sql = "SELECT 
                r.report_id,
                r.reporter_id,
                r.reported_user_id,
                r.product_id,
                r.conversation_id,
                r.report_type,
                r.product_reason_type,
                r.user_reason_type,
                r.reason_details,
                r.explanation,
                r.message_reference,
                r.proof,
                r.status,
                r.created_at,
                r.reviewed_by,
                r.reviewed_at,
                reporter.full_name as reporter_name,
                reporter.email as reporter_email,
                reporter.profile_image as reporter_profile_image,
                reported_user.full_name as reported_user_name,
                reported_user.email as reported_user_email,
                p.product_name,
                p.price as product_price,
                p.product_images,
                p.description as product_description,
                reviewer.username as reviewed_by_name
            FROM reports r 
            LEFT JOIN users reporter ON r.reporter_id = reporter.id
            LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
            LEFT JOIN products p ON r.product_id = p.product_id
            LEFT JOIN admins reviewer ON r.reviewed_by = reviewer.admin_id
            ORDER BY r.created_at DESC";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();
        $reports = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        // Convert JSON strings to arrays for product_images but keep proof as JSON string for frontend
        foreach ($reports as &$report) {
            if ($report['product_images'] && $this->isValidJson($report['product_images'])) {
                $report['product_images'] = json_decode($report['product_images'], true);
            }
            // Keep proof as JSON string - the frontend will handle parsing
            // This ensures the TypeScript getProofFileUrls() method works correctly
        }

        return $this->sendPayload($reports, "success", "All reports retrieved successfully", 200);
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Failed to retrieve reports: " . $e->getMessage(), 500);
    }
}

// Admin: Update report status
public function updateReportStatus($data) {
    $report_id = $data->report_id ?? null;
    $status = $data->status ?? null;

    if (!$report_id || !$status) {
        return $this->sendPayload(null, "error", "Report ID and status are required", 400);
    }

    // Validate status enum (exact match with database)
    $valid_statuses = ['pending', 'reviewed', 'action_taken'];
    if (!in_array($status, $valid_statuses)) {
        return $this->sendPayload(null, "error", "Invalid status. Must be: pending, reviewed, or action_taken", 400);
    }

    // Check if report exists
    try {
        $stmt = $this->pdo->prepare("SELECT report_id FROM reports WHERE report_id = ?");
        $stmt->execute([$report_id]);
        if (!$stmt->fetch()) {
            return $this->sendPayload(null, "error", "Report not found", 404);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
    }

    // Update report status with exact database field mapping
    $sql = "UPDATE reports 
            SET status = ?, reviewed_at = NOW() 
            WHERE report_id = ?";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$status, $report_id]);

        if ($stmt->rowCount() > 0) {
            return $this->sendPayload([
                "report_id" => $report_id,
                "status" => $status,
                "updated_at" => date('Y-m-d H:i:s')
            ], "success", "Report status updated successfully", 200);
        } else {
            return $this->sendPayload(null, "error", "No changes made", 400);
        }
    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Failed to update report status: " . $e->getMessage(), 500);
    }
}

    // Password validation method
    private function validatePasswordStrength($password) {
        $errors = [];
        
        // Check minimum length (8 characters)
        if (strlen($password) < 8) {
            $errors[] = "At least 8 characters long";
        }
        
        // Check for uppercase letters (A-Z)
        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = "Contains uppercase letters (Aâ€“Z)";
        }
        
        // Check for lowercase letters (a-z)
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = "Contains lowercase letters (aâ€“z)";
        }
        
        // Check for numbers (0-9)
        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = "Contains numbers (0â€“9)";
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }

    // Archive/Restore product function
    public function archiveProduct($data) {
        $product_id = $data->product_id ?? null;
        $archived_by = $data->admin_id ?? null;
        $role = $data->role ?? 'moderator';
        $reason = $data->reason ?? null;
        $action = $data->action ?? 'archived'; // 'archived' or 'restored'

        if (!$product_id || !$archived_by) {
            return $this->sendPayload(null, "error", "Missing required fields", 400);
        }

        // Require reason when archiving
        if ($action === 'archived' && !$reason) {
            return $this->sendPayload(null, "error", "Archive reason is required", 400);
        }

        // Determine new status based on action
        $new_status = ($action === 'archived') ? 'archived' : 'active';
        $is_archived = ($action === 'archived') ? 1 : 0;

        try {
            // Begin transaction
            $this->pdo->beginTransaction();

            // Get product details for notification
            $productSql = "SELECT p.product_name, p.uploader_id, u.full_name as uploader_name 
                          FROM products p 
                          JOIN users u ON p.uploader_id = u.id 
                          WHERE p.product_id = :product_id";
            $productStmt = $this->pdo->prepare($productSql);
            $productStmt->execute(['product_id' => $product_id]);
            $product = $productStmt->fetch(\PDO::FETCH_ASSOC);

            if (!$product) {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Product not found", 404);
            }

            // Update product status with new archive fields
            if ($action === 'archived') {
                $sql = "UPDATE products 
                       SET status = :status, 
                           is_archived = :is_archived, 
                           archive_reason = :archive_reason,
                           archived_at = CURRENT_TIMESTAMP,
                           archived_by = :archived_by
                       WHERE product_id = :product_id";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([
                    'status' => $new_status,
                    'is_archived' => $is_archived,
                    'archive_reason' => $reason,
                    'archived_by' => $archived_by,
                    'product_id' => $product_id
                ]);
            } else {
                // Restore product - clear archive fields
                $sql = "UPDATE products 
                       SET status = :status, 
                           is_archived = :is_archived, 
                           archive_reason = NULL,
                           archived_at = NULL,
                           archived_by = NULL
                       WHERE product_id = :product_id";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([
                    'status' => $new_status,
                    'is_archived' => $is_archived,
                    'product_id' => $product_id
                ]);
            }

            // Insert into archive history (if table exists)
            try {
                $historySql = "INSERT INTO archive_history (product_id, archived_by, role, reason, action) 
                              VALUES (:product_id, :archived_by, :role, :reason, :action)";
                $historyStmt = $this->pdo->prepare($historySql);
                $historyStmt->execute([
                    'product_id' => $product_id,
                    'archived_by' => $archived_by,
                    'role' => $role,
                    'reason' => $reason,
                    'action' => $action
                ]);
            } catch (\PDOException $e) {
                // Archive history table may not exist, continue without failing
                error_log("Archive history insert failed: " . $e->getMessage());
            }

            // Send notification to product uploader
            if ($action === 'archived') {
                $notificationTitle = "Product Archived";
                $notificationMessage = "Your product '{$product['product_name']}' has been archived. Reason: {$reason}";
                $notificationType = 'Product Archived';
            } else {
                // Notification for restore
                $notificationTitle = "Product Restored";
                $notificationMessage = "Great news! Your product '{$product['product_name']}' has been restored and is now active again.";
                $notificationType = 'Product Restored';
            }
            
            // Insert user notification
            $notifSql = "INSERT INTO user_notifications (user_id, type, title, message, reference_id, created_at) 
                        VALUES (:user_id, :type, :title, :message, :reference_id, NOW())";
            $notifStmt = $this->pdo->prepare($notifSql);
            $notifStmt->execute([
                'user_id' => $product['uploader_id'],
                'type' => $notificationType,
                'title' => $notificationTitle,
                'message' => $notificationMessage,
                'reference_id' => $product_id
            ]);

            $this->pdo->commit();

            return $this->sendPayload([
                'product_id' => $product_id,
                'status' => $new_status,
                'action' => $action,
                'is_archived' => $is_archived
            ], "success", "Product " . $action . " successfully", 200);

        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // âœ… Notification System Functions
    
    // Create a new notification
    public function createNotification($type, $title, $message, $reference_id = null, $created_by = null) {
        try {
            // Insert into notifications table
            $sql = "INSERT INTO notifications (type, title, message, reference_id, created_by) 
                    VALUES (:type, :title, :message, :reference_id, :created_by)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'reference_id' => $reference_id,
                'created_by' => $created_by
            ]);
            
            $notification_id = $this->pdo->lastInsertId();
            
            // Get all admin IDs and create admin_notifications entries
            $adminSql = "SELECT admin_id FROM admins WHERE status = 'active'";
            $adminStmt = $this->pdo->prepare($adminSql);
            $adminStmt->execute();
            $admins = $adminStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Insert notification for each admin
            foreach ($admins as $admin) {
                $adminNotifSql = "INSERT INTO admin_notifications (notification_id, admin_id) VALUES (:notification_id, :admin_id)";
                $adminNotifStmt = $this->pdo->prepare($adminNotifSql);
                $adminNotifStmt->execute([
                    'notification_id' => $notification_id,
                    'admin_id' => $admin['admin_id']
                ]);
            }
            
            return $notification_id;
            
        } catch (\PDOException $e) {
            error_log("Notification creation failed: " . $e->getMessage());
            return false;
        }
    }

    // Get admin notifications
    public function getAdminNotifications($admin_id) {
        try {
            $sql = "SELECT n.notification_id, n.type, n.title, n.message, n.reference_id, n.created_at, n.created_by, 
                           an.is_read, an.read_at, u.full_name as created_by_name
                    FROM notifications n
                    INNER JOIN admin_notifications an ON n.notification_id = an.notification_id
                    LEFT JOIN users u ON n.created_by = u.id
                    WHERE an.admin_id = :admin_id
                    ORDER BY n.created_at DESC
                    LIMIT 50";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['admin_id' => $admin_id]);
            
            return $this->sendPayload($stmt->fetchAll(PDO::FETCH_ASSOC), "success", "Notifications retrieved successfully", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // Mark notification as read
    public function markNotificationAsRead($notification_id, $admin_id) {
        try {
            $sql = "UPDATE admin_notifications 
                    SET is_read = 1, read_at = CURRENT_TIMESTAMP 
                    WHERE notification_id = :notification_id AND admin_id = :admin_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'notification_id' => $notification_id,
                'admin_id' => $admin_id
            ]);

            return $this->sendPayload(['notification_id' => $notification_id], "success", "Notification marked as read", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // Get notification counts for admin
    public function getNotificationCounts($admin_id) {
        try {
            $sql = "SELECT 
                        COUNT(*) as total_count,
                        SUM(CASE WHEN an.is_read = 0 THEN 1 ELSE 0 END) as unread_count
                    FROM admin_notifications an
                    INNER JOIN notifications n ON an.notification_id = n.notification_id
                    WHERE an.admin_id = :admin_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['admin_id' => $admin_id]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            return $this->sendPayload([
                'total_count' => (int)$result['total_count'],
                'unread_count' => (int)$result['unread_count']
            ], "success", "Notification counts retrieved", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // Get dashboard statistics
    public function getDashboardStats() {
        try {
            // Get total user count
            $userSql = "SELECT COUNT(*) as total_users FROM users";
            $userStmt = $this->pdo->prepare($userSql);
            $userStmt->execute();
            $totalUsers = $userStmt->fetch(PDO::FETCH_ASSOC)['total_users'];
            
            // Get total listings count (all products regardless of status)
            $listingSql = "SELECT COUNT(*) as total_listings FROM products";
            $listingStmt = $this->pdo->prepare($listingSql);
            $listingStmt->execute();
            $totalListings = $listingStmt->fetch(PDO::FETCH_ASSOC)['total_listings'];
            
            // Get total reports count
            $reportSql = "SELECT COUNT(*) as total_reports FROM reports";
            $reportStmt = $this->pdo->prepare($reportSql);
            $reportStmt->execute();
            $totalReports = $reportStmt->fetch(PDO::FETCH_ASSOC)['total_reports'];
            
            // Get total conversations count
            $conversationSql = "SELECT COUNT(*) as total_conversations FROM conversations";
            $conversationStmt = $this->pdo->prepare($conversationSql);
            $conversationStmt->execute();
            $totalConversations = $conversationStmt->fetch(PDO::FETCH_ASSOC)['total_conversations'];
            
            return $this->sendPayload([
                'total_users' => (int)$totalUsers,
                'total_listings' => (int)$totalListings,
                'total_reports' => (int)$totalReports,
                'total_conversations' => (int)$totalConversations
            ], "success", "Dashboard stats retrieved", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // Get chart data for dashboard
    public function getChartData($type) {
        try {
            switch ($type) {
                case 'growth':
                    return $this->getGrowthChartData();
                case 'categories':
                    return $this->getCategoriesChartData();
                case 'reports':
                    return $this->getReportsChartData();
                case 'top-sellers':
                    return $this->getTopSellersChartData();
                default:
                    return $this->sendPayload(null, "error", "Invalid chart type", 400);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // Get growth chart data (users and products per month)
    private function getGrowthChartData() {
        $sql = "SELECT 
                    DATE_FORMAT(date_month, '%Y-%m') as month,
                    COALESCE(users_count, 0) as users_count,
                    COALESCE(products_count, 0) as products_count
                FROM (
                    SELECT DATE_FORMAT(CURDATE() - INTERVAL seq.seq MONTH, '%Y-%m-01') as date_month
                    FROM (
                        SELECT 0 as seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL 
                        SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL 
                        SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL 
                        SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
                    ) seq
                ) months
                LEFT JOIN (
                    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as users_count
                    FROM users 
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ) user_data ON months.date_month = CONCAT(user_data.month, '-01')
                LEFT JOIN (
                    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as products_count
                    FROM products 
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ) product_data ON months.date_month = CONCAT(product_data.month, '-01')
                ORDER BY date_month DESC
                LIMIT 12";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return $this->sendPayload(array_reverse($result), "success", "Growth chart data retrieved", 200);
    }

    // Get categories distribution chart data
    private function getCategoriesChartData() {
        $sql = "SELECT 
                    COALESCE(category, 'others') as category,
                    COUNT(*) as count
                FROM products 
                GROUP BY category
                ORDER BY count DESC";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return $this->sendPayload($result, "success", "Categories chart data retrieved", 200);
    }

    // Get reports by reason type chart data
    private function getReportsChartData() {
        $sql = "SELECT 
                    reason_type,
                    COUNT(*) as count
                FROM reports 
                GROUP BY reason_type
                ORDER BY count DESC";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return $this->sendPayload($result, "success", "Reports chart data retrieved", 200);
    }

    // Get top 5 most active sellers
    private function getTopSellersChartData() {
        $sql = "SELECT 
                    u.full_name as seller_name,
                    u.email as seller_email,
                    COUNT(p.product_id) as products_count
                FROM users u
                INNER JOIN products p ON u.id = p.uploader_id
                GROUP BY u.id, u.full_name, u.email
                ORDER BY products_count DESC
                LIMIT 5";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return $this->sendPayload($result, "success", "Top sellers chart data retrieved", 200);
    }

    // Helper function to get user name by ID
    public function getUserNameById($user_id) {
        try {
            $sql = "SELECT full_name FROM users WHERE id = :user_id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['user_id' => $user_id]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ? $result['full_name'] : 'Unknown User';
        } catch (\PDOException $e) {
            return 'Unknown User';
        }
    }

    // Helper function to get readable text for for_type
    public function getForTypeText($for_type) {
        switch ($for_type) {
            case 'sale': return 'item for sale';
            case 'trade': return 'item for trade';
            case 'both': return 'item for sale/trade';
            default: return 'item';
        }
    }

    // Create sale status notification for admin
    public function createSaleStatusNotification($product_id, $product_name, $previous_status, $new_status, $for_type, $user_id) {
        try {
            // Get user name for the notification
            $userName = $this->getUserNameById($user_id);
            
            // Determine the action type and message
            $actionText = '';
            $notificationType = 'system'; // Use 'system' as it's one of the allowed enum values
            
            if ($new_status === 'sold') {
                $actionText = 'marked as sold';
            } elseif ($new_status === 'traded') {
                $actionText = 'marked as traded';
            } elseif ($new_status === 'reserved') {
                $actionText = 'marked as reserved';
            } elseif ($new_status === 'available') {
                $actionText = 'marked as available';
            } else {
                $actionText = "status changed from {$previous_status} to {$new_status}";
            }
            
            $title = "Listing Status Update";
            $message = "{$userName} has {$actionText} their listing '{$product_name}'";
            
            // Create the notification
            $notification_id = $this->createNotification(
                $notificationType,
                $title,
                $message,
                $product_id,
                $user_id
            );
            
            return [
                'success' => true,
                'notification_id' => $notification_id,
                'message' => $message
            ];
            
        } catch (\Exception $e) {
            error_log("Sale status notification creation failed: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Create new admin user
     */
    public function createAdmin($data) {
        $username = $data->username ?? null;
        $email = $data->email ?? null;
        $password = $data->password ?? null;
        $full_name = $data->full_name ?? null;
        $role = $data->role ?? 'moderator';
        $created_by_role = $data->created_by_role ?? null;

        // Validate required fields
        if (!$username || !$email || !$password || !$full_name) {
            return $this->sendPayload(null, "error", "All fields are required", 400);
        }

        // Role-based permission check
        if ($created_by_role !== 'super admin' && $created_by_role !== 'moderator') {
            return $this->sendPayload(null, "error", "Insufficient permissions to create admin", 403);
        }

        // Super admins can create any role, moderators can only create support staff
        if ($created_by_role === 'moderator' && in_array($role, ['super admin', 'moderator'])) {
            return $this->sendPayload(null, "error", "Moderators can only create support staff", 403);
        }

        // Validate role
        if (!in_array($role, ['super admin', 'moderator', 'support'])) {
            return $this->sendPayload(null, "error", "Invalid role specified", 400);
        }

        // Check if username already exists
        $checkUsername = "SELECT admin_id FROM admins WHERE username = :username";
        try {
            $stmt = $this->pdo->prepare($checkUsername);
            $stmt->execute([':username' => $username]);
            if ($stmt->fetch()) {
                return $this->sendPayload(null, "error", "Username already exists", 409);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }

        // Check if email already exists
        $checkEmail = "SELECT admin_id FROM admins WHERE email = :email";
        try {
            $stmt = $this->pdo->prepare($checkEmail);
            $stmt->execute([':email' => $email]);
            if ($stmt->fetch()) {
                return $this->sendPayload(null, "error", "Email already exists", 409);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        // Insert new admin
        $sql = "INSERT INTO admins (username, email, password, full_name, role, status) 
                VALUES (:username, :email, :password, :full_name, :role, 'active')";

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':username' => $username,
                ':email' => $email,
                ':password' => $hashedPassword,
                ':full_name' => $full_name,
                ':role' => $role
            ]);

            $adminId = $this->pdo->lastInsertId();

            return $this->sendPayload([
                "admin_id" => $adminId,
                "username" => $username,
                "email" => $email,
                "full_name" => $full_name,
                "role" => $role,
                "status" => "active"
            ], "success", "Admin created successfully", 201);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Failed to create admin: " . $e->getMessage(), 500);
        }
    }

    /**
     * Update admin user
     */
    public function updateAdmin($data) {
        $admin_id = $data->admin_id ?? null;
        $username = $data->username ?? null;
        $email = $data->email ?? null;
        $full_name = $data->full_name ?? null;
        $role = $data->role ?? null;
        $status = $data->status ?? null;
        $updated_by_role = $data->updated_by_role ?? null;
        $updated_by_id = $data->updated_by_id ?? null;

        if (!$admin_id || !$username || !$email || !$full_name || !$role) {
            return $this->sendPayload(null, "error", "All fields are required", 400);
        }

        // Permission check
        if ($updated_by_role !== 'super admin' && $updated_by_role !== 'moderator') {
            return $this->sendPayload(null, "error", "Insufficient permissions", 403);
        }

        // Prevent self-modification of role/status
        if ($admin_id == $updated_by_id) {
            return $this->sendPayload(null, "error", "Cannot modify your own role or status", 403);
        }

        // Moderators cannot modify super admins or other moderators
        if ($updated_by_role === 'moderator') {
            $checkTarget = "SELECT role FROM admins WHERE admin_id = :admin_id";
            try {
                $stmt = $this->pdo->prepare($checkTarget);
                $stmt->execute([':admin_id' => $admin_id]);
                $target = $stmt->fetch(\PDO::FETCH_ASSOC);
                
                if ($target && in_array($target['role'], ['super admin', 'moderator'])) {
                    return $this->sendPayload(null, "error", "Moderators cannot modify super admins or other moderators", 403);
                }
            } catch (\PDOException $e) {
                return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
            }
        }

        $sql = "UPDATE admins SET username = :username, email = :email, full_name = :full_name, role = :role";
        $params = [
            ':admin_id' => $admin_id,
            ':username' => $username,
            ':email' => $email,
            ':full_name' => $full_name,
            ':role' => $role
        ];

        if ($status !== null) {
            $sql .= ", status = :status";
            $params[':status'] = $status;
        }

        $sql .= " WHERE admin_id = :admin_id";

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);

            return $this->sendPayload([
                "admin_id" => $admin_id,
                "message" => "Admin updated successfully"
            ], "success", "Admin updated successfully", 200);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Failed to update admin: " . $e->getMessage(), 500);
        }
    }

    /**
     * Delete admin user
     */
    public function deleteAdmin($data) {
        $admin_id = $data->admin_id ?? null;
        $deleted_by_role = $data->deleted_by_role ?? null;
        $deleted_by_id = $data->deleted_by_id ?? null;

        if (!$admin_id) {
            return $this->sendPayload(null, "error", "Admin ID is required", 400);
        }

        // Only super admins can delete admins
        if ($deleted_by_role !== 'super admin') {
            return $this->sendPayload(null, "error", "Only super admins can delete admin accounts", 403);
        }

        // Prevent self-deletion
        if ($admin_id == $deleted_by_id) {
            return $this->sendPayload(null, "error", "Cannot delete your own account", 403);
        }

        // Check if admin exists
        $checkAdmin = "SELECT admin_id, role FROM admins WHERE admin_id = :admin_id";
        try {
            $stmt = $this->pdo->prepare($checkAdmin);
            $stmt->execute([':admin_id' => $admin_id]);
            $admin = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$admin) {
                return $this->sendPayload(null, "error", "Admin not found", 404);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }

        // Delete admin
        $sql = "DELETE FROM admins WHERE admin_id = :admin_id";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':admin_id' => $admin_id]);

            return $this->sendPayload([
                "admin_id" => $admin_id,
                "message" => "Admin deleted successfully"
            ], "success", "Admin deleted successfully", 200);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Failed to delete admin: " . $e->getMessage(), 500);
        }
    }

    /**
     * Create a new conversation
     */
    public function createConversation($data) {
        $product_id = $data->product_id ?? null;
        $buyer_id = $data->buyer_id ?? null;
        $seller_id = $data->seller_id ?? null;
        $autoResponseMessage = "Hello! Thank you for your interest in this item. We appreciate your inquiry. Kindly wait while the seller reviews your message and responds shortly. Thank you for your patience!";

        if (!$product_id || !$buyer_id || !$seller_id) {
            return $this->sendPayload(null, "error", "Missing required fields: product_id, buyer_id, seller_id", 400);
        }

        // Check if conversation already exists
        $checkSql = "SELECT conversation_id FROM conversations 
                     WHERE product_id = :product_id AND buyer_id = :buyer_id AND seller_id = :seller_id";
        
        try {
            $stmt = $this->pdo->prepare($checkSql);
            $stmt->execute([
                ':product_id' => $product_id,
                ':buyer_id' => $buyer_id,
                ':seller_id' => $seller_id
            ]);
            
            $existing = $stmt->fetch(\PDO::FETCH_ASSOC);
            if ($existing) {
                // Check if this conversation has any messages
                $messageCheckSql = "SELECT COUNT(*) as message_count FROM messages WHERE conversation_id = :conversation_id";
                $stmt = $this->pdo->prepare($messageCheckSql);
                $stmt->execute([':conversation_id' => $existing['conversation_id']]);
                $messageResult = $stmt->fetch(\PDO::FETCH_ASSOC);
                
                // If no messages exist, send the initial product info message
                if ($messageResult['message_count'] == 0) {
                    // Get product details to send initial message
                    $productSql = "SELECT product_name, price, description, location, category, brand_name, custom_brand, for_type, `condition` 
                                  FROM products WHERE product_id = :product_id";
                    $stmt = $this->pdo->prepare($productSql);
                    $stmt->execute([':product_id' => $product_id]);
                    $product = $stmt->fetch(\PDO::FETCH_ASSOC);

                    // Get buyer name for the message
                    $buyerSql = "SELECT full_name FROM users WHERE id = :buyer_id";
                    $stmt = $this->pdo->prepare($buyerSql);
                    $stmt->execute([':buyer_id' => $buyer_id]);
                    $buyer = $stmt->fetch(\PDO::FETCH_ASSOC);

                    if ($product && $buyer) {
                        // Format the product information message
                        $brandInfo = '';
                        if ($product['brand_name'] && $product['brand_name'] !== 'no brand') {
                            if ($product['brand_name'] === 'others' && $product['custom_brand']) {
                                $brandInfo = "\n🏷️ Brand: " . $product['custom_brand'];
                            } else {
                                $brandInfo = "\n🏷️ Brand: " . ucfirst($product['brand_name']);
                            }
                        }

                        $initialMessage = "Hi! I'm interested in your " . $product['product_name'] . "." .
                                        "\n\n📦 Product Details:" .
                                        "\n💰 Price: " . number_format($product['price'], 2) .
                                        "\n📍 Location: " . $product['location'] .
                                        "\n🔧 Condition: " . ucfirst($product['condition']) .
                                        $brandInfo .
                                        "\n📝 Type: " . ucfirst($product['for_type']) .
                                        "\n\n" . $buyer['full_name'];

                        // Log the message for debugging
                        error_log("Creating initial message for existing conversation: " . $initialMessage);

                        // Send initial message automatically
                        $messageSql = "INSERT INTO messages (conversation_id, sender_id, message_text) 
                                      VALUES (:conversation_id, :sender_id, :message_text)";
                        $stmt = $this->pdo->prepare($messageSql);
                        $result = $stmt->execute([
                            ':conversation_id' => $existing['conversation_id'],
                            ':sender_id' => $buyer_id,
                            ':message_text' => $initialMessage
                        ]);
                        
                        if ($result) {
                            error_log("Initial message sent successfully for existing conversation: " . $existing['conversation_id']);

                            // Send automated acknowledgement as a system message
                            $autoReplySql = "INSERT INTO messages (conversation_id, sender_id, message_text) 
                                            VALUES (:conversation_id, :sender_id, :message_text)";
                            $autoReplyStmt = $this->pdo->prepare($autoReplySql);
                            $autoReplyStmt->execute([
                                ':conversation_id' => $existing['conversation_id'],
                                ':sender_id' => $seller_id,
                                ':message_text' => $autoResponseMessage
                            ]);
                        } else {
                            error_log("Failed to send initial message for existing conversation: " . $existing['conversation_id']);
                        }
                    } else {
                        error_log("Missing product or buyer data for existing conversation - Product: " . ($product ? "found" : "not found") . ", Buyer: " . ($buyer ? "found" : "not found"));
                    }
                }
                
                return $this->sendPayload([
                    "conversation_id" => $existing['conversation_id'],
                    "message" => "Conversation already exists"
                ], "success", "Conversation found", 200);
            }

            // Create new conversation
            $sql = "INSERT INTO conversations (product_id, buyer_id, seller_id) 
                    VALUES (:product_id, :buyer_id, :seller_id)";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':product_id' => $product_id,
                ':buyer_id' => $buyer_id,
                ':seller_id' => $seller_id
            ]);

            $conversation_id = $this->pdo->lastInsertId();

            // Get product details to send initial message
            $productSql = "SELECT product_name, price, description, location, category, brand_name, custom_brand, for_type, `condition` 
                          FROM products WHERE product_id = :product_id";
            $stmt = $this->pdo->prepare($productSql);
            $stmt->execute([':product_id' => $product_id]);
            $product = $stmt->fetch(\PDO::FETCH_ASSOC);

            // Get buyer name for the message
            $buyerSql = "SELECT full_name FROM users WHERE id = :buyer_id";
            $stmt = $this->pdo->prepare($buyerSql);
            $stmt->execute([':buyer_id' => $buyer_id]);
            $buyer = $stmt->fetch(\PDO::FETCH_ASSOC);

            if ($product && $buyer) {
                // Format the product information message
                $brandInfo = '';
                if ($product['brand_name'] && $product['brand_name'] !== 'no brand') {
                    if ($product['brand_name'] === 'others' && $product['custom_brand']) {
                        $brandInfo = "\n🏷️ Brand: " . $product['custom_brand'];
                    } else {
                        $brandInfo = "\n🏷️ Brand: " . ucfirst($product['brand_name']);
                    }
                }

                $initialMessage = "Hi! I'm interested in your " . $product['product_name'] . "." .
                                "\n\n📦 Product Details:" .
                                "\n💰 Price: " . number_format($product['price'], 2) .
                                "\n📍 Location: " . $product['location'] .
                                "\n🔧 Condition: " . ucfirst($product['condition']) .
                                $brandInfo .
                                "\n📝 Type: " . ucfirst($product['for_type']) .
                                "\n\n" . $buyer['full_name'];

                // Log the message for debugging
                error_log("Creating initial message: " . $initialMessage);

                // Send initial message automatically
                $messageSql = "INSERT INTO messages (conversation_id, sender_id, message_text) 
                              VALUES (:conversation_id, :sender_id, :message_text)";
                $stmt = $this->pdo->prepare($messageSql);
                $result = $stmt->execute([
                    ':conversation_id' => $conversation_id,
                    ':sender_id' => $buyer_id,
                    ':message_text' => $initialMessage
                ]);
                
                if ($result) {
                    error_log("Initial message sent successfully for conversation: " . $conversation_id);

                    // Send automated acknowledgement as a system message
                    $autoReplySql = "INSERT INTO messages (conversation_id, sender_id, message_text) 
                                    VALUES (:conversation_id, :sender_id, :message_text)";
                    $autoReplyStmt = $this->pdo->prepare($autoReplySql);
                    $autoReplyStmt->execute([
                        ':conversation_id' => $conversation_id,
                        ':sender_id' => $seller_id,
                        ':message_text' => $autoResponseMessage
                    ]);
                } else {
                    error_log("Failed to send initial message for conversation: " . $conversation_id);
                }
            } else {
                error_log("Missing product or buyer data - Product: " . ($product ? "found" : "not found") . ", Buyer: " . ($buyer ? "found" : "not found"));
            }

            return $this->sendPayload([
                "conversation_id" => $conversation_id,
                "product_id" => $product_id,
                "buyer_id" => $buyer_id,
                "seller_id" => $seller_id
            ], "success", "Conversation created successfully", 201);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    /**
     * Send a message
     */
    public function sendMessage($data) {
        error_log("🔵🔵🔵 SEND MESSAGE API CALLED 🔵🔵🔵");
        error_log("Request data: " . json_encode($data));
        
        $conversation_id = $data->conversation_id ?? null;
        $sender_id = $data->sender_id ?? null;
        $message_text = $data->message_text ?? '';
        $attachments = $data->attachments ?? [];

        error_log("Parsed values:");
        error_log("  conversation_id: " . $conversation_id);
        error_log("  sender_id: " . $sender_id);
        error_log("  sender_id type: " . gettype($sender_id));
        error_log("  is_system_message: " . ($sender_id == 0 ? 'YES' : 'NO'));
        error_log("  message_text length: " . strlen($message_text));

        if (!$conversation_id || !isset($sender_id)) {
            error_log("❌ Missing required fields!");
            return $this->sendPayload(null, "error", "Missing required fields: conversation_id, sender_id", 400);
        }

        // At least message text or attachments must be provided
        if (empty($message_text) && empty($attachments)) {
            return $this->sendPayload(null, "error", "Either message text or attachments must be provided", 400);
        }

        // Verify conversation exists and sender is part of it
        // Allow sender_id = 0 for system messages
        try {
            if ($sender_id == 0) {
                error_log("🟢🟢🟢 SYSTEM MESSAGE - Special handling 🟢🟢🟢");
                // System message - only verify conversation exists
                $verifySql = "SELECT * FROM conversations WHERE conversation_id = :conversation_id";
                $stmt = $this->pdo->prepare($verifySql);
                $stmt->execute([':conversation_id' => $conversation_id]);
                
                $conversation = $stmt->fetch(\PDO::FETCH_ASSOC);
                if (!$conversation) {
                    error_log("❌ Conversation not found: " . $conversation_id);
                    return $this->sendPayload(null, "error", "Invalid conversation", 403);
                }
                error_log("✅ Conversation verified: " . json_encode($conversation));
            } else {
                // Regular user message - verify sender is part of conversation
                $verifySql = "SELECT * FROM conversations WHERE conversation_id = :conversation_id 
                              AND (buyer_id = :sender_id1 OR seller_id = :sender_id2)";
                
                $stmt = $this->pdo->prepare($verifySql);
                $stmt->execute([
                    ':conversation_id' => $conversation_id,
                    ':sender_id1' => $sender_id,
                    ':sender_id2' => $sender_id
                ]);
                
                $conversation = $stmt->fetch(\PDO::FETCH_ASSOC);
                if (!$conversation) {
                    return $this->sendPayload(null, "error", "Invalid conversation or unauthorized sender", 403);
                }
            }

            // Process attachments if provided
            $savedAttachments = [];
            if (!empty($attachments)) {
                // Create attachments directory if it doesn't exist
                $attachmentsDir = __DIR__ . '/../uploads/attachments';
                if (!is_dir($attachmentsDir)) {
                    mkdir($attachmentsDir, 0755, true);
                }

                foreach ($attachments as $attachment) {
                    $fileData = $attachment->file ?? null;
                    $fileName = $attachment->name ?? null;
                    $fileType = $attachment->type ?? null;
                    
                    if ($fileData && $fileName && $fileType) {
                        // Validate file type
                        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                                       'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
                        
                        if (!in_array($fileType, $allowedTypes)) {
                            return $this->sendPayload(null, "error", "Unsupported file type: $fileType", 400);
                        }

                        // Decode base64 file data
                        if (preg_match('/^data:([^;]+);base64,(.+)$/', $fileData, $matches)) {
                            $mimeType = $matches[1];
                            $base64Data = $matches[2];
                            $fileContent = base64_decode($base64Data);
                            
                            if ($fileContent === false) {
                                return $this->sendPayload(null, "error", "Invalid file data", 400);
                            }

                            // Generate unique filename
                            $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
                            if (empty($extension)) {
                                $mimeToExt = [
                                    'image/jpeg' => 'jpg',
                                    'image/png' => 'png',
                                    'image/gif' => 'gif',
                                    'image/webp' => 'webp',
                                    'video/mp4' => 'mp4',
                                    'video/webm' => 'webm',
                                    'video/ogg' => 'ogg',
                                    'video/quicktime' => 'mov'
                                ];
                                $extension = $mimeToExt[$mimeType] ?? 'bin';
                            }

                            $uniqueName = uniqid('msg_') . '_' . time() . '.' . $extension;
                            $absoluteFilePath = $attachmentsDir . '/' . $uniqueName;
                            $relativeFilePath = 'uploads/attachments/' . $uniqueName;
                            
                            // Save file
                            if (file_put_contents($absoluteFilePath, $fileContent)) {
                                $savedAttachments[] = [
                                    'type' => strpos($mimeType, 'image/') === 0 ? 'image' : 'video',
                                    'path' => $relativeFilePath,
                                    'name' => $fileName,
                                    'size' => strlen($fileContent)
                                ];
                            } else {
                                return $this->sendPayload(null, "error", "Failed to save attachment: $fileName", 500);
                            }
                        }
                    }
                }
            }

            // Convert attachments array to JSON
            $attachmentsJson = !empty($savedAttachments) ? json_encode($savedAttachments) : null;

            // Insert message
            error_log("📝 Inserting message into database...");
            $sql = "INSERT INTO messages (conversation_id, sender_id, message_text, attachments) 
                    VALUES (:conversation_id, :sender_id, :message_text, :attachments)";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':conversation_id' => $conversation_id,
                ':sender_id' => $sender_id,
                ':message_text' => $message_text,
                ':attachments' => $attachmentsJson
            ]);

            $message_id = $this->pdo->lastInsertId();
            error_log("✅ Message inserted with ID: " . $message_id);

            // Fallback auto-response for inquiry chats (covers older conversations).
            if ($sender_id != 0 && isset($conversation['buyer_id']) && (int)$sender_id === (int)$conversation['buyer_id']) {
                $autoResponseMessage = "Hello! Thank you for your interest in this item. We appreciate your inquiry. Kindly wait while the seller reviews your message and responds shortly. Thank you for your patience!";

                $checkAutoReplySql = "SELECT COUNT(*) as auto_count FROM messages 
                                      WHERE conversation_id = :conversation_id 
                                      AND message_text = :message_text";
                $checkStmt = $this->pdo->prepare($checkAutoReplySql);
                $checkStmt->execute([
                    ':conversation_id' => $conversation_id,
                    ':message_text' => $autoResponseMessage
                ]);
                $autoCount = (int)($checkStmt->fetch(\PDO::FETCH_ASSOC)['auto_count'] ?? 0);

                if ($autoCount === 0) {
                    $autoReplySql = "INSERT INTO messages (conversation_id, sender_id, message_text, created_at) 
                                    VALUES (:conversation_id, :sender_id, :message_text, NOW())";
                    $autoReplyStmt = $this->pdo->prepare($autoReplySql);
                    $autoReplyStmt->execute([
                        ':conversation_id' => $conversation_id,
                        ':sender_id' => $conversation['seller_id'],
                        ':message_text' => $autoResponseMessage
                    ]);
                    error_log("✅ Auto-response inserted for conversation: " . $conversation_id);
                }
            }
            
            if ($sender_id == 0) {
                error_log("🟢 System message saved to database!");
                error_log("  Message ID: " . $message_id);
                error_log("  Conversation ID: " . $conversation_id);
            }

            // Get sender info for response (skip for system messages)
            if ($sender_id == 0) {
                // System message
                $sender = [
                    'full_name' => 'System',
                    'profile_image' => ''
                ];
            } else {
                // Regular user message
                $senderSql = "SELECT full_name, profile_image FROM users WHERE id = :sender_id";
                $stmt = $this->pdo->prepare($senderSql);
                $stmt->execute([':sender_id' => $sender_id]);
                $sender = $stmt->fetch(\PDO::FETCH_ASSOC);
            }

            // Add full URL paths to attachments for frontend
            $attachmentsWithUrls = [];
            foreach ($savedAttachments as $attachment) {
                $attachmentWithUrl = $attachment;
                // $attachmentWithUrl['url'] = 'http://api.cyclemart.shop/CycleMart-api/api' . $attachment['path'];
                $attachmentWithUrl['url'] = 'http://localhost/CycleMart/CycleMart/CycleMart-api/api/' . ltrim($attachment['path'], '/');
                $attachmentsWithUrls[] = $attachmentWithUrl;
            }

            // For system messages, recipient is determined differently
            if ($sender_id == 0) {
                // System message goes to both parties - return buyer as primary recipient
                $recipient_id = $conversation['buyer_id'];
            } else {
                // Regular message - recipient is the other party
                $recipient_id = $conversation['buyer_id'] == $sender_id ? $conversation['seller_id'] : $conversation['buyer_id'];
            }

            return $this->sendPayload([
                "message_id" => $message_id,
                "conversation_id" => $conversation_id,
                "sender_id" => $sender_id,
                "sender_name" => $sender['full_name'] ?? '',
                "sender_avatar" => $sender['profile_image'] ?? '',
                "message_text" => $message_text,
                "attachments" => $attachmentsWithUrls,
                "created_at" => date('Y-m-d H:i:s'),
                "is_read" => 0,
                "recipient_id" => $recipient_id
            ], "success", "Message sent successfully", 201);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    /**
     * Mark messages as read
     */
    public function markMessagesAsRead($data) {
        $conversation_id = $data->conversation_id ?? null;
        $user_id = $data->user_id ?? null;

        if (!$conversation_id || !$user_id) {
            return $this->sendPayload(null, "error", "Missing required fields: conversation_id, user_id", 400);
        }

        try {
            // Mark all messages in conversation as read for the user (excluding their own messages)
            $sql = "UPDATE messages SET is_read = 1 
                    WHERE conversation_id = :conversation_id AND sender_id != :user_id AND is_read = 0";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':conversation_id' => $conversation_id,
                ':user_id' => $user_id
            ]);

            $affected_rows = $stmt->rowCount();

            return $this->sendPayload([
                "conversation_id" => $conversation_id,
                "messages_marked_read" => $affected_rows
            ], "success", "Messages marked as read", 200);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    // 🔹 User Management Methods
    public function deleteUser($data) {
        $user_id = $data->user_id ?? null;
        $admin_id = $data->admin_id ?? null;
        $admin_role = $data->admin_role ?? null;

        // Validate required fields
        if (!$user_id || !$admin_id || !$admin_role) {
            return $this->sendPayload(null, "error", "Missing required fields", 400);
        }

        // Check admin permissions (only super admin and moderator can delete users)
        if (!in_array($admin_role, ['super admin', 'moderator'])) {
            return $this->sendPayload(null, "error", "Insufficient permissions to delete users", 403);
        }

        try {
            // First check if user exists and get their info for logging
            $checkSql = "SELECT id, full_name, email FROM users WHERE id = :user_id";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([':user_id' => $user_id]);
            $user = $checkStmt->fetch(\PDO::FETCH_ASSOC);

            if (!$user) {
                return $this->sendPayload(null, "error", "User not found", 404);
            }

            // Begin transaction to ensure data consistency
            $this->pdo->beginTransaction();

            // Delete related data first to maintain referential integrity
            
            // 1. Delete user's products
            $deleteProductsSql = "DELETE FROM products WHERE uploader_id = :user_id";
            $deleteProductsStmt = $this->pdo->prepare($deleteProductsSql);
            $deleteProductsStmt->execute([':user_id' => $user_id]);

            // 2. Delete user's messages first (get conversation IDs first)
            $getConversationsSql = "SELECT conversation_id FROM conversations WHERE buyer_id = :user_id1 OR seller_id = :user_id2";
            $getConversationsStmt = $this->pdo->prepare($getConversationsSql);
            $getConversationsStmt->execute([':user_id1' => $user_id, ':user_id2' => $user_id]);
            $conversations = $getConversationsStmt->fetchAll(\PDO::FETCH_COLUMN);

            // Delete messages for each conversation
            if (!empty($conversations)) {
                $placeholders = str_repeat('?,', count($conversations) - 1) . '?';
                $deleteMessagesSql = "DELETE FROM messages WHERE conversation_id IN ($placeholders)";
                $deleteMessagesStmt = $this->pdo->prepare($deleteMessagesSql);
                $deleteMessagesStmt->execute($conversations);
            }

            // 3. Delete user's conversations
            $deleteConversationsSql = "DELETE FROM conversations WHERE buyer_id = :user_id1 OR seller_id = :user_id2";
            $deleteConversationsStmt = $this->pdo->prepare($deleteConversationsSql);
            $deleteConversationsStmt->execute([':user_id1' => $user_id, ':user_id2' => $user_id]);

            // 4. Delete user's reports (both made by user and about user)
            $deleteReportsSql = "DELETE FROM reports WHERE reporter_id = :user_id1 OR reported_user_id = :user_id2";
            $deleteReportsStmt = $this->pdo->prepare($deleteReportsSql);
            $deleteReportsStmt->execute([':user_id1' => $user_id, ':user_id2' => $user_id]);

            // 5. Finally delete the user
            $deleteUserSql = "DELETE FROM users WHERE id = :user_id";
            $deleteUserStmt = $this->pdo->prepare($deleteUserSql);
            $deleteUserStmt->execute([':user_id' => $user_id]);

            // Commit transaction
            $this->pdo->commit();

            return $this->sendPayload([
                "deleted_user_id" => $user_id,
                "deleted_user_name" => $user['full_name'],
                "deleted_user_email" => $user['email'],
                "deleted_by_admin" => $admin_id
            ], "success", "User and all related data deleted successfully", 200);

        } catch (\PDOException $e) {
            // Rollback transaction on error
            $this->pdo->rollback();
            return $this->sendPayload(null, "error", "Failed to delete user: " . $e->getMessage(), 500);
        }
    }

    // 🔹 Rating Methods
    public function submitRating($data) {
        $conversation_id = $data->conversation_id ?? null;
        $rated_by = $data->rated_by ?? null;
        $rated_user_id = $data->rated_user_id ?? null;
        $product_id = $data->product_id ?? null;
        $communication_rating = $data->communication_rating ?? null;
        $product_rating = $data->product_rating ?? null;
        $app_help_rating = $data->app_help_rating ?? null;
        $feedback = $data->feedback ?? null;

        // Validate required fields
        if (!$conversation_id || !$rated_by || !$rated_user_id || 
            !$communication_rating || !$product_rating || !$app_help_rating) {
            return $this->sendPayload(null, "error", "Missing required fields", 400);
        }

        // Validate rating values (1-5)
        if ($communication_rating < 1 || $communication_rating > 5 ||
            $product_rating < 1 || $product_rating > 5 ||
            $app_help_rating < 1 || $app_help_rating > 5) {
            return $this->sendPayload(null, "error", "Rating values must be between 1 and 5", 400);
        }

        // Check if user has already rated this conversation
        $checkSql = "SELECT rating_id FROM ratings 
                     WHERE conversation_id = :conversation_id AND rated_by = :rated_by";
        
        try {
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([
                'conversation_id' => $conversation_id,
                'rated_by' => $rated_by
            ]);
            
            if ($checkStmt->fetch()) {
                return $this->sendPayload(null, "error", "You have already rated this conversation", 409);
            }

            // Insert rating
            $sql = "INSERT INTO ratings (conversation_id, rated_by, rated_user_id, product_id, 
                                        communication_rating, product_rating, app_help_rating, feedback) 
                    VALUES (:conversation_id, :rated_by, :rated_user_id, :product_id, 
                            :communication_rating, :product_rating, :app_help_rating, :feedback)";

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'conversation_id' => $conversation_id,
                'rated_by' => $rated_by,
                'rated_user_id' => $rated_user_id,
                'product_id' => $product_id,
                'communication_rating' => $communication_rating,
                'product_rating' => $product_rating,
                'app_help_rating' => $app_help_rating,
                'feedback' => $feedback
            ]);

            $ratingId = $this->pdo->lastInsertId();

            return $this->sendPayload([
                "rating_id" => $ratingId,
                "conversation_id" => $conversation_id,
                "rated_user_id" => $rated_user_id,
                "communication_rating" => $communication_rating,
                "product_rating" => $product_rating,
                "app_help_rating" => $app_help_rating,
                "feedback" => $feedback
            ], "success", "Rating submitted successfully", 201);

        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    // 🔹 Conversation Management Methods
    
    /**
     * Archive a conversation for a specific user (buyer or seller)
     */
    public function archiveConversation($data) {
        $conversation_id = $data->conversation_id ?? null;
        $user_id = $data->user_id ?? null;
        
        if (!$conversation_id || !$user_id) {
            return $this->sendPayload(null, "error", "Conversation ID and User ID are required", 400);
        }
        
        try {
            // First, check if the user is part of this conversation
            $checkSql = "SELECT buyer_id, seller_id FROM conversations WHERE conversation_id = :conversation_id";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([':conversation_id' => $conversation_id]);
            $conversation = $checkStmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$conversation) {
                return $this->sendPayload(null, "error", "Conversation not found", 404);
            }
            
            // Determine if user is buyer or seller
            $field_to_update = null;
            if ($conversation['buyer_id'] == $user_id) {
                $field_to_update = 'buyer_archived';
            } elseif ($conversation['seller_id'] == $user_id) {
                $field_to_update = 'seller_archived';
            } else {
                return $this->sendPayload(null, "error", "User is not part of this conversation", 403);
            }
            
            // Update the appropriate archive field
            $sql = "UPDATE conversations SET {$field_to_update} = 1 WHERE conversation_id = :conversation_id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':conversation_id' => $conversation_id]);
            
            if ($stmt->rowCount() > 0) {
                return $this->sendPayload(
                    ["conversation_id" => $conversation_id, "archived" => true], 
                    "success", 
                    "Conversation archived successfully", 
                    200
                );
            } else {
                return $this->sendPayload(null, "error", "Failed to archive conversation", 500);
            }
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }
    
    /**
     * Restore (unarchive) a conversation for a specific user
     */
    public function restoreConversation($data) {
        $conversation_id = $data->conversation_id ?? null;
        $user_id = $data->user_id ?? null;
        
        if (!$conversation_id || !$user_id) {
            return $this->sendPayload(null, "error", "Conversation ID and User ID are required", 400);
        }
        
        try {
            // First, check if the user is part of this conversation
            $checkSql = "SELECT buyer_id, seller_id FROM conversations WHERE conversation_id = :conversation_id";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([':conversation_id' => $conversation_id]);
            $conversation = $checkStmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$conversation) {
                return $this->sendPayload(null, "error", "Conversation not found", 404);
            }
            
            // Determine if user is buyer or seller
            $field_to_update = null;
            if ($conversation['buyer_id'] == $user_id) {
                $field_to_update = 'buyer_archived';
            } elseif ($conversation['seller_id'] == $user_id) {
                $field_to_update = 'seller_archived';
            } else {
                return $this->sendPayload(null, "error", "User is not part of this conversation", 403);
            }
            
            // Update the appropriate archive field to 0 (restore)
            $sql = "UPDATE conversations SET {$field_to_update} = 0 WHERE conversation_id = :conversation_id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':conversation_id' => $conversation_id]);
            
            if ($stmt->rowCount() > 0) {
                return $this->sendPayload(
                    ["conversation_id" => $conversation_id, "restored" => true], 
                    "success", 
                    "Conversation restored successfully", 
                    200
                );
            } else {
                return $this->sendPayload(null, "error", "Failed to restore conversation", 500);
            }
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }
    
    /**
     * Delete a conversation for a specific user (soft delete)
     */
    public function deleteConversation($data) {
        $conversation_id = $data->conversation_id ?? null;
        $user_id = $data->user_id ?? null;
        
        if (!$conversation_id || !$user_id) {
            return $this->sendPayload(null, "error", "Conversation ID and User ID are required", 400);
        }
        
        try {
            // First, check if the user is part of this conversation
            $checkSql = "SELECT buyer_id, seller_id, buyer_deleted, seller_deleted FROM conversations WHERE conversation_id = :conversation_id";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([':conversation_id' => $conversation_id]);
            $conversation = $checkStmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$conversation) {
                return $this->sendPayload(null, "error", "Conversation not found", 404);
            }
            
            // Determine if user is buyer or seller
            $field_to_update = null;
            if ($conversation['buyer_id'] == $user_id) {
                $field_to_update = 'buyer_deleted';
                $other_deleted = $conversation['seller_deleted'];
            } elseif ($conversation['seller_id'] == $user_id) {
                $field_to_update = 'seller_deleted';
                $other_deleted = $conversation['buyer_deleted'];
            } else {
                return $this->sendPayload(null, "error", "User is not part of this conversation", 403);
            }
            
            // Update the appropriate delete field
            $sql = "UPDATE conversations SET {$field_to_update} = 1 WHERE conversation_id = :conversation_id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':conversation_id' => $conversation_id]);
            
            if ($stmt->rowCount() > 0) {
                // Check if both users have deleted the conversation
                $permanently_deleted = false;
                if ($other_deleted == 1) {
                    // Both users have deleted it, we can permanently delete the conversation
                    $deleteSql = "DELETE FROM conversations WHERE conversation_id = :conversation_id";
                    $deleteStmt = $this->pdo->prepare($deleteSql);
                    $deleteStmt->execute([':conversation_id' => $conversation_id]);
                    
                    // Also delete associated messages
                    $deleteMessagesSql = "DELETE FROM messages WHERE conversation_id = :conversation_id";
                    $deleteMessagesStmt = $this->pdo->prepare($deleteMessagesSql);
                    $deleteMessagesStmt->execute([':conversation_id' => $conversation_id]);
                    
                    $permanently_deleted = true;
                }
                
                return $this->sendPayload(
                    [
                        "conversation_id" => $conversation_id, 
                        "deleted" => true,
                        "permanently_deleted" => $permanently_deleted
                    ], 
                    "success", 
                    $permanently_deleted ? "Conversation permanently deleted" : "Conversation deleted successfully", 
                    200
                );
            } else {
                return $this->sendPayload(null, "error", "Failed to delete conversation", 500);
            }
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    // 🔹 Helper Methods
    // Note: saveProductSpecifications method removed - specifications are now stored as JSON in products table

    /**
     * Note: updateProductSpecifications method removed
     * Specifications are now stored as JSON in the products table
     * Use updateProduct method to update specifications along with other product data
     */

    // Note: Individual specification methods (addProductSpecification, updateSingleSpecification, deleteProductSpecification) 
    // have been removed as specifications are now stored as JSON in the products table.
    // Use addProduct and updateProduct methods to manage specifications.

    private function isValidJson($string) {
        if (!is_string($string)) {
            return false;
        }
        json_decode($string);
        return json_last_error() === JSON_ERROR_NONE;
    }

    /**
     * Mark a user notification as read
     */
    public function markUserNotificationAsRead($data) {
        $notification_id = $data->notification_id ?? null;

        if (!$notification_id) {
            return $this->sendPayload(null, "error", "Notification ID is required", 400);
        }

        try {
            $sql = "UPDATE user_notifications 
                    SET is_read = 1, read_at = NOW() 
                    WHERE notification_id = :notification_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['notification_id' => $notification_id]);

            return $this->sendPayload(
                ['notification_id' => $notification_id], 
                "success", 
                "Notification marked as read", 
                200
            );
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    /**
     * Mark all user notifications as read
     */
    public function markAllUserNotificationsAsRead($data) {
        $user_id = $data->user_id ?? null;

        if (!$user_id) {
            return $this->sendPayload(null, "error", "User ID is required", 400);
        }

        try {
            $sql = "UPDATE user_notifications 
                    SET is_read = 1, read_at = NOW() 
                    WHERE user_id = :user_id AND is_read = 0";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['user_id' => $user_id]);
            
            $count = $stmt->rowCount();

            return $this->sendPayload(
                ['user_id' => $user_id, 'count' => $count], 
                "success", 
                "All notifications marked as read", 
                200
            );
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    /**
     * Delete a user notification
     */
    public function deleteUserNotification($data) {
        $notification_id = $data->notification_id ?? null;

        if (!$notification_id) {
            return $this->sendPayload(null, "error", "Notification ID is required", 400);
        }

        try {
            $sql = "DELETE FROM user_notifications WHERE notification_id = :notification_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['notification_id' => $notification_id]);

            return $this->sendPayload(
                ['notification_id' => $notification_id], 
                "success", 
                "Notification deleted successfully", 
                200
            );
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    /**
     * Mark user violation - Admin action to penalize users
     * 
     * @param object $data - Contains user_id, level, reason
     * @return array - Response with violation data
     */
    public function markUserViolation($data) {
        $user_id = $data->user_id ?? null;
        $action = strtolower(trim((string)($data->action ?? 'mark')));
        $level = $data->level ?? null;
        $reason = $data->reason ?? null;

        if (!$user_id) {
            return $this->sendPayload(null, "error", "User ID is required", 400);
        }

        // Special action: remove active restriction and restore account to active.
        if ($action === 'unrestrict') {
            if (!$reason || strlen(trim($reason)) < 5) {
                return $this->sendPayload(null, "error", "A reason (at least 5 characters) is required to unrestrict a user", 400);
            }

            try {
                $this->pdo->beginTransaction();

                $checkUser = $this->pdo->prepare("SELECT id, full_name, email, violation_count, account_status FROM users WHERE id = :user_id");
                $checkUser->execute(['user_id' => $user_id]);
                $user = $checkUser->fetch(\PDO::FETCH_ASSOC);

                if (!$user) {
                    $this->pdo->rollBack();
                    return $this->sendPayload(null, "error", "User not found", 404);
                }

                $normalizedStatus = strtolower(trim((string)($user['account_status'] ?? '')));
                if (!in_array($normalizedStatus, ['restricted', 'suspended'], true)) {
                    $this->pdo->rollBack();
                    return $this->sendPayload(null, "error", "Only restricted or suspended users can be unrestricted using this action", 400);
                }

                $updateUser = $this->pdo->prepare("\n                    UPDATE users\n                    SET account_status = 'active', updated_at = NOW()\n                    WHERE id = :user_id\n                ");
                $updateUser->execute(['user_id' => $user_id]);

                $deactivateRestrictions = $this->pdo->prepare("\n                    UPDATE user_restrictions\n                    SET is_active = FALSE\n                    WHERE user_id = :user_id AND is_active = TRUE\n                ");
                $deactivateRestrictions->execute(['user_id' => $user_id]);

                $insertNotification = $this->pdo->prepare("\n                    INSERT INTO user_notifications\n                    (user_id, type, title, message, reference_id, is_read, created_at)\n                    VALUES\n                    (:user_id, 'Violation', :title, :message, NULL, 0, NOW())\n                ");
                $insertNotification->execute([
                    'user_id' => $user_id,
                    'title' => '✅ Account Access Restored',
                    'message' => "Your account restriction/suspension has been lifted by CycleMart admin.\n\nReason: " . trim($reason) . "\n\nYour account access is now restored. Please continue following community guidelines."
                ]);

                $notification_id = $this->pdo->lastInsertId();

                $this->pdo->commit();

                return $this->sendPayload([
                    'user_id' => $user_id,
                    'violation_count' => (int)$user['violation_count'],
                    'account_status' => 'active',
                    'notification_id' => $notification_id,
                    'user_name' => $user['full_name'],
                    'user_email' => $user['email']
                ], "success", "User has been unrestricted successfully.", 200);
            } catch (\PDOException $e) {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
            }
        }

        // Validation
        if (!$level || !$reason) {
            return $this->sendPayload(null, "error", "User ID, violation level, and reason are required", 400);
        }

        if (!in_array($level, [1, 2, 3, 4])) {
            return $this->sendPayload(null, "error", "Invalid violation level. Must be 1, 2, 3, or 4", 400);
        }

        if (strlen(trim($reason)) < 10) {
            return $this->sendPayload(null, "error", "Reason must be at least 10 characters long", 400);
        }

        try {
            // Begin transaction
            $this->pdo->beginTransaction();

            // Check if user exists
            $checkUser = $this->pdo->prepare("SELECT id, full_name, email, violation_count, account_status FROM users WHERE id = :user_id");
            $checkUser->execute(['user_id' => $user_id]);
            $user = $checkUser->fetch(\PDO::FETCH_ASSOC);

            if (!$user) {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "User not found", 404);
            }

            // Determine new account status based on violation level
            $account_status = match($level) {
                1 => 'active',
                2 => 'restricted',
                3 => 'suspended',
                4 => 'banned',
                default => 'active'
            };

            // Increment violation count
            $new_violation_count = $user['violation_count'] + 1;

            // Update user's violation_count and account_status
            $updateUser = $this->pdo->prepare("
                UPDATE users 
                SET violation_count = :violation_count, 
                    account_status = :account_status,
                    updated_at = NOW()
                WHERE id = :user_id
            ");
            
            $updateUser->execute([
                'violation_count' => $new_violation_count,
                'account_status' => $account_status,
                'user_id' => $user_id
            ]);

            // Determine notification title and message based on level
            $notification_data = match($level) {
                1 => [
                    'title' => '⚠️ Account Warning',
                    'message' => "You have received a warning for violating CycleMart's community guidelines.\n\nReason: {$reason}\n\nThis is your first violation. Please review our terms of service to avoid further penalties."
                ],
                2 => [
                    'title' => '🔒 Account Restricted',
                    'message' => "Your account has been restricted due to a second violation of CycleMart's community guidelines.\n\nReason: {$reason}\n\nYour account now has limited access. Continued violations may result in suspension."
                ],
                3 => [
                    'title' => '🚫 Account Suspended',
                    'message' => "Your account has been suspended due to multiple violations of CycleMart's community guidelines.\n\nReason: {$reason}\n\nYour account access is temporarily suspended. This is your final warning before permanent ban."
                ],
                4 => [
                    'title' => '❌ Account Permanently Banned',
                    'message' => "Your account has been permanently banned due to repeated violations of CycleMart's community guidelines.\n\nReason: {$reason}\n\nYou will no longer have access to CycleMart. This decision is final."
                ],
                default => [
                    'title' => 'Account Violation',
                    'message' => "Your account has received a violation notice.\n\nReason: {$reason}"
                ]
            };

            // Insert user notification
            $insertNotification = $this->pdo->prepare("
                INSERT INTO user_notifications 
                (user_id, type, title, message, reference_id, is_read, created_at) 
                VALUES 
                (:user_id, 'Violation', :title, :message, NULL, 0, NOW())
            ");

            $insertNotification->execute([
                'user_id' => $user_id,
                'title' => $notification_data['title'],
                'message' => $notification_data['message']
            ]);

            $notification_id = $this->pdo->lastInsertId();

            // Commit transaction
            $this->pdo->commit();

            // Return success response
            return $this->sendPayload([
                'user_id' => $user_id,
                'violation_level' => $level,
                'violation_count' => $new_violation_count,
                'account_status' => $account_status,
                'notification_id' => $notification_id,
                'user_name' => $user['full_name'],
                'user_email' => $user['email']
            ], "success", "Violation marked successfully. User has been notified.", 200);

        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    /**
     * Helper method to emit Socket.IO events
     * This method sends HTTP requests to the Socket.IO server to emit events
     */
    private function emitSocketEvent($room, $event, $data) {
        try {
            $socketServerUrl = 'https://cyclemart-socket.onrender.com';
            
            $payload = json_encode([
                'room' => $room,
                'event' => $event,
                'data' => $data
            ]);
            
            error_log("🔴 Emitting socket event: " . $event . " to room: " . $room);
            
            // Use cURL to send the event to Socket.IO server
            $ch = curl_init($socketServerUrl);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 5 second timeout
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            
            if (curl_errno($ch)) {
                error_log("❌ Socket emit error: " . curl_error($ch));
            } else if ($httpCode === 200) {
                error_log("✅ Socket event emitted successfully");
            } else {
                error_log("⚠️ Socket emit returned HTTP " . $httpCode);
            }
            
            curl_close($ch);
            
        } catch (\Exception $e) {
            error_log("❌ Exception in emitSocketEvent: " . $e->getMessage());
        }
    }

    /**
     * Approve a product listing
     */
    public function approveProduct($data) {
        $product_id = $data->product_id ?? null;
        $admin_id = $data->admin_id ?? null;
        $admin_role = $data->admin_role ?? null;

        if (!$product_id || !$admin_id || !$admin_role) {
            return $this->sendPayload(null, "error", "Missing required fields", 400);
        }

        // Check admin permissions
        if (!in_array($admin_role, ['super admin', 'moderator', 'admin'])) {
            return $this->sendPayload(null, "error", "Unauthorized access", 403);
        }

        try {
            $sql = "UPDATE products 
                    SET approval_status = 'approved', 
                        approved_by = :admin_id, 
                        approval_date = NOW(),
                        status = 'active'
                    WHERE product_id = :product_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':admin_id' => $admin_id,
                ':product_id' => $product_id
            ]);

            if ($stmt->rowCount() > 0) {
                // Get product and seller info for notification
                $productSql = "SELECT product_name, uploader_id FROM products WHERE product_id = :product_id";
                $productStmt = $this->pdo->prepare($productSql);
                $productStmt->execute([':product_id' => $product_id]);
                $product = $productStmt->fetch(\PDO::FETCH_ASSOC);

                // Get admin name
                $adminSql = "SELECT full_name FROM admins WHERE admin_id = :admin_id";
                $adminStmt = $this->pdo->prepare($adminSql);
                $adminStmt->execute([':admin_id' => $admin_id]);
                $admin = $adminStmt->fetch(\PDO::FETCH_ASSOC);
                $adminName = $admin ? $admin['full_name'] : 'Admin';

                if ($product) {
                    $this->createUserNotification(
                        $product['uploader_id'],
                        'listing approved',
                        'Listing Approved',
                        "Your listing '{$product['product_name']}' has been approved by {$adminName} and is now live!",
                        $product_id
                    );
                }

                return $this->sendPayload([
                    "message" => "Product approved successfully"
                ], "success", "Product approved successfully", 200);
            } else {
                return $this->sendPayload(null, "error", "Product not found", 404);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Reject a product listing with violation tracking
     */
    public function rejectProduct($data) {
        $product_id = $data->product_id ?? null;
        $admin_id = $data->admin_id ?? null;
        $admin_role = $data->admin_role ?? null;
        $rejection_reason = $data->rejection_reason ?? null;
        $violation_code = $data->violation_code ?? 'other'; // New parameter for violation type

        if (!$product_id || !$admin_id || !$admin_role || !$rejection_reason) {
            return $this->sendPayload(null, "error", "Missing required fields", 400);
        }

        if (!in_array($admin_role, ['super admin', 'moderator', 'admin'])) {
            return $this->sendPayload(null, "error", "Unauthorized access", 403);
        }

        try {
            // Start transaction
            $this->pdo->beginTransaction();

            $sql = "UPDATE products 
                    SET approval_status = 'rejected', 
                        approved_by = :admin_id, 
                        approval_date = NOW(),
                        rejection_reason = :rejection_reason,
                        status = 'inactive'
                    WHERE product_id = :product_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':admin_id' => $admin_id,
                ':product_id' => $product_id,
                ':rejection_reason' => $rejection_reason
            ]);

            if ($stmt->rowCount() > 0) {
                // Get product and seller info for notification
                $productSql = "SELECT product_name, uploader_id FROM products WHERE product_id = :product_id";
                $productStmt = $this->pdo->prepare($productSql);
                $productStmt->execute([':product_id' => $product_id]);
                $product = $productStmt->fetch(\PDO::FETCH_ASSOC);

                if ($product) {
                    // Track violation and check for progressive discipline
                    $violationResult = $this->trackViolation(
                        $product['uploader_id'],
                        $violation_code,
                        $product_id,
                        $rejection_reason,
                        $admin_id
                    );

                    // Get admin name
                    $adminSql = "SELECT full_name FROM admins WHERE admin_id = :admin_id";
                    $adminStmt = $this->pdo->prepare($adminSql);
                    $adminStmt->execute([':admin_id' => $admin_id]);
                    $admin = $adminStmt->fetch(\PDO::FETCH_ASSOC);
                    $adminName = $admin ? $admin['full_name'] : 'Admin';
                    $violationLabel = $this->getViolationLabel($violation_code);

                    // Create notification with violation info
                    $notificationMessage = "Your listing '{$product['product_name']}' was rejected by {$adminName}.";
                    $notificationMessage .= "\n\n🚫 Violation Type: {$violationLabel}";
                    $notificationMessage .= "\n\nReason: {$rejection_reason}";
                    
                    if ($violationResult['is_restricted']) {
                        $notificationMessage .= "\n\n⚠️ WARNING: You have violated our policies {$violationResult['violation_count']} times for '{$violationLabel}'. ";
                        $notificationMessage .= "You are now restricted from creating new listings until {$violationResult['restriction_until']}. ";
                        $notificationMessage .= "Please review our listing guidelines before posting again.";
                    } elseif ($violationResult['violation_count'] > 1) {
                        $notificationMessage .= "\n\n⚠️ This is your {$violationResult['violation_count']} warning for '{$violationLabel}'. ";
                        $notificationMessage .= "One more violation of this type may result in a 48-hour listing restriction.";
                    }

                    $this->createUserNotification(
                        $product['uploader_id'],
                        'listing_rejected',
                        'Listing Rejected',
                        $notificationMessage,
                        $product_id
                    );
                }

                $this->pdo->commit();

                return $this->sendPayload([
                    "message" => "Product rejected successfully",
                    "violation_tracked" => true
                ], "success", "Product rejected successfully", 200);
            } else {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Product not found", 404);
            }
        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Get human-readable label for violation code
     */
    private function getViolationLabel($violation_code) {
        $labels = [
            'not_bike_related' => 'Not Bicycle Related',
            'prohibited_item' => 'Prohibited Item',
            'spam' => 'Spam/Duplicates',
            'fraud' => 'Fraudulent Content',
            'inappropriate_content' => 'Inappropriate Content',
            'misleading_info' => 'Misleading Information',
            'price_manipulation' => 'Price Manipulation',
            'other' => 'Policy Violation'
        ];
        
        return $labels[$violation_code] ?? 'Policy Violation';
    }

    /**
     * Track user violation and apply progressive discipline
     * Returns: ['violation_count' => int, 'is_restricted' => bool, 'restriction_until' => datetime|null]
     */
    private function trackViolation($user_id, $violation_code, $product_id, $rejection_reason, $admin_id) {
        try {
            // Log the violation tracking attempt
            error_log("Tracking violation: user_id=$user_id, violation_code=$violation_code, product_id=$product_id");
            
            // Check if violation record exists for this user and violation type
            $checkSql = "SELECT violation_id, violation_count, violation_level 
                        FROM user_violations 
                        WHERE user_id = :user_id 
                        AND violation_code = :violation_code 
                        AND status = 'active'";
            
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([
                ':user_id' => $user_id,
                ':violation_code' => $violation_code
            ]);
            
            $existingViolation = $checkStmt->fetch(\PDO::FETCH_ASSOC);
            
            $newCount = 1;
            $newLevel = 1;
            $restrictionUntil = null;
            $isRestricted = false;
            
            if ($existingViolation) {
                // Increment violation count
                $newCount = $existingViolation['violation_count'] + 1;
                error_log("Existing violation found. New count: $newCount");
                
                // Determine new violation level and restriction
                // ⚠️ IMPORTANT: Check in descending order (7, 5, 3) to apply correct level
                if ($newCount >= 7) {
                    // 7th violation = permanent ban
                    $newLevel = 4;
                    $restrictionUntil = null; // Permanent
                    $isRestricted = true;
                    error_log("Level 4 (Permanent Ban) applied");
                } elseif ($newCount >= 5) {
                    // 5th violation = 7-day suspension
                    $newLevel = 3;
                    $restrictionUntil = date('Y-m-d H:i:s', strtotime('+7 days'));
                    $isRestricted = true;
                    error_log("Level 3 (7-day suspension) applied. Restriction until: $restrictionUntil");
                } elseif ($newCount >= 3) {
                    // 3rd violation = 48-hour restriction
                    $newLevel = 2;
                    $restrictionUntil = date('Y-m-d H:i:s', strtotime('+48 hours'));
                    $isRestricted = true;
                    error_log("Level 2 (48-hour restriction) applied. Restriction until: $restrictionUntil");
                } else {
                    error_log("No restriction applied yet (count: $newCount)");
                }
                
                // Update existing violation
                $updateSql = "UPDATE user_violations 
                            SET violation_count = :count,
                                violation_level = :level,
                                last_violation_at = NOW(),
                                related_product_id = :product_id,
                                rejection_reason = :reason,
                                admin_id = :admin_id,
                                restriction_until = :restriction_until
                            WHERE violation_id = :violation_id";
                
                $updateStmt = $this->pdo->prepare($updateSql);
                $updateStmt->execute([
                    ':count' => $newCount,
                    ':level' => $newLevel,
                    ':product_id' => $product_id,
                    ':reason' => $rejection_reason,
                    ':admin_id' => $admin_id,
                    ':restriction_until' => $restrictionUntil,
                    ':violation_id' => $existingViolation['violation_id']
                ]);
                
            } else {
                // Create new violation record
                $insertSql = "INSERT INTO user_violations 
                            (user_id, violation_code, violation_level, source, 
                             related_product_id, rejection_reason, admin_id, violation_count, 
                             created_at, last_violation_at)
                            VALUES 
                            (:user_id, :violation_code, 1, 'manual', 
                             :product_id, :reason, :admin_id, 1, 
                             NOW(), NOW())";
                
                $insertStmt = $this->pdo->prepare($insertSql);
                $insertStmt->execute([
                    ':user_id' => $user_id,
                    ':violation_code' => $violation_code,
                    ':product_id' => $product_id,
                    ':reason' => $rejection_reason,
                    ':admin_id' => $admin_id
                ]);
            }
            
            // If restricted, create restriction record (including permanent bans)
            if ($isRestricted) {
                // Determine restriction type based on level
                $restrictionType = $newLevel >= 4 ? 'permanent_ban' : ($newLevel >= 3 ? 'account_suspension' : 'listing_ban');
                
                error_log("Creating restriction: type=$restrictionType, expires=$restrictionUntil");
                
                $this->createUserRestriction($user_id, $existingViolation['violation_id'] ?? $this->pdo->lastInsertId(), 
                                           $restrictionType, $rejection_reason, $restrictionUntil, $admin_id);
            }
            
            error_log("Violation tracking completed. Count: $newCount, Restricted: " . ($isRestricted ? 'YES' : 'NO'));
            
            return [
                'violation_count' => $newCount,
                'is_restricted' => $isRestricted,
                'restriction_until' => $restrictionUntil,
                'violation_level' => $newLevel
            ];
            
        } catch (\PDOException $e) {
            error_log("Failed to track violation: " . $e->getMessage());
            return [
                'violation_count' => 1,
                'is_restricted' => false,
                'restriction_until' => null,
                'violation_level' => 1
            ];
        }
    }

    /**
     * Create user restriction record
     */
    private function createUserRestriction($user_id, $violation_id, $restriction_type, $reason, $expires_at, $admin_id) {
        try {
            // Deactivate previous restrictions of same type
            $deactivateSql = "UPDATE user_restrictions 
                            SET is_active = FALSE 
                            WHERE user_id = :user_id 
                            AND restriction_type = :type 
                            AND is_active = TRUE";
            
            $deactivateStmt = $this->pdo->prepare($deactivateSql);
            $deactivateStmt->execute([
                ':user_id' => $user_id,
                ':type' => $restriction_type
            ]);
            
            // Create new restriction
            $insertSql = "INSERT INTO user_restrictions 
                        (user_id, violation_id, restriction_type, reason, starts_at, expires_at, is_active, created_by)
                        VALUES 
                        (:user_id, :violation_id, :type, :reason, NOW(), :expires_at, TRUE, :admin_id)";
            
            $insertStmt = $this->pdo->prepare($insertSql);
            $insertStmt->execute([
                ':user_id' => $user_id,
                ':violation_id' => $violation_id,
                ':type' => $restriction_type,
                ':reason' => $reason,
                ':expires_at' => $expires_at,
                ':admin_id' => $admin_id
            ]);
            
        } catch (\PDOException $e) {
            error_log("Failed to create user restriction: " . $e->getMessage());
        }
    }

    /**
     * Check if user is currently restricted from creating listings
     * Returns: ['is_restricted' => bool, 'reason' => string, 'expires_at' => datetime|null]
     */
    public function checkUserRestriction($user_id) {
        try {
            error_log("Checking user restriction for user_id=$user_id");

            $userSql = "SELECT account_status, violation_count FROM users WHERE id = :user_id LIMIT 1";
            $userStmt = $this->pdo->prepare($userSql);
            $userStmt->execute([':user_id' => $user_id]);
            $user = $userStmt->fetch(\PDO::FETCH_ASSOC);

            // Auto-deactivate expired restrictions so status can be restored automatically.
            $expireSql = "UPDATE user_restrictions
                          SET is_active = FALSE
                          WHERE user_id = :user_id
                          AND is_active = TRUE
                          AND expires_at IS NOT NULL
                          AND expires_at <= NOW()";
            $expireStmt = $this->pdo->prepare($expireSql);
            $expireStmt->execute([':user_id' => $user_id]);
                    $expiredCount = $expireStmt->rowCount();
            
                $sql = "SELECT ur.restriction_type, ur.reason, ur.starts_at, ur.expires_at, uv.violation_code, uv.violation_count
                    FROM user_restrictions ur
                    JOIN user_violations uv ON ur.violation_id = uv.violation_id
                    WHERE ur.user_id = :user_id 
                    AND ur.is_active = TRUE 
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                    ORDER BY ur.created_at DESC
                    LIMIT 1";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':user_id' => $user_id]);
            
            $restriction = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if ($restriction) {
                error_log("Active restriction found! Type: {$restriction['restriction_type']}, Expires: " . ($restriction['expires_at'] ?? 'NEVER'));

                $restrictionType = strtolower($restriction['restriction_type'] ?? '');
                $resolvedExpiry = $restriction['expires_at'] ?? null;
                if (!$resolvedExpiry && !empty($restriction['starts_at']) && (strpos($restrictionType, 'temporary') !== false || $restrictionType === 'listing_ban')) {
                    $resolvedExpiry = date('Y-m-d H:i:s', strtotime($restriction['starts_at'] . ' +48 hours'));
                }
                
                return [
                    'is_restricted' => true,
                    'restriction_type' => $restriction['restriction_type'],
                    'reason' => $restriction['reason'],
                    'starts_at' => $restriction['starts_at'] ?? null,
                    'expires_at' => $resolvedExpiry,
                    'violation_code' => $restriction['violation_code'],
                    'violation_count' => $restriction['violation_count']
                ];
            }

            // Respect explicit account restriction status when no active restriction row is found.
            if ($user && $user['account_status'] === 'restricted') {
                $latestRestrictionSql = "SELECT ur.restriction_type, ur.reason, ur.starts_at, ur.expires_at, uv.violation_code, uv.violation_count
                                         FROM user_restrictions ur
                                         LEFT JOIN user_violations uv ON ur.violation_id = uv.violation_id
                                         WHERE ur.user_id = :user_id
                                         ORDER BY ur.created_at DESC
                                         LIMIT 1";
                $latestRestrictionStmt = $this->pdo->prepare($latestRestrictionSql);
                $latestRestrictionStmt->execute([':user_id' => $user_id]);
                $latestRestriction = $latestRestrictionStmt->fetch(\PDO::FETCH_ASSOC);

                $latestType = strtolower($latestRestriction['restriction_type'] ?? '');
                $latestExpiry = $latestRestriction['expires_at'] ?? null;
                if (!$latestExpiry && !empty($latestRestriction['starts_at']) && (strpos($latestType, 'temporary') !== false || $latestType === 'listing_ban')) {
                    $latestExpiry = date('Y-m-d H:i:s', strtotime($latestRestriction['starts_at'] . ' +48 hours'));
                }

                return [
                    'is_restricted' => true,
                    'restriction_type' => $latestRestriction['restriction_type'] ?? 'temporary_restriction',
                    'reason' => $latestRestriction['reason'] ?? 'Your account is currently restricted from creating new listings.',
                    'starts_at' => $latestRestriction['starts_at'] ?? null,
                    'expires_at' => $latestExpiry,
                    'violation_code' => $latestRestriction['violation_code'] ?? 'other',
                    'violation_count' => $latestRestriction['violation_count'] ?? ($user['violation_count'] ?? 0)
                ];
            }

            // If this check deactivated expired restrictions and user is still marked restricted, restore to active.
            if ($expiredCount > 0 && $user && $user['account_status'] === 'restricted') {
                $restoreSql = "UPDATE users
                               SET account_status = 'active', updated_at = NOW()
                               WHERE id = :user_id
                               AND account_status = 'restricted'";
                $restoreStmt = $this->pdo->prepare($restoreSql);
                $restoreStmt->execute([':user_id' => $user_id]);
            }
            
            error_log("No active restriction found for user_id=$user_id");
            return ['is_restricted' => false];
            
        } catch (\PDOException $e) {
            error_log("Failed to check user restriction: " . $e->getMessage());
            return ['is_restricted' => false];
        }
    }

    /**
     * Create user notification helper
     */
    private function createUserNotification($user_id, $type, $title, $message, $reference_id = null) {
        try {
            $sql = "INSERT INTO user_notifications (user_id, type, title, message, reference_id, created_at)
                    VALUES (:user_id, :type, :title, :message, :reference_id, NOW())";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':user_id' => $user_id,
                ':type' => $type,
                ':title' => $title,
                ':message' => $message,
                ':reference_id' => $reference_id
            ]);
        } catch (\PDOException $e) {
            error_log("Failed to create user notification: " . $e->getMessage());
        }
    }

    /**
     * ================================================================================================
     * RESERVATION SYSTEM METHODS
     * ================================================================================================
     */

    /**
     * Reserve a product with specified duration
     * Maximum reservation: 72 hours (enforced as 48 hours per business rules)
     */
    public function reserveProduct($data) {
        try {
            $product_id = $data->product_id ?? null;
            $buyer_id = $data->buyer_id ?? null;
            $seller_id = $data->seller_id ?? null;
            $duration_hours = $data->duration_hours ?? 24;

            // Validation
            if (!$product_id || !$buyer_id || !$seller_id) {
                return $this->sendPayload(null, "error", "Missing required fields", 400);
            }

            // Enforce maximum reservation limit (48 hours as per requirements)
            if ($duration_hours > 72) {
                return $this->sendPayload(null, "error", "Maximum reservation duration is 72 hours", 400);
            }

            // Validate allowed durations (24, 48, 72 hours)
            if (!in_array($duration_hours, [24, 48, 72])) {
                return $this->sendPayload(null, "error", "Invalid reservation duration. Allowed: 24, 48, or 72 hours", 400);
            }

            $this->pdo->beginTransaction();

            // Check if product exists and is available
            $checkSql = "SELECT product_id, product_name, uploader_id, sale_status 
                        FROM products 
                        WHERE product_id = :product_id";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([':product_id' => $product_id]);
            $product = $checkStmt->fetch(\PDO::FETCH_ASSOC);

            if (!$product) {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Product not found", 404);
            }

            if ($product['sale_status'] !== 'available') {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Product is not available for reservation", 400);
            }

            // Verify seller owns the product
            if ($product['uploader_id'] != $seller_id) {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Only the seller can reserve this product", 403);
            }

            // Calculate reservation expiry
            $reserved_at = date('Y-m-d H:i:s');
            $reserved_until = date('Y-m-d H:i:s', strtotime("+{$duration_hours} hours"));

            // Update product status to reserved
            $updateSql = "UPDATE products 
                         SET sale_status = 'reserved',
                             reserved_by = :reserved_by,
                             reserved_until = :reserved_until,
                             reserved_at = :reserved_at,
                             reservation_duration_hours = :duration_hours
                         WHERE product_id = :product_id";
            
            $updateStmt = $this->pdo->prepare($updateSql);
            $updateStmt->execute([
                ':reserved_by' => $buyer_id,
                ':reserved_until' => $reserved_until,
                ':reserved_at' => $reserved_at,
                ':duration_hours' => $duration_hours,
                ':product_id' => $product_id
            ]);

            // Create reservation history record
            $historySql = "INSERT INTO reservation_history 
                          (product_id, reserved_by, seller_id, reserved_at, reserved_until, duration_hours, status)
                          VALUES (:product_id, :reserved_by, :seller_id, :reserved_at, :reserved_until, :duration_hours, 'active')";
            
            $historyStmt = $this->pdo->prepare($historySql);
            $historyStmt->execute([
                ':product_id' => $product_id,
                ':reserved_by' => $buyer_id,
                ':seller_id' => $seller_id,
                ':reserved_at' => $reserved_at,
                ':reserved_until' => $reserved_until,
                ':duration_hours' => $duration_hours
            ]);

            // Send notification to buyer
            $this->createUserNotification(
                $buyer_id,
                'Product Reserved',
                'Reservation Confirmed',
                "Your reservation for '{$product['product_name']}' has been confirmed for {$duration_hours} hours.",
                $product_id
            );

            // Send notification to seller
            $this->createUserNotification(
                $seller_id,
                'Product Reserved',
                'Product Reserved',
                "'{$product['product_name']}' has been reserved for {$duration_hours} hours.",
                $product_id
            );

            $this->pdo->commit();

            return $this->sendPayload([
                'product_id' => $product_id,
                'reserved_by' => $buyer_id,
                'reserved_until' => $reserved_until,
                'duration_hours' => $duration_hours
            ], "success", "Product reserved successfully", 200);

        } catch (\PDOException $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            error_log("Reserve product error: " . $e->getMessage());
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Cancel a reservation
     */
    public function cancelReservation($data) {
        try {
            $product_id = $data->product_id ?? null;
            $user_id = $data->user_id ?? null;
            $cancellation_reason = $data->reason ?? 'User cancelled';

            if (!$product_id || !$user_id) {
                return $this->sendPayload(null, "error", "Missing required fields", 400);
            }

            $this->pdo->beginTransaction();

            // Get product and reservation details
            $checkSql = "SELECT product_id, product_name, uploader_id, sale_status, reserved_by 
                        FROM products 
                        WHERE product_id = :product_id";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([':product_id' => $product_id]);
            $product = $checkStmt->fetch(\PDO::FETCH_ASSOC);

            if (!$product) {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Product not found", 404);
            }

            if ($product['sale_status'] !== 'reserved') {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "Product is not reserved", 400);
            }

            // Check if user has permission (seller or buyer)
            if ($product['uploader_id'] != $user_id && $product['reserved_by'] != $user_id) {
                $this->pdo->rollBack();
                return $this->sendPayload(null, "error", "You don't have permission to cancel this reservation", 403);
            }

            // Update product status back to available
            $updateSql = "UPDATE products 
                         SET sale_status = 'available',
                             reserved_by = NULL,
                             reserved_until = NULL,
                             reserved_at = NULL,
                             reservation_duration_hours = NULL
                         WHERE product_id = :product_id";
            
            $updateStmt = $this->pdo->prepare($updateSql);
            $updateStmt->execute([':product_id' => $product_id]);

            // Update reservation history
            $historyUpdateSql = "UPDATE reservation_history 
                                SET status = 'cancelled',
                                    cancelled_at = NOW(),
                                    cancellation_reason = :reason
                                WHERE product_id = :product_id 
                                AND status = 'active'";
            
            $historyStmt = $this->pdo->prepare($historyUpdateSql);
            $historyStmt->execute([
                ':reason' => $cancellation_reason,
                ':product_id' => $product_id
            ]);

            // Send notifications
            $seller_id = $product['uploader_id'];
            $buyer_id = $product['reserved_by'];

            if ($buyer_id) {
                $this->createUserNotification(
                    $buyer_id,
                    'Reservation Cancelled',
                    'Reservation Cancelled',
                    "The reservation for '{$product['product_name']}' has been cancelled.",
                    $product_id
                );
            }

            if ($seller_id && $seller_id != $user_id) {
                $this->createUserNotification(
                    $seller_id,
                    'Reservation Cancelled',
                    'Reservation Cancelled',
                    "The reservation for '{$product['product_name']}' has been cancelled.",
                    $product_id
                );
            }

            $this->pdo->commit();

            return $this->sendPayload([
                'product_id' => $product_id,
                'status' => 'available'
            ], "success", "Reservation cancelled successfully", 200);

        } catch (\PDOException $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            error_log("Cancel reservation error: " . $e->getMessage());
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Check and expire reservations that have passed their reserved_until time
     * Called when listing page loads or via cron job
     */
    public function checkExpiredReservations() {
        try {
            $this->pdo->beginTransaction();

            // Find all expired reservations
            $findExpiredSql = "SELECT p.product_id, p.product_name, p.uploader_id, p.reserved_by, p.reserved_until
                              FROM products p
                              WHERE p.sale_status = 'reserved'
                              AND p.reserved_until IS NOT NULL
                              AND p.reserved_until < NOW()";
            
            $findStmt = $this->pdo->prepare($findExpiredSql);
            $findStmt->execute();
            $expiredProducts = $findStmt->fetchAll(\PDO::FETCH_ASSOC);

            $expiredCount = count($expiredProducts);

            if ($expiredCount === 0) {
                $this->pdo->commit();
                return $this->sendPayload([
                    'expired_count' => 0,
                    'message' => 'No expired reservations found'
                ], "success", "Check completed", 200);
            }

            // Update each expired product
            foreach ($expiredProducts as $product) {
                // Update product status back to available
                $updateSql = "UPDATE products 
                             SET sale_status = 'available',
                                 reserved_by = NULL,
                                 reserved_until = NULL,
                                 reserved_at = NULL,
                                 reservation_duration_hours = NULL
                             WHERE product_id = :product_id";
                
                $updateStmt = $this->pdo->prepare($updateSql);
                $updateStmt->execute([':product_id' => $product['product_id']]);

                // Update reservation history
                $historyUpdateSql = "UPDATE reservation_history 
                                    SET status = 'expired',
                                        expired_at = NOW()
                                    WHERE product_id = :product_id 
                                    AND status = 'active'";
                
                $historyStmt = $this->pdo->prepare($historyUpdateSql);
                $historyStmt->execute([':product_id' => $product['product_id']]);

                // Send notification to seller
                if ($product['uploader_id']) {
                    $this->createUserNotification(
                        $product['uploader_id'],
                        'Reservation Expired',
                        'Reservation Expired',
                        "The reservation for '{$product['product_name']}' has expired. The item is now available again.",
                        $product['product_id']
                    );
                }

                // Send notification to buyer
                if ($product['reserved_by']) {
                    $this->createUserNotification(
                        $product['reserved_by'],
                        'Reservation Expired',
                        'Reservation Expired',
                        "The reservation period for '{$product['product_name']}' has expired and the item is now available.",
                        $product['product_id']
                    );
                }
            }

            $this->pdo->commit();

            return $this->sendPayload([
                'expired_count' => $expiredCount,
                'products' => $expiredProducts
            ], "success", "{$expiredCount} reservation(s) expired and updated", 200);

        } catch (\PDOException $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            error_log("Check expired reservations error: " . $e->getMessage());
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Get reservation details for a product
     */
    public function getReservationDetails($data) {
        try {
            $product_id = $data->product_id ?? null;

            if (!$product_id) {
                return $this->sendPayload(null, "error", "Product ID required", 400);
            }

            $sql = "SELECT p.product_id, p.product_name, p.sale_status, 
                           p.reserved_by, p.reserved_until, p.reserved_at, 
                           p.reservation_duration_hours,
                           u.full_name as buyer_name, u.email as buyer_email,
                           s.full_name as seller_name, s.email as seller_email
                    FROM products p
                    LEFT JOIN users u ON p.reserved_by = u.id
                    LEFT JOIN users s ON p.uploader_id = s.id
                    WHERE p.product_id = :product_id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':product_id' => $product_id]);
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$result) {
                return $this->sendPayload(null, "error", "Product not found", 404);
            }

            // Calculate remaining time if reserved
            if ($result['sale_status'] === 'reserved' && $result['reserved_until']) {
                $now = new \DateTime();
                $until = new \DateTime($result['reserved_until']);
                $diff = $now->diff($until);
                
                if ($now < $until) {
                    $result['time_remaining'] = [
                        'hours' => $diff->h + ($diff->days * 24),
                        'minutes' => $diff->i,
                        'seconds' => $diff->s,
                        'formatted' => $diff->format('%H hours %I minutes')
                    ];
                    $result['is_expired'] = false;
                } else {
                    $result['time_remaining'] = null;
                    $result['is_expired'] = true;
                }
            }

            return $this->sendPayload($result, "success", "Reservation details retrieved", 200);

        } catch (\PDOException $e) {
            error_log("Get reservation details error: " . $e->getMessage());
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Get reservation history for a product or user
     */
    public function getReservationHistory($data) {
        try {
            $product_id = $data->product_id ?? null;
            $user_id = $data->user_id ?? null;

            if (!$product_id && !$user_id) {
                return $this->sendPayload(null, "error", "Product ID or User ID required", 400);
            }

            $sql = "SELECT rh.*, 
                           p.product_name,
                           u.full_name as buyer_name,
                           s.full_name as seller_name
                    FROM reservation_history rh
                    JOIN products p ON rh.product_id = p.product_id
                    JOIN users u ON rh.reserved_by = u.id
                    JOIN users s ON rh.seller_id = s.id
                    WHERE 1=1";
            
            $params = [];

            if ($product_id) {
                $sql .= " AND rh.product_id = :product_id";
                $params[':product_id'] = $product_id;
            }

            if ($user_id) {
                $sql .= " AND (rh.reserved_by = :user_id OR rh.seller_id = :user_id)";
                $params[':user_id'] = $user_id;
            }

            $sql .= " ORDER BY rh.created_at DESC";

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $history = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            return $this->sendPayload($history, "success", "Reservation history retrieved", 200);

        } catch (\PDOException $e) {
            error_log("Get reservation history error: " . $e->getMessage());
            return $this->sendPayload(null, "error", $e->getMessage(), 500);
        }
    }

    /**
     * Submit moderator application
     */
    public function submitModeratorApplication($data) {
        $user_id = $data->user_id ?? null;
        $full_name = $data->full_name ?? null;
        $reason = $data->reason ?? null;
        $experience = $data->experience ?? null;

        // Validate required fields
        if (!$user_id || !$full_name || !$reason) {
            return $this->sendPayload(null, "error", "User ID, full name, and reason are required", 400);
        }

        try {
            // Check if user already has a pending or approved application
            $checkSql = "SELECT application_id, status FROM moderator_applications 
                        WHERE user_id = :user_id 
                        AND status IN ('pending', 'approved')";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([':user_id' => $user_id]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                if ($existing['status'] === 'approved') {
                    return $this->sendPayload(null, "error", "You are already a moderator", 409);
                } else {
                    return $this->sendPayload(null, "error", "You already have a pending application", 409);
                }
            }

            // Check if user is already a moderator
            $userCheckSql = "SELECT role FROM users WHERE id = :user_id";
            $userCheckStmt = $this->pdo->prepare($userCheckSql);
            $userCheckStmt->execute([':user_id' => $user_id]);
            $user = $userCheckStmt->fetch(PDO::FETCH_ASSOC);

            if ($user && $user['role'] === 'moderator') {
                return $this->sendPayload(null, "error", "You are already a moderator", 409);
            }

            // Insert application
            $sql = "INSERT INTO moderator_applications (user_id, full_name, reason, experience, status) 
                    VALUES (:user_id, :full_name, :reason, :experience, 'pending')";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':user_id' => $user_id,
                ':full_name' => $full_name,
                ':reason' => $reason,
                ':experience' => $experience
            ]);

            $application_id = $this->pdo->lastInsertId();

            return $this->sendPayload([
                "application_id" => $application_id,
                "status" => "pending",
                "message" => "Your moderator application has been submitted successfully"
            ], "success", "Application submitted successfully", 201);

        } catch (\PDOException $e) {
            error_log("Error submitting moderator application: " . $e->getMessage());
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

    /**
     * Review moderator application (Approve/Reject)
     */
    public function reviewModeratorApplication($data) {
        $application_id = $data->application_id ?? null;
        $action = $data->action ?? null; // 'approve' or 'reject'
        $reviewed_by = $data->reviewed_by ?? null; // Admin ID

        // Validate required fields
        if (!$application_id || !$action || !$reviewed_by) {
            return $this->sendPayload(null, "error", "Application ID, action, and reviewer ID are required", 400);
        }

        if (!in_array($action, ['approve', 'reject'])) {
            return $this->sendPayload(null, "error", "Invalid action. Must be 'approve' or 'reject'", 400);
        }

        try {
            // Get application details
            $getSql = "SELECT user_id, full_name, status FROM moderator_applications 
                      WHERE application_id = :application_id";
            $getStmt = $this->pdo->prepare($getSql);
            $getStmt->execute([':application_id' => $application_id]);
            $application = $getStmt->fetch(PDO::FETCH_ASSOC);

            if (!$application) {
                return $this->sendPayload(null, "error", "Application not found", 404);
            }

            if ($application['status'] !== 'pending') {
                return $this->sendPayload(null, "error", "This application has already been reviewed", 409);
            }

            $this->pdo->beginTransaction();

            $status = $action === 'approve' ? 'approved' : 'rejected';

            // Update application status
            $updateAppSql = "UPDATE moderator_applications 
                           SET status = :status, 
                               reviewed_by = :reviewed_by,
                               reviewed_at = NOW()
                           WHERE application_id = :application_id";
            $updateAppStmt = $this->pdo->prepare($updateAppSql);
            $updateAppStmt->execute([
                ':status' => $status,
                ':reviewed_by' => $reviewed_by,
                ':application_id' => $application_id
            ]);

            // If approved, create admin account with moderator role
            if ($action === 'approve') {
                // Get full user details from users table (only essential columns)
                $getUserSql = "SELECT id, full_name, email, profile_image 
                              FROM users WHERE id = :user_id";

                $getUserStmt = $this->pdo->prepare($getUserSql);
                $getUserStmt->execute([':user_id' => $application['user_id']]);
                $userData = $getUserStmt->fetch(PDO::FETCH_ASSOC);

                if (!$userData) {
                    $this->pdo->rollBack();
                    return $this->sendPayload(null, "error", "User not found", 404);
                }

                // Mark the user account as a moderator (used by frontend for conditional UI)
                try {
                    $setRoleSql = "UPDATE users SET role = 'moderator' WHERE id = :user_id";
                    $setRoleStmt = $this->pdo->prepare($setRoleSql);
                    $setRoleStmt->execute([':user_id' => $userData['id']]);
                } catch (\PDOException $e) {
                    // If role column doesn't exist for some reason, do not block approval
                    error_log("Could not update users.role to moderator: " . $e->getMessage());
                }

                // Generate username from email (part before @) or use user_id
                $username = explode('@', $userData['email'])[0] . '_mod_' . $userData['id'];
                
                // Generate a secure random password (12 characters)
                $newPassword = bin2hex(random_bytes(6)); // 12 characters
                $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

                // Check if username already exists in admins table
                $checkUsernameSql = "SELECT admin_id FROM admins WHERE username = :username";
                $checkUsernameStmt = $this->pdo->prepare($checkUsernameSql);
                $checkUsernameStmt->execute([':username' => $username]);
                
                // If username exists, append timestamp
                if ($checkUsernameStmt->fetch()) {
                    $username = $username . '_' . time();
                }

                // Check if email already exists in admins table
                $checkEmailSql = "SELECT admin_id FROM admins WHERE email = :email";
                $checkEmailStmt = $this->pdo->prepare($checkEmailSql);
                $checkEmailStmt->execute([':email' => $userData['email']]);
                
                if ($checkEmailStmt->fetch()) {
                    $this->pdo->rollBack();
                    return $this->sendPayload(null, "error", "This email is already registered as an admin", 409);
                }

                // Create admin account with moderator role.
                // If admins.user_id exists (recommended migration), store a stable link to users.id.
                try {
                    $createAdminSql = "INSERT INTO admins (user_id, username, email, password, full_name, role, status)
                                      VALUES (:user_id, :username, :email, :password, :full_name, 'moderator', 'active')";
                    $createAdminStmt = $this->pdo->prepare($createAdminSql);
                    $createAdminStmt->execute([
                        ':user_id' => $userData['id'],
                        ':username' => $username,
                        ':email' => $userData['email'],
                        ':password' => $hashedPassword,
                        ':full_name' => $userData['full_name']
                    ]);
                } catch (\PDOException $e) {
                    // Fallback for older schema (no user_id column in admins)
                    $createAdminSql = "INSERT INTO admins (username, email, password, full_name, role, status)
                                      VALUES (:username, :email, :password, :full_name, 'moderator', 'active')";
                    $createAdminStmt = $this->pdo->prepare($createAdminSql);
                    $createAdminStmt->execute([
                        ':username' => $username,
                        ':email' => $userData['email'],
                        ':password' => $hashedPassword,
                        ':full_name' => $userData['full_name']
                    ]);
                }

                $newAdminId = $this->pdo->lastInsertId();

                // Store the user_id link in the application for reference
                $updateLinkSql = "UPDATE moderator_applications SET admin_account_id = :admin_id 
                                 WHERE application_id = :application_id";
                try {
                    $updateLinkStmt = $this->pdo->prepare($updateLinkSql);
                    $updateLinkStmt->execute([
                        ':admin_id' => $newAdminId,
                        ':application_id' => $application_id
                    ]);
                } catch (\PDOException $e) {
                    // Column might not exist, continue without failing
                    error_log("Could not link admin_account_id: " . $e->getMessage());
                }
            }

            $this->pdo->commit();

            $message = $action === 'approve' 
                ? "Application approved. {$application['full_name']} is now a moderator with admin account created."
                : "Application rejected.";

            $responseData = [
                "application_id" => $application_id,
                "status" => $status,
                "user_id" => $application['user_id'],
                "full_name" => $application['full_name']
            ];

            // Include new admin credentials if approved
            if ($action === 'approve' && isset($newAdminId) && isset($username) && isset($newPassword)) {
                $responseData['new_admin_account'] = [
                    'admin_id' => $newAdminId,
                    'username' => $username,
                    'email' => $userData['email'],
                    'password' => $newPassword,  // Plain text password for admin to share with user
                    'full_name' => $userData['full_name'],
                    'role' => 'moderator'
                ];
            }

            return $this->sendPayload($responseData, "success", $message, 200);

        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            error_log("Error reviewing moderator application: " . $e->getMessage());
            return $this->sendPayload(null, "error", "Database error: " . $e->getMessage(), 500);
        }
    }

}
?>
