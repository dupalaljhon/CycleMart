<?php
// Debug script to check message attachments
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

require_once "./config/database.php";
require_once "./modules/get.php";

$con = new Connection();
$pdo = $con->connect();
$get = new Get($pdo);

// Test getting conversation messages
echo "<h1>Debug: Message Attachments</h1>";

// Get a conversation ID that has messages
$sql = "SELECT DISTINCT conversation_id FROM messages WHERE attachments IS NOT NULL AND attachments != '' ORDER BY created_at DESC LIMIT 3";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<h2>Conversations with attachments:</h2>";
foreach ($conversations as $conv) {
    echo "<h3>Testing Conversation ID: " . $conv['conversation_id'] . "</h3>";
    
    // Use the Get class method to retrieve messages
    $result = $get->getConversationMessages($conv['conversation_id']);
    
    echo "<h4>API Response:</h4>";
    echo "<pre style='background: #f5f5f5; padding: 10px; border-radius: 5px;'>";
    echo json_encode($result, JSON_PRETTY_PRINT);
    echo "</pre>";
    
    if ($result['status'] === 'success' && !empty($result['data'])) {
        echo "<h4>Processed Messages:</h4>";
        foreach ($result['data'] as $message) {
            if (!empty($message['attachments'])) {
                echo "<div style='border: 1px solid #ccc; margin: 10px 0; padding: 10px;'>";
                echo "<p><strong>Message ID:</strong> " . $message['message_id'] . "</p>";
                echo "<p><strong>Text:</strong> " . htmlspecialchars($message['message_text']) . "</p>";
                echo "<p><strong>Attachments:</strong></p>";
                
                foreach ($message['attachments'] as $attachment) {
                    echo "<div style='margin-left: 20px; background: #f9f9f9; padding: 10px; margin: 5px 0;'>";
                    echo "<p>Type: " . $attachment['type'] . "</p>";
                    echo "<p>Name: " . ($attachment['name'] ?? 'N/A') . "</p>";
                    echo "<p>Path: " . $attachment['path'] . "</p>";
                    echo "<p>URL: <a href='" . $attachment['url'] . "' target='_blank'>" . $attachment['url'] . "</a></p>";
                    echo "<p>File exists: " . (file_exists($attachment['path']) ? '✅ YES' : '❌ NO') . "</p>";
                    
                    // Display the attachment
                    if ($attachment['type'] === 'image') {
                        echo "<img src='" . $attachment['url'] . "' style='max-width: 200px; max-height: 150px; border: 1px solid #ddd;' alt='Attachment'>";
                    } elseif ($attachment['type'] === 'video') {
                        echo "<video controls style='max-width: 200px; max-height: 150px; border: 1px solid #ddd;'>";
                        echo "<source src='" . $attachment['url'] . "' type='video/mp4'>";
                        echo "Your browser does not support the video tag.";
                        echo "</video>";
                    }
                    echo "</div>";
                }
                echo "</div>";
            }
        }
    }
    echo "<hr>";
}

if (empty($conversations)) {
    echo "<p>No conversations found with attachments. Let's check the messages table directly:</p>";
    
    $sql = "SELECT message_id, conversation_id, message_text, attachments FROM messages WHERE attachments IS NOT NULL AND attachments != '' AND attachments != '[]' ORDER BY created_at DESC LIMIT 5";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h3>Raw Messages with Attachments:</h3>";
    foreach ($messages as $msg) {
        echo "<div style='border: 1px solid #ccc; margin: 10px 0; padding: 10px;'>";
        echo "<p><strong>Message ID:</strong> " . $msg['message_id'] . "</p>";
        echo "<p><strong>Conversation ID:</strong> " . $msg['conversation_id'] . "</p>";
        echo "<p><strong>Text:</strong> " . htmlspecialchars($msg['message_text']) . "</p>";
        echo "<p><strong>Raw Attachments:</strong> " . htmlspecialchars($msg['attachments']) . "</p>";
        echo "</div>";
    }
}
?>