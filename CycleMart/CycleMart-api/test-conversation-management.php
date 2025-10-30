<?php
header("Content-Type: text/plain");

echo "=== Conversation Management API Test ===\n\n";

// Test data
$base_url = "http://localhost/CycleMart/CycleMart/CycleMart-api/api/";
$test_user_id = 1; // Change this to a valid user ID from your database
$test_conversation_id = 1; // Change this to a valid conversation ID from your database

echo "Base URL: $base_url\n";
echo "Test User ID: $test_user_id\n";
echo "Test Conversation ID: $test_conversation_id\n\n";

// Function to make HTTP requests
function makeRequest($url, $method = 'GET', $data = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Content-Length: ' . strlen(json_encode($data))
            ]);
        }
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'code' => $httpCode,
        'response' => json_decode($response, true)
    ];
}

echo "1. Testing GET active conversations...\n";
$result = makeRequest($base_url . "conversations?user_id=" . $test_user_id);
echo "HTTP Code: " . $result['code'] . "\n";
echo "Response: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";

echo "2. Testing GET archived conversations...\n";
$result = makeRequest($base_url . "archived-conversations?user_id=" . $test_user_id);
echo "HTTP Code: " . $result['code'] . "\n";
echo "Response: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";

echo "3. Testing POST archive conversation...\n";
$archiveData = [
    'conversation_id' => $test_conversation_id,
    'user_id' => $test_user_id
];
$result = makeRequest($base_url . "archive-conversation", 'POST', $archiveData);
echo "HTTP Code: " . $result['code'] . "\n";
echo "Response: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";

echo "4. Testing POST restore conversation...\n";
$restoreData = [
    'conversation_id' => $test_conversation_id,
    'user_id' => $test_user_id
];
$result = makeRequest($base_url . "restore-conversation", 'POST', $restoreData);
echo "HTTP Code: " . $result['code'] . "\n";
echo "Response: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";

echo "5. Testing POST delete conversation...\n";
$deleteData = [
    'conversation_id' => $test_conversation_id,
    'user_id' => $test_user_id
];
$result = makeRequest($base_url . "delete-conversation", 'POST', $deleteData);
echo "HTTP Code: " . $result['code'] . "\n";
echo "Response: " . json_encode($result['response'], JSON_PRETTY_PRINT) . "\n\n";

echo "=== Test Complete ===\n";
echo "\nNote: Please update the test_user_id and test_conversation_id variables\n";
echo "with actual values from your database before running this test.\n";
echo "\nTo run this test, visit: http://localhost/CycleMart/CycleMart/CycleMart-api/test-conversation-management.php\n";
?>