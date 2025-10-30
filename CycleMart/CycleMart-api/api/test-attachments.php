<?php
// Test script to check attachment URLs
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

require_once "./config/database.php";

$con = new Connection();
$pdo = $con->connect();

try {
    // Get recent messages with attachments
    $sql = "SELECT message_id, conversation_id, sender_id, message_text, attachments, created_at 
            FROM messages 
            WHERE attachments IS NOT NULL AND attachments != '' AND attachments != '[]'
            ORDER BY created_at DESC 
            LIMIT 5";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h2>Recent Messages with Attachments:</h2>";
    foreach ($messages as $message) {
        echo "<h3>Message ID: " . $message['message_id'] . "</h3>";
        echo "<p><strong>Text:</strong> " . htmlspecialchars($message['message_text']) . "</p>";
        echo "<p><strong>Raw Attachments JSON:</strong> " . htmlspecialchars($message['attachments']) . "</p>";
        
        $attachments = json_decode($message['attachments'], true);
        if (is_array($attachments)) {
            echo "<p><strong>Processed Attachments:</strong></p>";
            foreach ($attachments as $attachment) {
                $fullUrl = 'http://localhost/CycleMart/CycleMart/CycleMart-api/api/' . $attachment['path'];
                echo "<div style='margin-left: 20px;'>";
                echo "<p>Type: " . $attachment['type'] . "</p>";
                echo "<p>Path: " . $attachment['path'] . "</p>";
                echo "<p>Full URL: <a href='" . $fullUrl . "' target='_blank'>" . $fullUrl . "</a></p>";
                echo "<p>File exists: " . (file_exists($attachment['path']) ? 'YES' : 'NO') . "</p>";
                echo "</div><br>";
            }
        }
        echo "<hr>";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>