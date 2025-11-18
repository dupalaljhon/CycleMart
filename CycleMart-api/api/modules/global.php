<?php

class GlobalMethods {
    // public function sendPayload($data, $remarks, $message, $code) {
    //     $status = array("remarks" => $remarks, "message" => $message);
    //     http_response_code($code);
    //     return array(
    //         "status" => $status,
    //         "payload" => $data,
    //         "timestamp" => date_create()
    //     );
    // }

    public function sendPayload($data, $status, $message, $code) {
        return [
            "status" => $status,
            "code" => $code,
            "message" => $message,
            "data" => $data
        ];
    }

    /**
     * Check user account status and enforce restrictions
     * @param PDO $pdo - Database connection
     * @param int $user_id - User ID to check
     * @param string $action - Action being performed (optional)
     * @return array|null - Returns error response if blocked, null if allowed
     */
    public function checkAccountStatus($pdo, $user_id, $action = null) {
        try {
            $sql = "SELECT account_status, violation_count, full_name FROM users WHERE id = :user_id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':user_id' => $user_id]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                return $this->sendPayload(null, "error", "User not found", 404);
            }

            $status = $user['account_status'];
            $violations = $user['violation_count'];

            // Banned users cannot access anything
            if ($status === 'banned') {
                http_response_code(403);
                return $this->sendPayload([
                    'banned' => true,
                    'account_status' => 'banned',
                    'violation_count' => $violations
                ], "error", "Your account has been permanently banned due to multiple violations.", 403);
            }

            // Suspended users can only logout
            if ($status === 'suspended') {
                if ($action !== 'logout') {
                    http_response_code(403);
                    return $this->sendPayload([
                        'suspended' => true,
                        'account_status' => 'suspended',
                        'violation_count' => $violations
                    ], "error", "Your account is suspended. Please contact support.", 403);
                }
            }

            // Restricted users cannot perform certain actions
            if ($status === 'restricted') {
                $restrictedActions = ['addProduct', 'send-message', 'submit-report', 'submit-user-report'];
                if (in_array($action, $restrictedActions)) {
                    http_response_code(403);
                    return $this->sendPayload([
                        'restricted' => true,
                        'account_status' => 'restricted',
                        'violation_count' => $violations
                    ], "error", "Your account is restricted. You cannot perform this action.", 403);
                }
            }

            // Return account status info for frontend
            return null; // No restrictions
        } catch (\PDOException $e) {
            error_log("Account status check error: " . $e->getMessage());
            return $this->sendPayload(null, "error", "Error checking account status", 500);
        }
    }

    /**
     * Get violation level configuration
     */
    public function getViolationLevels() {
        return [
            ['value' => 0, 'status' => 'active'],
            ['value' => 1, 'status' => 'active'],
            ['value' => 2, 'status' => 'restricted'],
            ['value' => 3, 'status' => 'suspended'],
            ['value' => 4, 'status' => 'banned']
        ];
    }

    /**
     * Update account status based on violation count
     */
    public function updateAccountStatusByViolations($pdo, $user_id, $violation_count) {
        $levels = $this->getViolationLevels();
        $newStatus = 'active';

        foreach ($levels as $level) {
            if ($violation_count >= $level['value']) {
                $newStatus = $level['status'];
            }
        }

        try {
            $sql = "UPDATE users SET account_status = :status WHERE id = :user_id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':status' => $newStatus,
                ':user_id' => $user_id
            ]);

            return $newStatus;
        } catch (\PDOException $e) {
            error_log("Error updating account status: " . $e->getMessage());
            return false;
        }
    }
}
