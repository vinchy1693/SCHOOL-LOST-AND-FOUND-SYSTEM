import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { q1 } from "./db";
import type { User } from "./types";

const COOKIE_NAME = "lf_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.AUTH_SECRET || "dev-only-insecure-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: number): Promise<void> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure: (process.env.APP_URL || "").startsWith("https://"),
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [uid, expires, sig] = parts;
  if (!/^\d+$/.test(uid) || !/^\d+$/.test(expires)) return null;
  const expected = sign(`${uid}.${expires}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expires) < Date.now()) return null;

  return q1<User>(
    `SELECT u.user_id, u.role_id, u.department_id, u.user_type, u.id_number, u.full_name,
            u.email, u.phone, u.year_level, u.is_active, u.created_at,
            d.department_name, d.department_code
     FROM users u LEFT JOIN department d ON d.department_id = u.department_id
     WHERE u.user_id = ? AND u.is_active = 1`,
    [Number(uid)]
  );
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (user.role_id > 2) redirect("/feed");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role_id !== 1) redirect("/feed");
  return user;
}

export function isStaff(user: Pick<User, "role_id"> | null | undefined): boolean {
  return !!user && user.role_id <= 2;
}

export function isAdmin(user: Pick<User, "role_id"> | null | undefined): boolean {
  return !!user && user.role_id === 1;
}

export function homeFor(user: Pick<User, "role_id"> | null | undefined): string {
  return isStaff(user) ? "/dashboard" : "/feed";
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export { COOKIE_NAME };
