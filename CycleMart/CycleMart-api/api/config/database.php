<?php


date_default_timezone_set("Asia/Manila");


set_time_limit(1000);


define("SERVER", "localhost");
define("DATABASE", "cyclemart");
define("USER", "root");
define("PASSWORD", "");
define("DRIVER", "mysql");

class Connection{
    private $connectionString = DRIVER . ":host=" . SERVER . ";dbname=" . DATABASE . "; charset=utf8mb4";
    private $options = [
        \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
        \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        \PDO::ATTR_EMULATE_PREPARES => false
    ];


    public function connect(){
        return new \PDO($this->connectionString, USER, PASSWORD, $this->options);
    }
}
