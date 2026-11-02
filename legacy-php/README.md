# Campus Lost & Found

Plain HTML/CSS/JS frontend + PHP (PDO) JSON backend on your `lost_and_found_db` schema.

## Setup (XAMPP / any PHP 8 + MySQL/MariaDB)
1. Copy this folder to `htdocs/lostfound/`.
2. In phpMyAdmin, create a database named `lost_and_found_db`, then import `database.sql`.
3. Check DB credentials in `config.php` (defaults: root, no password).
4. Open `http://localhost/lostfound/install.php` once. It seeds departments, locations and two accounts. Then delete `install.php`.
5. Open `http://localhost/lostfound/` and log in.

Default accounts (change them): admin@school.edu / admin123, staff@school.edu / staff123.
Anyone who registers gets the "user" role.

## What each role can do
- User: browse found items, report lost items, submit claims with proof, track claims, notifications.
- Staff: log found items (with photo), set storage, review claims, release items, match lost reports to found items, dispose unclaimed items, dashboard.
- Admin: everything staff can do, plus manage users and roles, categories, locations and departments.

## Notes
- Details of items marked "valuable" are hidden from regular users so claims can be verified.
- Uploaded photos go to `uploads/` (PHP execution is disabled there via .htaccess on Apache).
