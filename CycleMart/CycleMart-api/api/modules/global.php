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
}
