<?php
// 🔹 CORS headers (must be first, before any output)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");


// 🔹 Handle preflight request
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

    // ✅ Registration with hashing and email verification
    public function registerUser($data) {
        $full_name = $data->full_name ?? null;
        $email     = $data->email ?? null;
        $password  = $data->password ?? null;
        $phone     = $data->phone ?? null;
        $address   = $data->address ?? null;
        $terms     = $data->terms_accepted ?? 0;
        $profile_image = null;

        if (!$full_name || !$email || !$password) {
            return $this->sendPayload(null, "error", "Full name, email, and password are required", 400);
        }

        if (!$terms) {
            return $this->sendPayload(null, "error", "You must accept the Terms and Conditions", 400);
        }

        // Validate password strength
        $passwordValidation = $this->validatePasswordStrength($password);
        if (!$passwordValidation['valid']) {
            return $this->sendPayload(null, "error", "Password does not meet requirements: " . implode(", ", $passwordValidation['errors']), 400);
        }

        // Hash password after validation
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

        // Handle profile image if provided
        if (isset($data->profile_image) && !empty($data->profile_image)) {
            if (preg_match('/^data:image\/(\w+);base64,/', $data->profile_image, $matches)) {
                $ext = strtolower($matches[1]);
                $imageData = base64_decode(str_replace($matches[0], '', $data->profile_image));
                if ($imageData !== false) {
                    $imageName = uniqid('profile_') . '.' . $ext;
                    $imagePath = 'uploads/' . $imageName;
                    if (file_put_contents($imagePath, $imageData)) {
                        $profile_image = $imagePath;
                    }
                }
            }
        }

        if (!$full_name || !$email || !$password) {
            return $this->sendPayload(null, "error", "Full name, email, and password are required", 400);
        }

        if (!$terms) {
            return $this->sendPayload(null, "error", "You must accept the Terms and Conditions", 400);
        }

        // Generate verification token
        $verification_token = bin2hex(random_bytes(32));
        $token_expires_at = date('Y-m-d H:i:s', strtotime('+24 hours'));

        $sql = "INSERT INTO users (full_name, email, password, phone, address, profile_image, terms_accepted, verification_token, token_expires_at) 
                VALUES (:full_name, :email, :password, :phone, :address, :profile_image, :terms_accepted, :verification_token, :token_expires_at)";
        
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'full_name' => $full_name,
                'email' => $email,
                'password' => $hashedPassword,
                'phone' => $phone,
                'address' => $address,
                'profile_image' => $profile_image,
                'terms_accepted' => $terms,
                'verification_token' => $verification_token,
                'token_expires_at' => $token_expires_at
            ]);

            $lastUserId = $this->pdo->lastInsertId();

            // Create notification for new user registration
            $notificationTitle = "New user registered";
            $notificationMessage = sprintf(
                "A new user '%s' has registered with email: %s",
                $full_name,
                $email
            );
            
            $this->createNotification(
                'new_user',
                $notificationTitle,
                $notificationMessage,
                $lastUserId, // reference_id points to user_id
                $lastUserId // created_by (the new user)
            );

            // Send verification email
            require_once __DIR__ . '/../config/email.php';
            $emailService = new EmailService();
            $emailResult = $emailService->sendVerificationEmail($email, $full_name, $verification_token);
            
            if ($emailResult['success']) {
                return $this->sendPayload([
                    'message' => 'Registration successful! Please check your email to verify your account.',
                    'email_sent' => true
                ], "success", "User registered successfully. Verification email sent.", 201);
            } else {
                // User registered but email failed - still success but with warning
                return $this->sendPayload([
                    'message' => 'Registration successful! However, there was an issue sending the verification email. Please contact support.',
                    'email_sent' => false,
                    'email_error' => $emailResult['message']
                ], "success", "User registered but email sending failed", 201);
            }
        } catch (\PDOException $e) {
            // Duplicate email
            if ($e->getCode() == 23000) {
                return $this->sendPayload(null, "error", "Email already registered", 400);
            }
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // ✅ Login with bcrypt + JWT
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
                'address' => $user['address'],
                'profile_image' => $user['profile_image']
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
    $address   = $data->address ?? '';
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

        // Save image to uploads folder
        $imageName = uniqid('profile_') . '.' . $ext;
        $imagePath = 'uploads/' . $imageName;

        if (!file_put_contents($imagePath, $imageData)) {
            return $this->sendPayload(null, "error", "Failed to save image", 500);
        }
    }

    // Update user profile in users table
    $sql = "UPDATE users SET full_name = :full_name, phone = :phone, address = :address";
    $params = [
        'full_name' => $full_name,
        'phone'     => $phone,
        'address'   => $address,
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
            "address"   => $address,
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
    $phone     = $data->phone ?? '';
    $address   = $data->address ?? '';
    $user_id   = $data->user_id ?? '';
    $image     = $data->image ?? null;
    $imagePath = null;

    // Validate required fields
    if (empty($full_name) || empty($user_id)) {
        return $this->sendPayload(null, "error", "Full name and user ID are required", 400);
    }

    // If image is provided and is base64, update the image file
    if ($image && preg_match('/^data:image\/(\w+);base64,/', $image, $matches)) {
        $ext = strtolower($matches[1]);
        $imageData = base64_decode(str_replace($matches[0], '', $image));
        if ($imageData === false) {
            return $this->sendPayload(null, "error", "Invalid image data", 400);
        }
        $imageName = uniqid('profile_') . '.' . $ext;
        $imagePath = 'uploads/' . $imageName;
        if (!file_put_contents($imagePath, $imageData)) {
            return $this->sendPayload(null, "error", "Failed to save image", 500);
        }
    }

    // Build SQL and params
    $sql = "UPDATE users SET full_name = :full_name, phone = :phone, address = :address";
    $params = [
        'full_name' => $full_name,
        'phone'     => $phone,
        'address'   => $address,
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

        return $this->sendPayload([
            "full_name" => $full_name,
            "phone"     => $phone,
            "address"   => $address,
            "profile_image" => $imagePath // may be null if not updated
        ], "success", "Profile updated successfully", 200);

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
    $price        = $data->price ?? 0;
    $description  = $data->description ?? '';
    $location     = $data->location ?? '';
    $for_type     = $data->for_type ?? 'sale';
    $condition    = $data->condition ?? 'second_hand';
    $category     = $data->category ?? 'others';
    $quantity     = $data->quantity ?? 1;
    $uploader_id  = $data->uploader_id ?? null;
    $images       = $data->images ?? [];

    if (!$product_name || !$price || !$description || !$location || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing required fields", 400);
    }

    if ($quantity < 1) {
        return $this->sendPayload(null, "error", "Quantity must be at least 1", 400);
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

    $jsonImages = json_encode($savedPaths);

    $sql = "INSERT INTO products (product_name, product_images, price, description, location, for_type, `condition`, category, quantity, status, sale_status, uploader_id) 
            VALUES (:product_name, :product_images, :price, :description, :location, :for_type, :condition, :category, :quantity, 'active', 'available', :uploader_id)";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'product_name'    => $product_name,
            'product_images'  => $jsonImages,
            'price'           => $price,
            'description'     => $description,
            'location'        => $location,
            'for_type'        => $for_type,
            'condition'       => $condition,
            'category'        => $category,
            'quantity'        => $quantity,
            'uploader_id'     => $uploader_id
        ]);

        $lastId = $this->pdo->lastInsertId();

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

        return $this->sendPayload([
            "product_id"   => $lastId,
            "product_name" => $product_name,
            "price"        => $price,
            "description"  => $description,
            "location"     => $location,
            "for_type"     => $for_type,
            "condition"    => $condition,
            "category"     => $category,
            "images"       => $savedPaths
        ], "success", "Product added successfully", 201);

    } catch (\PDOException $e) {
        return $this->sendPayload(null, "error", $e->getMessage(), 400);
    }
}

public function updateProduct($data) {
    $product_id = $data->product_id ?? null;
    $product_name = $data->product_name ?? '';
    $price = $data->price ?? 0;
    $description = $data->description ?? '';
    $location = $data->location ?? '';
    $for_type = $data->for_type ?? 'sale';
    $condition = $data->condition ?? 'second_hand';
    $category = $data->category ?? 'others';
    $quantity = $data->quantity ?? 1;
    $uploader_id = $data->uploader_id ?? null;
    $product_images = $data->product_images ?? '[]';

    if (!$product_id || !$product_name || !$price || !$description || !$location || !$uploader_id) {
        return $this->sendPayload(null, "error", "Missing required fields", 400);
    }

    if ($quantity < 1) {
        return $this->sendPayload(null, "error", "Quantity must be at least 1", 400);
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

    $finalImages = json_encode($savedPaths);

    $sql = "UPDATE products SET 
                product_name = :product_name,
                product_images = :product_images,
                price = :price,
                description = :description,
                location = :location,
                for_type = :for_type,
                `condition` = :condition,
                category = :category,
                quantity = :quantity
            WHERE product_id = :product_id AND uploader_id = :uploader_id";

    try {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':product_name' => $product_name,
            ':product_images' => $finalImages,
            ':price' => $price,
            ':description' => $description,
            ':location' => $location,
            ':for_type' => $for_type,
            ':condition' => $condition,
            ':category' => $category,
            ':quantity' => $quantity,
            ':product_id' => $product_id,
            ':uploader_id' => $uploader_id
        ]);

        if ($stmt->rowCount() > 0) {
            return $this->sendPayload([
                "product_id" => $product_id,
                "message" => "Product updated successfully"
            ], "success", "Product updated successfully", 200);
        } else {
            return $this->sendPayload(null, "error", "Product not found or unauthorized", 404);
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
    if (!in_array($sale_status, ['available', 'sold'])) {
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

    // Email verification method
    public function verifyEmail($data) {
        $token = $data->token ?? null;
        
        if (!$token) {
            return $this->sendPayload(null, "error", "Verification token is required", 400);
        }

        // First, get user info before updating
        $getUserSql = "SELECT full_name, email FROM users WHERE verification_token = :token AND token_expires_at > NOW() AND is_verified = 0";
        
        try {
            $getUserStmt = $this->pdo->prepare($getUserSql);
            $getUserStmt->execute(['token' => $token]);
            $user = $getUserStmt->fetch();
            
            if (!$user) {
                return $this->sendPayload(null, "error", "Invalid or expired verification token", 400);
            }

            // Update user verification status
            $sql = "UPDATE users SET is_verified = 1, verification_token = NULL, token_expires_at = NULL 
                    WHERE verification_token = :token AND token_expires_at > NOW()";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(['token' => $token]);
            
            if ($stmt->rowCount() > 0) {
                // Send welcome email
                require_once __DIR__ . '/../config/email.php';
                $emailService = new EmailService();
                $emailService->sendWelcomeEmail($user['email'], $user['full_name']);
                
                return $this->sendPayload([
                    'message' => 'Email verified successfully! Welcome to CycleMart.',
                    'verified' => true
                ], "success", "Email verified successfully", 200);
            } else {
                return $this->sendPayload(null, "error", "Invalid or expired verification token", 400);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
    }

    // Generate verification token for existing users
    public function generateVerificationToken($data) {
        $email = $data->email ?? null;
        
        if (!$email) {
            return $this->sendPayload(null, "error", "Email is required", 400);
        }

        // Get user info first
        $getUserSql = "SELECT full_name, email FROM users WHERE email = :email AND is_verified = 0";
        
        try {
            $getUserStmt = $this->pdo->prepare($getUserSql);
            $getUserStmt->execute(['email' => $email]);
            $user = $getUserStmt->fetch();
            
            if (!$user) {
                return $this->sendPayload(null, "error", "User not found or already verified", 400);
            }

            $token = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));

            $sql = "UPDATE users SET verification_token = :token, token_expires_at = :expires 
                    WHERE email = :email AND is_verified = 0";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                'token' => $token,
                'expires' => $expires,
                'email' => $email
            ]);
            
            if ($stmt->rowCount() > 0) {
                // Send verification email
                require_once __DIR__ . '/../config/email.php';
                $emailService = new EmailService();
                $emailResult = $emailService->sendVerificationEmail($user['email'], $user['full_name'], $token);
                
                if ($emailResult['success']) {
                    return $this->sendPayload([
                        'message' => 'Verification email sent successfully! Please check your email.',
                        'email_sent' => true
                    ], "success", "Verification email sent", 200);
                } else {
                    return $this->sendPayload([
                        'message' => 'Token generated but email sending failed. Please contact support.',
                        'email_sent' => false,
                        'email_error' => $emailResult['message']
                    ], "success", "Token generated but email failed", 200);
                }
            } else {
                return $this->sendPayload(null, "error", "User not found or already verified", 400);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
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
            $errors[] = "Contains uppercase letters (A–Z)";
        }
        
        // Check for lowercase letters (a-z)
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = "Contains lowercase letters (a–z)";
        }
        
        // Check for numbers (0-9)
        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = "Contains numbers (0–9)";
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

    // ✅ Notification System Functions
    
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
            
            return $this->sendPayload([
                'total_users' => (int)$totalUsers,
                'total_listings' => (int)$totalListings
            ], "success", "Dashboard stats retrieved", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "error", $e->getMessage(), 400);
        }
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
            
            if ($previous_status === 'available' && $new_status === 'sold') {
                switch ($for_type) {
                    case 'sale':
                        $actionText = 'marked as sold';
                        break;
                    case 'trade':
                        $actionText = 'marked as traded';
                        break;
                    case 'both':
                        $actionText = 'marked as sold/traded';
                        break;
                    default:
                        $actionText = 'marked as sold';
                }
            } elseif ($previous_status === 'sold' && $new_status === 'available') {
                $actionText = 'marked as available again';
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

}
?>
