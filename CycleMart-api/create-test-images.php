<?php
// Create proper test images
$uploadDir = 'uploads/user_reports/';

// Create a simple test image (1x1 pixel PNG)
$imageData = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGKNg7AgsAAAABJRU5ErkJggg==');

// Get list of existing files to replace
$files = glob($uploadDir . '*.jpg');

foreach ($files as $file) {
    // Replace with actual image data
    file_put_contents($file, $imageData);
    echo "Updated: " . $file . " (size: " . filesize($file) . " bytes)\n";
}

// Also create a better test image (colored square)
$testImage = imagecreate(100, 100);
$blue = imagecolorallocate($testImage, 0, 100, 200);
$white = imagecolorallocate($testImage, 255, 255, 255);
imagefill($testImage, 0, 0, $blue);
imagestring($testImage, 5, 20, 40, 'TEST', $white);

// Save as JPEG
$testFile = $uploadDir . 'test_image.jpg';
imagejpeg($testImage, $testFile, 90);
imagedestroy($testImage);

echo "Created test image: " . $testFile . " (size: " . filesize($testFile) . " bytes)\n";

// Update one report to use the new test image
require_once 'api/config/database.php';
$con = new Connection();
$pdo = $con->connect();

$jsonFiles = json_encode([$testFile]);
$sql = "UPDATE user_reports SET proof_files = :proof_files WHERE user_report_id = 4";
$stmt = $pdo->prepare($sql);
$stmt->execute([':proof_files' => $jsonFiles]);

echo "Updated report 4 to use test image\n";
?>