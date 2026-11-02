import mysql from "mysql2/promise";
import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";

const globalForDb = globalThis as unknown as { __lfPool?: Pool };

function createPool(): Pool {
  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "lost_and_found_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
    supportBigNumbers: true,
  });
}

export const pool: Pool = globalForDb.__lfPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__lfPool = pool;

/** Run a SELECT and return typed rows. */
export async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** Run a SELECT and return the first row (or null). */
export async function q1<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** Run an INSERT/UPDATE/DELETE. */
export async function run(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const [res] = await pool.query(sql, params);
  return res as ResultSetHeader;
}

/** Run several statements in one transaction. */
export async function withTx<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function isDbDown(err: unknown): boolean {
  const e = err as { code?: string };
  return !!e?.code && ["ECONNREFUSED", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"].includes(e.code);
}
