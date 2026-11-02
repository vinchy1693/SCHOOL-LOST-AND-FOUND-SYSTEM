/**
 * Idempotent schema migration for the Next.js rewrite.
 * Run with:  npm run db:migrate
 *
 * Adds the two-sided messaging layer and makes found items reportable by
 * regular users, without touching existing rows.
 */
import mysql from "mysql2/promise";

const DB = process.env.DB_NAME || "lost_and_found_db";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: DB,
  multipleStatements: false,
});

const log = [];
const skip = [];

async function hasTable(table) {
  const [r] = await conn.query(
    "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?",
    [DB, table]
  );
  return r.length > 0;
}
async function hasColumn(table, column) {
  const [r] = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?",
    [DB, table, column]
  );
  return r.length > 0;
}
async function hasIndex(table, index) {
  const [r] = await conn.query(
    "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?",
    [DB, table, index]
  );
  return r.length > 0;
}
async function hasForeignKey(table, column) {
  const [r] = await conn.query(
    `SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [DB, table, column]
  );
  return r.length > 0;
}
async function columnType(table, column) {
  const [r] = await conn.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?",
    [DB, table, column]
  );
  return r[0]?.COLUMN_TYPE || "";
}

try {
  // ---------------------------------------------------------------- item
  if (!(await hasColumn("item", "found_location_text"))) {
    await conn.query(
      "ALTER TABLE item ADD COLUMN found_location_text VARCHAR(150) NULL AFTER found_location_id"
    );
    log.push("item.found_location_text added");
  } else skip.push("item.found_location_text already exists");

  if (!(await hasColumn("item", "response_to_lost_report_id"))) {
    await conn.query(
      "ALTER TABLE item ADD COLUMN response_to_lost_report_id INT(11) NULL AFTER reported_by"
    );
    log.push("item.response_to_lost_report_id added");
  } else skip.push("item.response_to_lost_report_id already exists");

  if (!(await hasIndex("item", "idx_item_response_lost"))) {
    await conn.query(
      "ALTER TABLE item ADD KEY idx_item_response_lost (response_to_lost_report_id)"
    );
    log.push("item.response_to_lost_report_id index added");
  }

  if (!(await hasForeignKey("item", "response_to_lost_report_id"))) {
    await conn.query(
      `ALTER TABLE item
         ADD CONSTRAINT fk_item_response_lost
         FOREIGN KEY (response_to_lost_report_id) REFERENCES lost_report (lost_report_id)
         ON DELETE SET NULL ON UPDATE CASCADE`
    );
    log.push("item.response_to_lost_report_id foreign key added");
  }

  // Found items reported by regular users may not pick a managed location.
  const [nullable] = await conn.query(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='item' AND COLUMN_NAME='found_location_id'`,
    [DB]
  );
  if (nullable[0]?.IS_NULLABLE === "NO") {
    await conn.query("ALTER TABLE item MODIFY found_location_id INT(11) NULL");
    log.push("item.found_location_id is now nullable");
  } else skip.push("item.found_location_id already nullable");

  // ------------------------------------------------------- post messages
  if (!(await hasTable("post_message"))) {
    await conn.query(`
      CREATE TABLE post_message (
        message_id INT(11) NOT NULL AUTO_INCREMENT,
        lost_report_id INT(11) NOT NULL,
        sender_id INT(11) NOT NULL,
        body TEXT NOT NULL,
        linked_item_id INT(11) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (message_id),
        KEY idx_pm_report (lost_report_id, created_at),
        KEY fk_pm_sender (sender_id),
        KEY fk_pm_item (linked_item_id),
        CONSTRAINT fk_pm_report FOREIGN KEY (lost_report_id) REFERENCES lost_report (lost_report_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_pm_sender FOREIGN KEY (sender_id) REFERENCES users (user_id)
          ON UPDATE CASCADE,
        CONSTRAINT fk_pm_item FOREIGN KEY (linked_item_id) REFERENCES item (item_id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    log.push("post_message table created");
  } else skip.push("post_message already exists");

  // --------------------------------------------------- read tracking
  if (!(await hasTable("lost_report_read"))) {
    await conn.query(`
      CREATE TABLE lost_report_read (
        lost_report_id INT(11) NOT NULL,
        user_id INT(11) NOT NULL,
        last_read_at DATETIME NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (lost_report_id, user_id),
        KEY fk_lrr_user (user_id),
        CONSTRAINT fk_lrr_report FOREIGN KEY (lost_report_id) REFERENCES lost_report (lost_report_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_lrr_user FOREIGN KEY (user_id) REFERENCES users (user_id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    log.push("lost_report_read table created");
  } else skip.push("lost_report_read already exists");

  // ------------------------------------------------------ notifications
  if (!(await hasColumn("notification", "related_lost_report_id"))) {
    await conn.query(
      "ALTER TABLE notification ADD COLUMN related_lost_report_id INT(11) NULL AFTER related_claim_id"
    );
    log.push("notification.related_lost_report_id added");
  } else skip.push("notification.related_lost_report_id already exists");

  if (!(await hasIndex("notification", "fk_notif_lost"))) {
    await conn.query(
      "ALTER TABLE notification ADD KEY fk_notif_lost (related_lost_report_id)"
    );
    log.push("notification.related_lost_report_id index added");
  }

  if (!(await hasForeignKey("notification", "related_lost_report_id"))) {
    await conn.query(
      `ALTER TABLE notification
         ADD CONSTRAINT fk_notif_lost
         FOREIGN KEY (related_lost_report_id) REFERENCES lost_report (lost_report_id)
         ON DELETE SET NULL ON UPDATE CASCADE`
    );
    log.push("notification.related_lost_report_id foreign key added");
  }

  const ntype = await columnType("notification", "notification_type");
  if (!ntype.includes("new_message")) {
    await conn.query(
      `ALTER TABLE notification MODIFY notification_type
       ENUM('item_found','match_found','claim_update','item_returned','new_message','general')
       NOT NULL DEFAULT 'general'`
    );
    log.push("notification_type extended with new_message");
  } else skip.push("notification_type already extended");

  console.log("\nMigration finished.");
  for (const line of log) console.log("  + " + line);
  for (const line of skip) console.log("  · " + line);
  console.log("");
} catch (err) {
  console.error("\nMigration failed:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
