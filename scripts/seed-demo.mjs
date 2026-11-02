/**
 * Demo data for the two-sided flow. Safe to run more than once: it only adds
 * rows that do not exist yet.
 *
 *   npm run db:seed
 *
 * Demo logins (password `demo1234`):
 *   alex@demo.local   owner  (lost items)
 *   jamie@demo.local  finder (found items)
 *   staff@demo.local  staff  (claim queue)
 * Admin: admin@school.edu / admin123
 */
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "lost_and_found_db",
  dateStrings: true,
});

const PASSWORD = "demo1234";

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function ensureUser(fullName, email, roleId, userType, password = PASSWORD) {
  const [rows] = await conn.query("SELECT user_id FROM users WHERE email = ?", [email]);
  if (rows.length) return rows[0].user_id;
  const hash = await bcrypt.hash(password, 10);
  const [result] = await conn.query(
    `INSERT INTO users (role_id, user_type, full_name, email, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [roleId, userType, fullName, email, hash]
  );
  console.log(`  + user ${email}`);
  return Number(result.insertId);
}

async function ensureDepartment(name, code) {
  const [rows] = await conn.query(
    "SELECT department_id FROM department WHERE department_name = ?",
    [name]
  );
  if (rows.length) return rows[0].department_id;
  const [result] = await conn.query(
    "INSERT INTO department (department_name, department_code) VALUES (?, ?)",
    [name, code]
  );
  return Number(result.insertId);
}

async function ensureLocation(name, type, building, room) {
  const [rows] = await conn.query(
    "SELECT location_id FROM location WHERE location_name = ?",
    [name]
  );
  if (rows.length) return rows[0].location_id;
  const [result] = await conn.query(
    `INSERT INTO location (location_name, location_type, building, room)
     VALUES (?, ?, ?, ?)`,
    [name, type, building, room]
  );
  return Number(result.insertId);
}

async function categoryId(name) {
  const [rows] = await conn.query(
    "SELECT category_id FROM category WHERE category_name = ?",
    [name]
  );
  if (rows.length) return rows[0].category_id;
  const [result] = await conn.query(
    "INSERT INTO category (category_name) VALUES (?)",
    [name]
  );
  return Number(result.insertId);
}

async function insertItem({
  categoryId,
  title,
  description,
  brand,
  color,
  dateFound,
  locationText,
  reportedBy,
  responseTo,
}) {
  const temp = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [result] = await conn.query(
    `INSERT INTO item
       (item_code, category_id, found_location_id, found_location_text, storage_location_id,
        reported_by, response_to_lost_report_id, title, description, brand, color,
        date_found, status, is_valuable)
     VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'found', 0)`,
    [
      temp,
      categoryId,
      locationText,
      reportedBy,
      responseTo ?? null,
      title,
      description ?? null,
      brand ?? null,
      color ?? null,
      dateFound,
    ]
  );
  const id = Number(result.insertId);
  const code = `LF-${dateFound.slice(0, 4)}-${String(id).padStart(4, "0")}`;
  await conn.query("UPDATE item SET item_code = ? WHERE item_id = ?", [code, id]);
  await conn.query(
    `INSERT INTO item_status_history (item_id, changed_by, old_status, new_status, remarks)
     VALUES (?, ?, NULL, 'found', 'Reported found by finder')`,
    [id, reportedBy]
  );
  return { id, code };
}

try {
  console.log("\nSeeding demo data…");

  await ensureDepartment("College of Engineering", "COE");
  await ensureDepartment("College of Arts and Sciences", "CAS");
  await ensureDepartment("College of Education", "CED");
  await ensureDepartment("College of Business", "CBA");
  await ensureDepartment("Senior High School", "SHS");

  for (const [name, type, building, room] of [
    ["Main Gate", "found_spot", "Main", null],
    ["Library", "found_spot", "Library", null],
    ["Cafeteria", "found_spot", "Canteen", null],
    ["Gymnasium", "found_spot", "Gym", null],
    ["Guard House", "storage", "Main", "Cabinet A"],
    ["Discipline Office", "storage", "Admin", "Vault"],
  ]) {
    await ensureLocation(name, type, building, room);
  }

  const alex = await ensureUser("Alex Rivera", "alex@demo.local", 3, "student");
  const jamie = await ensureUser("Jamie Cruz", "jamie@demo.local", 3, "student");
  const staff = await ensureUser("Sam Dela Cruz", "staff@demo.local", 2, "staff");
  await ensureUser("System Admin", "admin@school.edu", 1, "staff", "admin123");

  const calculator = await categoryId("Calculator");
  const bag = await categoryId("Bag");

  const [existing] = await conn.query(
    "SELECT lost_report_id FROM lost_report WHERE title = ?",
    ["Black Casio fx-991EX calculator"]
  );

  if (existing.length === 0) {
    const [calcReport] = await conn.query(
      `INSERT INTO lost_report
         (user_id, category_id, title, description, brand, color, last_seen_location, date_lost, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        alex,
        calculator,
        "Black Casio fx-991EX calculator",
        "Small crack on the back and my initials A.R. in silver marker near the battery cover.",
        "Casio",
        "black",
        "CL7",
        isoDaysAgo(3),
      ]
    );
    const calcReportId = Number(calcReport.insertId);

    const [bagReport] = await conn.query(
      `INSERT INTO lost_report
         (user_id, category_id, title, description, brand, color, last_seen_location, date_lost, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        alex,
        bag,
        "Navy Jansport backpack",
        "Has a small red carabiner on the zipper and a yellow notebook inside.",
        "Jansport",
        "navy blue",
        "Library 2nd floor",
        isoDaysAgo(1),
      ]
    );

    const calcItem = await insertItem({
      categoryId: calculator,
      title: "Scientific calculator with a cracked back",
      description:
        "Black Casio. The back cover has a crack and someone wrote initials on it. Found between the armchairs.",
      brand: "Casio",
      color: "black",
      dateFound: isoDaysAgo(2),
      locationText: "CL7, between the armchairs",
      reportedBy: jamie,
      responseTo: calcReportId,
    });

    await insertItem({
      categoryId: bag,
      title: "Navy backpack left near the library",
      description:
        "Navy blue Jansport backpack with a red carabiner on the zipper. Turned in after closing time.",
      brand: "Jansport",
      color: "navy blue",
      dateFound: isoDaysAgo(0),
      locationText: "Library 2nd floor, reading area",
      reportedBy: jamie,
    });

    await conn.query(
      `INSERT INTO post_message (lost_report_id, sender_id, body, linked_item_id)
       VALUES (?, ?, ?, ?)`,
      [
        calcReportId,
        jamie,
        "I found this in CL7 after our class. The back is cracked and there are initials on it — is this yours?",
        calcItem.id,
      ]
    );
    await conn.query(
      "UPDATE lost_report SET status = 'matched' WHERE lost_report_id = ?",
      [calcReportId]
    );
    await conn.query(
      `INSERT INTO notification
         (user_id, notification_type, message, related_item_id, related_lost_report_id)
       VALUES (?, 'new_message', ?, ?, ?)`,
      [
        alex,
        `Jamie Cruz replied to "Black Casio fx-991EX calculator" and linked a found item.`,
        calcItem.id,
        calcReportId,
      ]
    );

    console.log("  + demo lost posts and found items");
    console.log(
      `  + conversation on lost report #${calcReportId} with item ${calcItem.code}`
    );
    void bagReport;
  } else {
    console.log("  · demo lost posts already exist");
  }

  console.log(`\nDone. Demo password: ${PASSWORD}`);
  console.log("  alex@demo.local   (owner)");
  console.log("  jamie@demo.local  (finder)");
  console.log("  staff@demo.local  (staff)");
  console.log("  admin@school.edu  / admin123 (admin)");
  console.log("");
} catch (err) {
  console.error("\nSeed failed:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
