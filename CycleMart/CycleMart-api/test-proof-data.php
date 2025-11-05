<?php
// Test Proof Data in Reports - Debug proof column
header("Content-Type: text/plain; charset=utf-8");
header("Access-Control-Allow-Origin: *");

require_once "./api/config/database.php";
require_once "./api/modules/post.php";

try {
    $con = new Connection();
    $pdo = $con->connect();
    $post = new Post($pdo);

    echo "=== Testing Proof Data in Reports ===\n\n";

    // 1. Check reports with proof data
    echo "1. Checking Reports with Proof Data:\n";
    $stmt = $pdo->query("SELECT report_id, reporter_id, reason_type, proof, LENGTH(proof) as proof_length FROM reports WHERE proof IS NOT NULL AND proof != '' ORDER BY created_at DESC LIMIT 5");
    $reportsWithProof = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (!empty($reportsWithProof)) {
        foreach ($reportsWithProof as $report) {
            echo "Report ID: {$report['report_id']}\n";
            echo "Reporter ID: {$report['reporter_id']}\n";
            echo "Reason: {$report['reason_type']}\n";
            echo "Proof Length: {$report['proof_length']} characters\n";
            echo "Proof Data (first 200 chars): " . substr($report['proof'], 0, 200) . "\n";
            echo "Is Valid JSON: " . (json_decode($report['proof']) !== null ? 'YES' : 'NO') . "\n";
            
            if (json_decode($report['proof']) !== null) {
                $decoded = json_decode($report['proof'], true);
                echo "Decoded Proof: " . print_r($decoded, true) . "\n";
            }
            echo "---\n";
        }
    } else {
        echo "No reports with proof data found.\n";
    }
    echo "\n";

    // 2. Test getAllReports API
    echo "2. Testing getAllReports API Response:\n";
    $result = $post->getAllReports();
    echo "API Status: {$result['status']}\n";
    echo "API Message: {$result['message']}\n";
    echo "Number of reports returned: " . count($result['data'] ?? []) . "\n";
    
    if (!empty($result['data'])) {
        echo "\nFirst report with proof (if any):\n";
        foreach ($result['data'] as $report) {
            if (!empty($report['proof'])) {
                echo "Report ID: {$report['report_id']}\n";
                echo "Proof data type: " . gettype($report['proof']) . "\n";
                echo "Proof data: " . print_r($report['proof'], true) . "\n";
                break;
            }
        }
    }

    // 3. Test raw database query vs API response
    echo "\n3. Comparing Raw DB vs API Response:\n";
    $rawStmt = $pdo->query("SELECT report_id, proof FROM reports WHERE proof IS NOT NULL AND proof != '' LIMIT 1");
    $rawReport = $rawStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($rawReport) {
        echo "Raw DB Proof Data: " . $rawReport['proof'] . "\n";
        echo "Raw DB Data Type: " . gettype($rawReport['proof']) . "\n";
        
        // Now get the same report through the API
        $apiResult = $post->getAllReports();
        if (!empty($apiResult['data'])) {
            foreach ($apiResult['data'] as $apiReport) {
                if ($apiReport['report_id'] == $rawReport['report_id']) {
                    echo "API Proof Data: " . print_r($apiReport['proof'], true) . "\n";
                    echo "API Data Type: " . gettype($apiReport['proof']) . "\n";
                    break;
                }
            }
        }
    }

    echo "\n=== Test Completed ===\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
?>