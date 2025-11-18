<?php
// Update database with correct proof files paths
require_once 'api/config/database.php';

$con = new Connection();
$pdo = $con->connect();

// First, let's see what files actually exist
$actualFiles = glob('uploads/user_reports/*.jpg');
echo "Actual files found:\n";
foreach ($actualFiles as $file) {
    echo "- " . $file . "\n";
}

if (!empty($actualFiles)) {
    // Update the database with the first actual file
    $firstFile = $actualFiles[0];
    $jsonFiles = json_encode([$firstFile]);
    
    $sql = "UPDATE user_reports SET proof_files = :proof_files WHERE proof_files IS NOT NULL AND proof_files != '' LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':proof_files' => $jsonFiles]);
    
    echo "\nUpdated database with: " . $jsonFiles . "\n";
    
    // Verify the update
    $sql = "SELECT user_report_id, proof_files FROM user_reports WHERE proof_files IS NOT NULL AND proof_files != '' LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result) {
        echo "Database now contains: " . $result['proof_files'] . "\n";
    }
} else {
    echo "No actual files found!\n";
}
?>