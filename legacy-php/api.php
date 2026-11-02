<?php
// Lost & Found JSON API — all requests: api.php?a=<action>
session_start();
require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = $_POST;
$a = $_GET['a'] ?? '';

function out($d = ['ok' => true]) { echo json_encode($d); exit; }
function fail($m, $c = 400) { http_response_code($c); echo json_encode(['error' => $m]); exit; }
function val($k, $def = null) { global $in; $v = $in[$k] ?? $def; return is_string($v) ? trim($v) : $v; }
function req($k) { $v = val($k); if ($v === null || $v === '') fail("Missing field: $k"); return $v; }
function q($sql, $p = []) { $s = db()->prepare($sql); $s->execute($p); return $s; }
function me() {
    static $u = false;
    if ($u === false) {
        $u = null;
        if (!empty($_SESSION['uid'])) {
            $u = q('SELECT user_id,role_id,full_name,email,user_type,id_number,is_active FROM users WHERE user_id=?', [$_SESSION['uid']])->fetch() ?: null;
            if ($u && !$u['is_active']) $u = null;
        }
    }
    return $u;
}
function need($max = 3) { $u = me(); if (!$u) fail('Please log in.', 401); if ($u['role_id'] > $max) fail('Not allowed.', 403); return $u; }
function notify($uid, $type, $msg, $item = null, $claim = null) {
    q('INSERT INTO notification (user_id,notification_type,message,related_item_id,related_claim_id) VALUES (?,?,?,?,?)', [$uid, $type, $msg, $item, $claim]);
}
function set_status($id, $new, $uid, $remarks = null) {
    $old = q('SELECT status FROM item WHERE item_id=?', [$id])->fetchColumn();
    if ($old === false) fail('Item not found.', 404);
    q('UPDATE item SET status=? WHERE item_id=?', [$new, $id]);
    q('INSERT INTO item_status_history (item_id,changed_by,old_status,new_status,remarks) VALUES (?,?,?,?,?)', [$id, $uid, $old, $new, $remarks]);
}
function save_image($itemId) {
    if (empty($_FILES['image']['tmp_name']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) return;
    $f = $_FILES['image'];
    if ($f['size'] > 3 * 1024 * 1024) fail('Image must be under 3 MB.');
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'][mime_content_type($f['tmp_name'])] ?? null;
    if (!$ext) fail('Only JPG, PNG, WEBP or GIF images are allowed.');
    $name = bin2hex(random_bytes(8)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], __DIR__ . '/uploads/' . $name)) fail('Could not save image.');
    q('INSERT INTO item_image (item_id,file_path,is_primary) VALUES (?,?,1)', [$itemId, 'uploads/' . $name]);
}

const ITEM_SQL = "SELECT i.*, c.category_name, fl.location_name AS found_location, sl.location_name AS storage_location,
  (SELECT file_path FROM item_image WHERE item_id=i.item_id ORDER BY is_primary DESC, item_image_id LIMIT 1) AS image
  FROM item i JOIN category c ON c.category_id=i.category_id
  JOIN location fl ON fl.location_id=i.found_location_id
  LEFT JOIN location sl ON sl.location_id=i.storage_location_id";

function public_item($r) {   // hide details that let someone fake a claim
    unset($r['found_id_number'], $r['reported_by']);
    if ($r['is_valuable']) { $r['description'] = null; $r['brand'] = null; $r['color'] = null; }
    return $r;
}

try { switch ($a) {

// ---------- auth ----------
case 'register':
    $pw = req('password');
    if (strlen($pw) < 6) fail('Password must be at least 6 characters.');
    if (!filter_var(req('email'), FILTER_VALIDATE_EMAIL)) fail('Invalid email.');
    $type = in_array(val('user_type'), ['student', 'faculty', 'staff', 'guest']) ? val('user_type') : 'student';
    q('INSERT INTO users (role_id,department_id,user_type,id_number,full_name,email,phone,password_hash,year_level) VALUES (3,?,?,?,?,?,?,?,?)',
      [val('department_id') ?: null, $type, val('id_number') ?: null, req('full_name'), req('email'), val('phone') ?: null, password_hash($pw, PASSWORD_DEFAULT), val('year_level') ?: null]);
    $_SESSION['uid'] = db()->lastInsertId();
    out(['user' => me()]);

case 'login':
    $u = q('SELECT * FROM users WHERE email=?', [req('email')])->fetch();
    if (!$u || !password_verify(req('password'), $u['password_hash'])) fail('Wrong email or password.', 401);
    if (!$u['is_active']) fail('This account is disabled.', 403);
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['user_id'];
    out(['user' => me()]);

case 'logout': session_destroy(); out();
case 'me': out(['user' => me()]);

case 'meta':
    out([
        'categories' => q('SELECT * FROM category ORDER BY category_name')->fetchAll(),
        'locations' => q('SELECT * FROM location ORDER BY location_name')->fetchAll(),
        'departments' => q('SELECT * FROM department ORDER BY department_name')->fetchAll(),
    ]);

// ---------- found items ----------
case 'items':
    $u = need(); $staff = $u['role_id'] <= 2;
    $w = []; $p = [];
    if (!$staff) $w[] = "i.status IN ('found','in_storage')";
    elseif (val('status') || ($_GET['status'] ?? '')) { $w[] = 'i.status=?'; $p[] = $_GET['status'] ?? val('status'); }
    if (!empty($_GET['category'])) { $w[] = 'i.category_id=?'; $p[] = $_GET['category']; }
    if (!empty($_GET['q'])) {
        $w[] = '(i.title LIKE ? OR i.description LIKE ? OR i.brand LIKE ? OR i.color LIKE ? OR i.item_code LIKE ?)';
        for ($k = 0; $k < 5; $k++) $p[] = '%' . $_GET['q'] . '%';
    }
    $rows = q(ITEM_SQL . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY i.date_found DESC, i.item_id DESC LIMIT 200', $p)->fetchAll();
    out(['items' => $staff ? $rows : array_map('public_item', $rows)]);

case 'item_get':
    $u = need(); $staff = $u['role_id'] <= 2;
    $r = q(ITEM_SQL . ' WHERE i.item_id=?', [req('id')])->fetch() ?: fail('Item not found.', 404);
    if (!$staff) { if (!in_array($r['status'], ['found', 'in_storage'])) fail('Item not available.', 404); $r = public_item($r); }
    else $r['history'] = q('SELECT h.*, u.full_name FROM item_status_history h JOIN users u ON u.user_id=h.changed_by WHERE item_id=? ORDER BY changed_at DESC, item_status_history_id DESC', [$r['item_id']])->fetchAll();
    out(['item' => $r]);

case 'item_create':
    $u = need(2);
    $st = val('storage_location_id') ? 'in_storage' : 'found';
    db()->beginTransaction();
    q('INSERT INTO item (item_code,category_id,found_location_id,storage_location_id,reported_by,title,description,brand,color,found_id_number,date_found,status,is_valuable)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uniqid('T'), req('category_id'), req('found_location_id'), val('storage_location_id') ?: null, $u['user_id'], req('title'), val('description') ?: null,
       val('brand') ?: null, val('color') ?: null, val('found_id_number') ?: null, req('date_found'), $st, val('is_valuable') ? 1 : 0]);
    $id = db()->lastInsertId();
    q('UPDATE item SET item_code=? WHERE item_id=?', [sprintf('LF-%s-%04d', date('Y'), $id), $id]);
    q('INSERT INTO item_status_history (item_id,changed_by,old_status,new_status,remarks) VALUES (?,?,NULL,?,?)', [$id, $u['user_id'], $st, 'Item logged']);
    save_image($id);
    // tell people who reported a lost item in the same category
    $cat = req('category_id');
    foreach (q("SELECT DISTINCT user_id FROM lost_report WHERE status='open' AND category_id=?", [$cat])->fetchAll() as $r)
        notify($r['user_id'], 'item_found', 'A "' . req('title') . '" was turned in. It may be yours — check the Found Items list.', $id);
    db()->commit();
    out(['item_id' => $id]);

case 'item_update':
    $u = need(2);
    $it = q('SELECT status FROM item WHERE item_id=?', [req('item_id')])->fetch() ?: fail('Item not found.', 404);
    if (!in_array($it['status'], ['found', 'in_storage'])) fail('This item is already ' . $it['status'] . '.');
    $loc = val('storage_location_id') ?: null;
    q('UPDATE item SET storage_location_id=? WHERE item_id=?', [$loc, req('item_id')]);
    $new = $loc ? 'in_storage' : 'found';
    if ($new !== $it['status']) set_status(req('item_id'), $new, $u['user_id'], val('remarks'));
    out();

case 'disposal_create':
    $u = need(2);
    $m = req('disposal_method');
    if (!in_array($m, ['donated', 'recycled', 'discarded'])) fail('Bad method.');
    $it = q('SELECT status FROM item WHERE item_id=?', [req('item_id')])->fetch() ?: fail('Item not found.', 404);
    if (!in_array($it['status'], ['found', 'in_storage'])) fail('Only unclaimed items can be disposed.');
    db()->beginTransaction();
    q('INSERT INTO disposal (item_id,approved_by,disposal_method,donated_to,remarks) VALUES (?,?,?,?,?)', [req('item_id'), $u['user_id'], $m, val('donated_to') ?: null, val('remarks') ?: null]);
    set_status(req('item_id'), 'disposed', $u['user_id'], 'Disposed: ' . $m);
    db()->commit();
    out();

// ---------- lost reports ----------
case 'lost_create':
    $u = need();
    q('INSERT INTO lost_report (user_id,category_id,title,description,brand,color,last_seen_location,date_lost) VALUES (?,?,?,?,?,?,?,?)',
      [$u['user_id'], req('category_id'), req('title'), val('description') ?: null, val('brand') ?: null, val('color') ?: null, val('last_seen_location') ?: null, req('date_lost')]);
    out(['id' => db()->lastInsertId()]);

case 'lost_mine':
    $u = need();
    out(['reports' => q('SELECT r.*, c.category_name FROM lost_report r JOIN category c ON c.category_id=r.category_id WHERE r.user_id=? ORDER BY r.created_at DESC', [$u['user_id']])->fetchAll()]);

case 'lost_close':
    $u = need();
    q("UPDATE lost_report SET status='closed' WHERE lost_report_id=? AND user_id=?", [req('id'), $u['user_id']]);
    out();

case 'lost_all':
    need(2);
    out(['reports' => q('SELECT r.*, c.category_name, u.full_name, u.email FROM lost_report r JOIN category c ON c.category_id=r.category_id JOIN users u ON u.user_id=r.user_id ORDER BY FIELD(r.status,"open","matched","closed"), r.created_at DESC LIMIT 200')->fetchAll()]);

case 'match_suggest':
    need(2);
    $r = q('SELECT * FROM lost_report WHERE lost_report_id=?', [req('id')])->fetch() ?: fail('Report not found.', 404);
    $words = array_filter(preg_split('/\W+/', strtolower($r['title'] . ' ' . $r['description'])), fn($w) => strlen($w) > 2);
    $res = [];
    foreach (q("SELECT i.*, c.category_name, m.match_status FROM item i JOIN category c ON c.category_id=i.category_id
                LEFT JOIN item_match m ON m.item_id=i.item_id AND m.lost_report_id=? WHERE i.status IN ('found','in_storage') AND i.date_found>=?", [$r['lost_report_id'], $r['date_lost']])->fetchAll() as $i) {
        $s = 0;
        if ($i['category_id'] == $r['category_id']) $s += 40;
        if ($r['color'] && $i['color'] && strcasecmp($r['color'], $i['color']) === 0) $s += 20;
        if ($r['brand'] && $i['brand'] && strcasecmp($r['brand'], $i['brand']) === 0) $s += 20;
        $hay = strtolower($i['title'] . ' ' . $i['description']);
        $hit = 0; foreach ($words as $w) if (strpos($hay, $w) !== false) $hit++;
        $s += $words ? min(20, round(20 * $hit / count($words))) : 0;
        if ($s >= 40) $res[] = ['item_id' => $i['item_id'], 'item_code' => $i['item_code'], 'title' => $i['title'], 'category_name' => $i['category_name'], 'color' => $i['color'], 'brand' => $i['brand'], 'date_found' => $i['date_found'], 'score' => $s, 'match_status' => $i['match_status']];
    }
    usort($res, fn($x, $y) => $y['score'] <=> $x['score']);
    out(['matches' => array_slice($res, 0, 8)]);

case 'match_confirm':
    $u = need(2);
    $r = q('SELECT * FROM lost_report WHERE lost_report_id=?', [req('lost_report_id')])->fetch() ?: fail('Report not found.', 404);
    q("INSERT INTO item_match (lost_report_id,item_id,matched_by,match_score,match_status) VALUES (?,?,?,?,'confirmed')
       ON DUPLICATE KEY UPDATE match_status='confirmed', matched_by=VALUES(matched_by), match_score=VALUES(match_score)", [$r['lost_report_id'], req('item_id'), $u['user_id'], val('score')]);
    q("UPDATE lost_report SET status='matched' WHERE lost_report_id=? AND status='open'", [$r['lost_report_id']]);
    notify($r['user_id'], 'match_found', 'Staff matched your lost "' . $r['title'] . '" with a found item. Open it in Found Items and submit a claim.', req('item_id'));
    out();

// ---------- claims ----------
case 'claim_create':
    $u = need();
    $it = q('SELECT item_id,status,title FROM item WHERE item_id=?', [req('item_id')])->fetch() ?: fail('Item not found.', 404);
    if (!in_array($it['status'], ['found', 'in_storage'])) fail('This item can no longer be claimed.');
    if (q("SELECT 1 FROM claim WHERE item_id=? AND claimant_id=? AND claim_status IN ('pending','approved')", [$it['item_id'], $u['user_id']])->fetch()) fail('You already have an active claim on this item.');
    $lr = val('lost_report_id') ?: null;
    if ($lr && !q('SELECT 1 FROM lost_report WHERE lost_report_id=? AND user_id=?', [$lr, $u['user_id']])->fetch()) $lr = null;
    db()->beginTransaction();
    q('INSERT INTO claim (item_id,claimant_id,lost_report_id,description_provided) VALUES (?,?,?,?)', [$it['item_id'], $u['user_id'], $lr, req('description_provided')]);
    $cid = db()->lastInsertId();
    if (val('evidence_details')) q('INSERT INTO claim_evidence (claim_id,evidence_type,details) VALUES (?,?,?)',
        [$cid, in_array(val('evidence_type'), ['photo', 'receipt', 'id', 'serial_number', 'other']) ? val('evidence_type') : 'other', val('evidence_details')]);
    foreach (q('SELECT user_id FROM users WHERE role_id<=2 AND is_active=1')->fetchAll() as $s)
        notify($s['user_id'], 'general', $u['full_name'] . ' submitted a claim for "' . $it['title'] . '".', $it['item_id'], $cid);
    db()->commit();
    out(['claim_id' => $cid]);

case 'claims':
    $u = need(); $staff = $u['role_id'] <= 2;
    $w = $staff ? '1=1' : 'cl.claimant_id=' . (int)$u['user_id'];
    $p = [];
    if ($staff && !empty($_GET['status'])) { $w .= ' AND cl.claim_status=?'; $p[] = $_GET['status']; }
    $rows = q("SELECT cl.*, i.item_code, i.title AS item_title, i.status AS item_status, i.found_id_number, u.full_name AS claimant_name, u.id_number AS claimant_id_number, u.email AS claimant_email,
               r.received_by_name, r.returned_at
               FROM claim cl JOIN item i ON i.item_id=cl.item_id JOIN users u ON u.user_id=cl.claimant_id
               LEFT JOIN item_return r ON r.claim_id=cl.claim_id WHERE $w ORDER BY cl.created_at DESC LIMIT 200", $p)->fetchAll();
    foreach ($rows as &$c) {
        $c['evidence'] = q('SELECT evidence_type,details FROM claim_evidence WHERE claim_id=?', [$c['claim_id']])->fetchAll();
        if (!$staff) unset($c['found_id_number']);
    }
    out(['claims' => $rows]);

case 'claim_review':
    $u = need(2);
    $c = q('SELECT cl.*, i.title, i.status AS istatus FROM claim cl JOIN item i ON i.item_id=cl.item_id WHERE claim_id=?', [req('claim_id')])->fetch() ?: fail('Claim not found.', 404);
    if ($c['claim_status'] !== 'pending') fail('Claim was already reviewed.');
    $d = req('decision');
    if (!in_array($d, ['approved', 'rejected'])) fail('Bad decision.');
    db()->beginTransaction();
    if ($d === 'approved') {
        if (!in_array($c['istatus'], ['found', 'in_storage'])) fail('Item is no longer available.');
        set_status($c['item_id'], 'claimed', $u['user_id'], 'Claim #' . $c['claim_id'] . ' approved');
    }
    q('UPDATE claim SET claim_status=?, reviewed_by=?, reviewed_at=NOW(), remarks=? WHERE claim_id=?', [$d, $u['user_id'], val('remarks') ?: null, $c['claim_id']]);
    notify($c['claimant_id'], 'claim_update', $d === 'approved'
        ? 'Your claim for "' . $c['title'] . '" was approved. Bring a valid ID to the office to receive it.'
        : 'Your claim for "' . $c['title'] . '" was rejected.' . (val('remarks') ? ' Reason: ' . val('remarks') : ''), $c['item_id'], $c['claim_id']);
    db()->commit();
    out();

case 'claim_release':
    $u = need(2);
    $c = q('SELECT cl.*, i.title FROM claim cl JOIN item i ON i.item_id=cl.item_id WHERE claim_id=?', [req('claim_id')])->fetch() ?: fail('Claim not found.', 404);
    if ($c['claim_status'] !== 'approved') fail('Only approved claims can be released.');
    if (q('SELECT 1 FROM item_return WHERE claim_id=?', [$c['claim_id']])->fetch()) fail('Already released.');
    db()->beginTransaction();
    q('INSERT INTO item_return (claim_id,released_by,received_by_name,id_presented) VALUES (?,?,?,?)', [$c['claim_id'], $u['user_id'], req('received_by_name'), req('id_presented')]);
    set_status($c['item_id'], 'returned', $u['user_id'], 'Released to ' . req('received_by_name'));
    if ($c['lost_report_id']) q("UPDATE lost_report SET status='closed' WHERE lost_report_id=?", [$c['lost_report_id']]);
    notify($c['claimant_id'], 'item_returned', 'Your "' . $c['title'] . '" has been released to you. Glad it found its way home!', $c['item_id'], $c['claim_id']);
    db()->commit();
    out();

// ---------- notifications ----------
case 'notifs':
    $u = need();
    out(['notifications' => q('SELECT * FROM notification WHERE user_id=? ORDER BY sent_at DESC, notification_id DESC LIMIT 50', [$u['user_id']])->fetchAll(),
         'unread' => (int)q('SELECT COUNT(*) FROM notification WHERE user_id=? AND is_read=0', [$u['user_id']])->fetchColumn()]);

case 'notif_read':
    $u = need();
    q('UPDATE notification SET is_read=1 WHERE user_id=?' . (val('id') ? ' AND notification_id=' . (int)val('id') : ''), [$u['user_id']]);
    out();

// ---------- staff dashboard ----------
case 'stats':
    need(2);
    $by = q('SELECT status, COUNT(*) n FROM item GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
    out(['items' => $by,
         'pending_claims' => (int)q("SELECT COUNT(*) FROM claim WHERE claim_status='pending'")->fetchColumn(),
         'awaiting_release' => (int)q("SELECT COUNT(*) FROM claim cl LEFT JOIN item_return r ON r.claim_id=cl.claim_id WHERE cl.claim_status='approved' AND r.claim_id IS NULL")->fetchColumn(),
         'open_reports' => (int)q("SELECT COUNT(*) FROM lost_report WHERE status='open'")->fetchColumn(),
         'users' => (int)q('SELECT COUNT(*) FROM users')->fetchColumn(),
         'recent' => q('SELECT h.new_status, h.changed_at, i.title, i.item_code, u.full_name FROM item_status_history h JOIN item i ON i.item_id=h.item_id JOIN users u ON u.user_id=h.changed_by ORDER BY h.changed_at DESC, h.item_status_history_id DESC LIMIT 8')->fetchAll()]);

// ---------- admin ----------
case 'users':
    need(1);
    out(['users' => q('SELECT u.user_id,u.full_name,u.email,u.id_number,u.user_type,u.role_id,u.is_active,u.created_at,d.department_code FROM users u LEFT JOIN department d ON d.department_id=u.department_id ORDER BY u.created_at DESC')->fetchAll()]);

case 'user_update':
    $u = need(1);
    if ($u['user_id'] == req('user_id')) fail("You can't change your own role or status.");
    q('UPDATE users SET role_id=?, is_active=? WHERE user_id=?', [req('role_id'), val('is_active') ? 1 : 0, req('user_id')]);
    out();

case 'lookup_save': case 'lookup_delete':
    need(1);
    $cfg = ['category' => ['category_id', ['category_name', 'description']],
            'location' => ['location_id', ['location_name', 'location_type', 'building', 'room']],
            'department' => ['department_id', ['department_name', 'department_code']]];
    $t = req('table'); if (!isset($cfg[$t])) fail('Bad table.');
    [$pk, $cols] = $cfg[$t];
    if ($a === 'lookup_delete') {
        try { q("DELETE FROM `$t` WHERE `$pk`=?", [req('id')]); } catch (PDOException $e) { fail('It is still in use and cannot be deleted.'); }
        out();
    }
    $vals = array_map(fn($c) => val($c) === '' ? null : val($c), $cols);
    if (!$vals[0]) fail('Name is required.');
    if (val('id')) q("UPDATE `$t` SET " . implode(',', array_map(fn($c) => "`$c`=?", $cols)) . " WHERE `$pk`=?", [...$vals, val('id')]);
    else q("INSERT INTO `$t` (" . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', $vals);
    out();

default: fail('Unknown action.', 404);
} } catch (PDOException $e) {
    if (db()->inTransaction()) db()->rollBack();
    if ($e->getCode() == 23000) fail('That email or ID number is already registered.');
    fail('Database error: ' . $e->getMessage(), 500);
}
