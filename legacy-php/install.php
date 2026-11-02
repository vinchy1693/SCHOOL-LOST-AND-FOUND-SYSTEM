<?php
// Run once in the browser: http://localhost/lostfound/install.php  (then delete this file)
require __DIR__ . '/config.php';
$pdo = db();
$out = [];
if (!$pdo->query('SELECT COUNT(*) FROM department')->fetchColumn()) {
    $pdo->exec("INSERT INTO department (department_name, department_code) VALUES
      ('College of Engineering','COE'),('College of Arts and Sciences','CAS'),
      ('College of Education','CED'),('College of Business','CBA'),('Senior High School','SHS')");
    $out[] = 'Departments added.';
}
if (!$pdo->query('SELECT COUNT(*) FROM location')->fetchColumn()) {
    $pdo->exec("INSERT INTO location (location_name, location_type, building, room) VALUES
      ('Main Gate','found_spot','Main',NULL),('Library','found_spot','Library',NULL),
      ('Cafeteria','found_spot','Canteen',NULL),('Gymnasium','found_spot','Gym',NULL),
      ('Classroom','found_spot',NULL,NULL),('Hallway','found_spot',NULL,NULL),
      ('Guard House','storage','Main','Cabinet A'),('Discipline Office','storage','Admin','Vault')");
    $out[] = 'Locations added.';
}
if (!$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn()) {
    $st = $pdo->prepare('INSERT INTO users (role_id,user_type,full_name,email,password_hash) VALUES (?,?,?,?,?)');
    $st->execute([1, 'staff', 'System Admin', 'admin@school.edu', password_hash('admin123', PASSWORD_DEFAULT)]);
    $st->execute([2, 'staff', 'Guard Staff', 'staff@school.edu', password_hash('staff123', PASSWORD_DEFAULT)]);
    $out[] = 'Accounts created: admin@school.edu / admin123 and staff@school.edu / staff123 (change these!).';
}
echo '<pre>' . ($out ? implode("\n", $out) : 'Already installed.') . "\n\nDelete install.php now.</pre>";
