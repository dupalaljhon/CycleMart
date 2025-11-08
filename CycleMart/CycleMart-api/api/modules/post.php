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
    private $key = "your_secret_key"; 

    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
    }

    // âœ… Registration with hashing and email verification
    public function registerUser($data) {
        $full_name = $data->full_name ?? '';
        $email = $data->email ?? '';
        $password = $data->password ?? '';
        $phone = $data->phone ?? '';
        $street = $data->street ?? '';
        $barangay = $data->barangay ?? '';
        $city = $data->city ?? '';
        $province = $data->province ?? '';
        $terms_accepted = $data->terms_accepted ?? 0;

        // Validate required fields
        if (!$full_name || !$email || !$password || !$phone || !$street || !$barangay || !$city || !$province) {
            return $this->sendPayload(null, "error", "All fields are required", 400);
        }

        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
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

        // Insert new user with verification token
        $sql = "INSERT INTO users (full_name, email, password, phone, street, barangay, city, province, terms_accepted, verification_token, token_expires_at, is_verified) 
                VALUES (:full_name, :email, :password, :phone, :street, :barangay, :city, :province, :terms_accepted, :verification_token, :token_expires_at, 0)";

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
                ':province' => $province,
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
            );

            $responseData = [
                "userID" => $userId,
                "email" => $email,
                "full_name" => $full_name,
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
            return $this->sendPayload(null, "error", "Registration failed", 500);
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

            $payload = [
                'iss' => "http://example.org", 
                'aud' => "http://example.com", 
                'iat' => time(), 
                'exp' => time() + 3600, 
                'uid' => $user['id']
            ];
            $jwt = JWT::encode($payload, $this->key, 'HS256');

            return $this->sendPayload([
                'token' => $jwt,
                'userID' => $user['id'],
                'email' => $user['email'],
                'full_name' => $user['full_name'],
                'phone' => $user['phone'],
                'street' => $user['street'],
                'barangay' => $user['barangay'],
                'city' => $user['city'],
                'province' => $user['province'],
                'profile_image' => $user['profile_image'],
                'is_verified' => $user['is_verified']
            ], "success", "Login successful", 200);
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
                'role' => $admin['role'] ?? 'admin'
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


//profile update
public function uploadProfile($data) {
    error_log("Received profile data: " . print_r($data, true)); 

    $full_name = $data->full_name ?? '';
    $phone     = $data->phone ?? '';
    $street    = $data->street ?? '';
    $barangay  = $data->barangay ?? '';
    $city      = $data->city ?? '';
    $province  = $data->province ?? '';
    $user_id   = $data->user_id ?? '';

    // Validate required fields
    if (empty($full_name) || empty($user_id)) {
        return $this->sendPayload(null, "error", "Full name and user ID are required", 400);
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

    // Update user profile in users table
    $sql = "UPDATE users SET full_name = :full_name, phone = :phone, street = :street, barangay = :barangay, city = :city, province = :province";
    $params = [
        'full_name' => $full_name,
        'phone'     => $phone,
        'street'    => $street,
        'barangay'  => $barangay,
        'city'      => $city,
        'province'  => $province,
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
            "province"  => $province,
            "profile_image" => $imagePath
        ], "success", "Profile updated successfully", 200);

    } catch (\PDOException $e) {
        error_log("Database Error: " . $e->getMessage()); 
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}






// Edit/Update profile
public function editProfile($data) {
    $full_name = $data->full_name ?? '';
    $email = $data->email ?? '';
    $phone     = $data->phone ?? '';
    $street    = $data->street ?? '';
    $barangay  = $data->barangay ?? '';
    $city      = $data->city ?? '';
    $province  = $data->province ?? '';
    $user_id   = $data->user_id ?? '';
    $email_changed = $data->email_changed ?? false;
    $image     = $data->image ?? null;
    $imagePath = null;

    // Validate required fields
    if (empty($full_name) || empty($user_id) || empty($email)) {
        return $this->sendPayload(null, "error", "Full name, email and user ID are required", 400);
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
        
        $imageName = uniqid('profile_') . '.' . $ext;
        $imagePath = 'uploads/' . $imageName;
        $fullImagePath = __DIR__ . '/../../' . $imagePath;
        
        if (!file_put_contents($fullImagePath, $imageData)) {
            error_log("Failed to save image to: " . $fullImagePath);
            return $this->sendPayload(null, "error", "Failed to save image", 500);
        }
        
        error_log("Image saved successfully to: " . $fullImagePath);
    }

    // Build SQL and params
    $sql = "UPDATE users SET full_name = :full_name, email = :email, phone = :phone, street = :street, barangay = :barangay, city = :city, province = :province";
    $params = [
        'full_name' => $full_name,
        'email'     => $email,
        'phone'     => $phone,
        'street'    => $street,
        'barangay'  => $barangay,
        'city'      => $city,
        'province'  => $province,
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
            
            $emailResult = sendEmailChangeVerificationEmail($email, $full_name, $verificationToken, 'http://localhost:4200');
            
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
            "province"  => $province,
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


public function addProduct($data) {
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

    if (!$product_name || !$price || !$description || !$location || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing required fields", 400);
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
    
    // Create videos directory if it doesn't exist
    $videosDir = 'uploads/videos';
    if (!is_dir($videosDir)) {
        mkdir($videosDir, 0755, true);
    }
    
    // Save base64 videos to uploads/videos/
    $savedVideoPaths = [];
    if (is_array($videoData)) {
        foreach ($videoData as $vid) {
            if (preg_match('/^data:video\/(\w+);base64,/', $vid, $matches)) {
                $ext = strtolower($matches[1]);
                
                // Validate video format
                $allowedVideoFormats = ['mp4', 'mov', 'avi', 'webm', 'ogg'];
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
                    error_log("Saved video file: " . realpath($videoPath));
                    $savedVideoPaths[] = $videoPath;
                }
            }
        }
    }

    $jsonImages = json_encode($savedPaths);
    $jsonVideos = json_encode($savedVideoPaths);
    
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

    $sql = "INSERT INTO products (product_name, brand_name, custom_brand, product_images, product_videos, price, description, location, for_type, `condition`, category, quantity, status, sale_status, uploader_id, specifications) 
            VALUES (:product_name, :brand_name, :custom_brand, :product_images, :product_videos, :price, :description, :location, :for_type, :condition, :category, :quantity, 'active', 'available', :uploader_id, :specifications)";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'product_name'    => $product_name,
            'brand_name'      => $brand_name,
            'custom_brand'    => $custom_brand,
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

        $lastId = $this->pdo->lastInsertId();

        // Create notification for new listing
        $userName = $this->getUserNameById($uploader_id);
        $notificationTitle = "New listing uploaded";
        $notificationMessage = sprintf(
            "%s uploaded a new %s: '%s' for â‚±%s in %s",
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
            "videos"       => $savedVideoPaths
        ], "success", "Product added successfully", 201);

    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
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

    if (!$product_id || !$product_name || !$price || !$description || !$location || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing required fields", 400);
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

    // Handle images if they contain base64 data
    $imageData = json_decode($product_images, true);
    $savedPaths = [];
    
    if (is_array($imageData)) {
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
                
                // Validate video format
                $allowedVideoFormats = ['mp4', 'mov', 'avi', 'webm', 'ogg'];
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

    $sql = "UPDATE products SET 
                product_name = :product_name,
                brand_name = :brand_name,
                custom_brand = :custom_brand,
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
            return $this->sendPayload([
                "product_id" => $product_id,
                "message" => "Product updated successfully"
            ], "success", "Product updated successfully", 200);
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

    $sql = "UPDATE products SET 
                sale_status = :sale_status 
            WHERE product_id = :product_id AND uploader_id = :uploader_id";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':sale_status' => $sale_status,
            ':product_id' => $product_id,
            ':uploader_id' => $uploader_id
        ]);

        if ($stmt->rowCount() > 0) {
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
    $product_images = $data->product_images ?? null;
    $product_description = $data->product_description ?? null;
    $reason_type = $data->reason_type ?? null;
    $reason_details = $data->reason_details ?? null;
    $proof = $data->proof ?? null;  // Array of base64 strings from frontend

    // Validate required fields
    if (!$reporter_id || !$reason_type) {
        return $this->sendPayload(null, "error", "Reporter ID and reason type are required", 400);
    }

    // Validate reason_type enum (exact match with database)
    $valid_reason_types = ['scam', 'fake product', 'spam', 'inappropriate content', 'misleading information', 'stolen item', 'others'];
    if (!in_array($reason_type, $valid_reason_types)) {
        return $this->sendPayload(null, "error", "Invalid reason type", 400);
    }

    // Ensure either reported_user_id or product_id is provided, but not both
    if ((!$reported_user_id && !$product_id) || ($reported_user_id && $product_id)) {
        return $this->sendPayload(null, "error", "Either reported_user_id or product_id must be provided, but not both", 400);
    }

    // Validate product_images JSON if provided
    if ($product_images !== null && !$this->isValidJson($product_images)) {
        return $this->sendPayload(null, "error", "Product images must be valid JSON", 400);
    }

    // Process proof files if provided
    $proofFilePaths = null;
    if ($proof && is_array($proof)) {
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
            $stmt = $this->pdo->prepare("SELECT product_id FROM products WHERE product_id = :product_id");
            $stmt->execute([':product_id' => $product_id]);
            if (!$stmt->fetch()) {
                return $this->sendPayload(null, "error", "Product not found", 404);
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
                product_images, 
                product_description, 
                reason_type, 
                reason_details, 
                proof,
                status, 
                created_at
            ) VALUES (
                :reporter_id, 
                :reported_user_id, 
                :product_id, 
                :product_images, 
                :product_description, 
                :reason_type, 
                :reason_details, 
                :proof,
                'pending', 
                NOW()
            )";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':reporter_id' => $reporter_id,
            ':reported_user_id' => $reported_user_id,
            ':product_id' => $product_id,
            ':product_images' => $product_images,
            ':product_description' => $product_description,
            ':reason_type' => $reason_type,
            ':reason_details' => $reason_details,
            ':proof' => $proofFilePaths
        ]);

        $report_id = $this->pdo->lastInsertId();

        return $this->sendPayload([
            "report_id" => $report_id,
            "reporter_id" => $reporter_id,
            "reported_user_id" => $reported_user_id,
            "product_id" => $product_id,
            "reason_type" => $reason_type,
            "status" => "pending",
            "message" => "Report submitted successfully"
        ], "success", "Report submitted successfully", 201);

    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", "Failed to submit report: " . $e->getMessage(), 500);
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
    // Get all reports with exact database field mapping
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
                    WHEN r.reporter_id IS NOT NULL THEN 
                        (SELECT full_name FROM users WHERE id = r.reporter_id)
                    ELSE NULL 
                END as reporter_name,
                CASE 
                    WHEN r.reporter_id IS NOT NULL THEN 
                        (SELECT email FROM users WHERE id = r.reporter_id)
                    ELSE NULL 
                END as reporter_email,
                CASE 
                    WHEN r.reporter_id IS NOT NULL THEN 
                        (SELECT profile_image FROM users WHERE id = r.reporter_id)
                    ELSE NULL 
                END as reporter_profile_image,
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

        // Determine new status based on action
        $new_status = ($action === 'archived') ? 'archived' : 'active';

        try {
            // Begin transaction
            $this->pdo->beginTransaction();

            // Update product status
            $sql = "UPDATE products SET status = :status WHERE product_id = :product_id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'status' => $new_status,
                'product_id' => $product_id
            ]);

            // Insert into archive history
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

            $this->pdo->commit();

            return $this->sendPayload([
                'product_id' => $product_id,
                'status' => $new_status,
                'action' => $action
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
        if ($created_by_role !== 'super_admin' && $created_by_role !== 'moderator') {
            return $this->sendPayload(null, "error", "Insufficient permissions to create admin", 403);
        }

        // Super admins can create any role, moderators can only create support staff
        if ($created_by_role === 'moderator' && in_array($role, ['super_admin', 'moderator'])) {
            return $this->sendPayload(null, "error", "Moderators can only create support staff", 403);
        }

        // Validate role
        if (!in_array($role, ['super_admin', 'moderator', 'support'])) {
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
        if ($updated_by_role !== 'super_admin' && $updated_by_role !== 'moderator') {
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
                
                if ($target && in_array($target['role'], ['super_admin', 'moderator'])) {
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
        if ($deleted_by_role !== 'super_admin') {
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
                                        "\n💰 Price: $" . number_format($product['price'], 2) .
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
                                "\n💰 Price: $" . number_format($product['price'], 2) .
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
        $conversation_id = $data->conversation_id ?? null;
        $sender_id = $data->sender_id ?? null;
        $message_text = $data->message_text ?? '';
        $attachments = $data->attachments ?? [];

        if (!$conversation_id || !$sender_id) {
            return $this->sendPayload(null, "error", "Missing required fields: conversation_id, sender_id", 400);
        }

        // At least message text or attachments must be provided
        if (empty($message_text) && empty($attachments)) {
            return $this->sendPayload(null, "error", "Either message text or attachments must be provided", 400);
        }

        // Verify conversation exists and sender is part of it
        $verifySql = "SELECT * FROM conversations WHERE conversation_id = :conversation_id 
                      AND (buyer_id = :sender_id1 OR seller_id = :sender_id2)";
        
        try {
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

            // Process attachments if provided
            $savedAttachments = [];
            if (!empty($attachments)) {
                // Create attachments directory if it doesn't exist
                $attachmentsDir = 'uploads/attachments';
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
                            $extension = pathinfo($fileName, PATHINFO_EXTENSION);
                            $uniqueName = uniqid('msg_') . '_' . time() . '.' . $extension;
                            $filePath = $attachmentsDir . '/' . $uniqueName;
                            
                            // Save file
                            if (file_put_contents($filePath, $fileContent)) {
                                $savedAttachments[] = [
                                    'type' => strpos($mimeType, 'image/') === 0 ? 'image' : 'video',
                                    'path' => $filePath,
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

            // Get sender info for response
            $senderSql = "SELECT full_name, profile_image FROM users WHERE id = :sender_id";
            $stmt = $this->pdo->prepare($senderSql);
            $stmt->execute([':sender_id' => $sender_id]);
            $sender = $stmt->fetch(\PDO::FETCH_ASSOC);

            // Add full URL paths to attachments for frontend
            $attachmentsWithUrls = [];
            foreach ($savedAttachments as $attachment) {
                $attachmentWithUrl = $attachment;
                $attachmentWithUrl['url'] = 'http://localhost/CycleMart/CycleMart/CycleMart-api/api/' . $attachment['path'];
                $attachmentsWithUrls[] = $attachmentWithUrl;
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
                "recipient_id" => $conversation['buyer_id'] == $sender_id ? $conversation['seller_id'] : $conversation['buyer_id']
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

        // Check admin permissions (only super_admin and moderator can delete users)
        if (!in_array($admin_role, ['super_admin', 'moderator'])) {
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

}
?>
