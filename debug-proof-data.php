<?php
// Debug script to check proof data in reports table
header('Content-Type: text/html; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/CycleMart/CycleMart-api/api/config/database.php';

try {
    $connection = new Connection();
    $pdo = $connection->connect();
    
    echo "<h1>🔍 Proof Data Debug Information</h1>";
    
    // Check reports with proof data
    echo "<h2>📋 Reports with Proof Files</h2>";
    $stmt = $pdo->query("SELECT report_id, report_type, proof, LENGTH(proof) as proof_length, created_at 
                         FROM reports 
                         WHERE proof IS NOT NULL AND proof != '' 
                         ORDER BY created_at DESC 
                         LIMIT 10");
    $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($reports)) {
        echo "<p style='color: orange;'>⚠️ No reports with proof data found</p>";
    } else {
        foreach ($reports as $report) {
            echo "<div style='border: 1px solid #ccc; padding: 15px; margin: 10px 0; background: #f9f9f9;'>";
            echo "<h3>Report ID: " . $report['report_id'] . "</h3>";
            echo "<p><strong>Type:</strong> " . $report['report_type'] . "</p>";
            echo "<p><strong>Created:</strong> " . $report['created_at'] . "</p>";
            echo "<p><strong>Proof Length:</strong> " . $report['proof_length'] . " characters</p>";
            
            echo "<p><strong>Proof Data (first 200 chars):</strong></p>";
            echo "<pre style='background: #fff; padding: 10px; overflow-x: auto;'>";
            echo htmlspecialchars(substr($report['proof'], 0, 200));
            echo "</pre>";
            
            echo "<p><strong>Full Proof Data:</strong></p>";
            echo "<pre style='background: #fff; padding: 10px; overflow-x: auto; max-height: 300px;'>";
            echo htmlspecialchars($report['proof']);
            echo "</pre>";
            
            // Try to parse as JSON
            $proofData = json_decode($report['proof'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                echo "<p style='color: green;'>✅ Valid JSON</p>";
                echo "<p><strong>Parsed JSON:</strong></p>";
                echo "<pre style='background: #e8f5e9; padding: 10px;'>";
                print_r($proofData);
                echo "</pre>";
                
                // Check if it's an array of file paths
                if (is_array($proofData)) {
                    echo "<p><strong>File Paths:</strong></p>";
                    echo "<ul>";
                    foreach ($proofData as $index => $path) {
                        echo "<li>File " . ($index + 1) . ": " . htmlspecialchars($path) . "</li>";
                        
                        // Check if file exists
                        $fullPath = __DIR__ . '/CycleMart/CycleMart-api/api/' . $path;
                        if (file_exists($fullPath)) {
                            echo " <span style='color: green;'>✅ File exists</span>";
                            echo " <span style='color: blue;'>(Size: " . number_format(filesize($fullPath)) . " bytes)</span>";
                        } else {
                            echo " <span style='color: red;'>❌ File not found at: " . htmlspecialchars($fullPath) . "</span>";
                        }
                    }
                    echo "</ul>";
                }
            } else {
                echo "<p style='color: red;'>❌ Invalid JSON: " . json_last_error_msg() . "</p>";
            }
            
            echo "</div>";
        }
    }
    
    // Check uploads/proof directory
    echo "<h2>📁 Uploads/Proof Directory</h2>";
    $proofDir = __DIR__ . '/CycleMart/CycleMart-api/api/uploads/proof';
    if (is_dir($proofDir)) {
        echo "<p style='color: green;'>✅ Directory exists: " . htmlspecialchars($proofDir) . "</p>";
        $files = scandir($proofDir);
        $files = array_diff($files, array('.', '..'));
        
        if (count($files) > 0) {
            echo "<p>Found " . count($files) . " files:</p>";
            echo "<ul>";
            foreach ($files as $file) {
                $filePath = $proofDir . '/' . $file;
                $fileSize = filesize($filePath);
                $fileType = mime_content_type($filePath);
                echo "<li>" . htmlspecialchars($file) . " - " . $fileType . " - " . number_format($fileSize) . " bytes</li>";
            }
            echo "</ul>";
        } else {
            echo "<p style='color: orange;'>⚠️ Directory is empty</p>";
        }
    } else {
        echo "<p style='color: red;'>❌ Directory not found: " . htmlspecialchars($proofDir) . "</p>";
    }

} catch (Exception $e) {
    echo "<h2 style='color: red;'>❌ Database Error</h2>";
    echo "<p>" . htmlspecialchars($e->getMessage()) . "</p>";
}
?>
