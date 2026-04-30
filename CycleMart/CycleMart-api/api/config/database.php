<?php


date_default_timezone_set("Asia/Manila");


set_time_limit(1000);


// Local development
define("SERVER", "localhost");
define("DATABASE", "cyclemart");
define("USER", "root");
define("PASSWORD", "");
define("DRIVER", "mysql");

// Production - Hostinger
// IMPORTANT: Use localhost for same-server connections on Hostinger
// External host (auth-db2054.hstgr.io) is for remote connections only
// define("SERVER", "localhost");
// define("DATABASE", "u385622194_cyclemart");
// define("USER", "u385622194_cyclemart_db");
// define("PASSWORD", "Cyclemart123#");
// define("DRIVER", "mysql");

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
