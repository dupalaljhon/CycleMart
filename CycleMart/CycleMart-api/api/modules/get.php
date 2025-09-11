<?php
require_once "global.php";

class Get extends GlobalMethods {
    private $pdo;

    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Executes a SELECT query and returns a consistent API response.
     *
     * @param string $sql  - SQL query
     * @param array  $params - optional parameters for prepared statement
     * @return array
     */
    public function executeQuery($sql, $params = []) {
        $data = [];
        $errmsg = "";
        $code = 0;

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);

            $result = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            if ($result && count($result) > 0) {
                // Normalize all keys to lowercase
                $normalized = array_map(function($row) {
                    return array_change_key_case($row, CASE_LOWER);
                }, $result);

                $data = $normalized;
                $code = 200;
            } else {
                $errmsg = "No records found";
                $code = 404;
            }
        } catch (\PDOException $e) {
            $errmsg = $e->getMessage();
            $code = 500; // internal server error
        }

        return [
            "status"  => $code === 200 ? "success" : "error",
            "code"    => $code,
            "message" => $errmsg,
            "data"    => $data
        ];
    }

    /**
     * Get user by ID (helper function for routes)
     */
    public function getUserById($id) {
        $sql = "SELECT id, email, full_name, phone, address, profile_image, terms_accepted, is_verified, created_at
                FROM users 
                WHERE id = :id";

        return $this->executeQuery($sql, [':id' => $id]);
    }


    //get all products
        public function getProductsByUser($uploader_id) {
        $sql = "SELECT * FROM products WHERE uploader_id = :uploader_id ORDER BY created_at DESC";
        return $this->executeQuery($sql, [':uploader_id' => $uploader_id]);
        
    }
 



}
