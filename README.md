# Campus Lost & Found — Next.js edition

A **two-sided** lost-and-found board for a campus. The person who lost an item
posts it; the person who found it files the item and replies on that post with a
link to it. The owner opens the item straight from the reply, claims it, and the
finder (or staff) approves the hand-over.

The previous PHP/vanilla-JS version is preserved in [`legacy-php/`](legacy-php/)
for reference. The app now runs on **Next.js + MySQL**.

---

## The flow, in one picture

```
Owner (Alex)                         Finder (Jamie)
────────────                         ──────────────
1. posts a lost item
   "Black Casio calculator"  ──────▶ 2. sees the post on the board
                                      clicks "I found this item"
                                      files the found item
                                      (pre-linked to Alex's post)
                                            │
3. gets a notification  ◀───────────────────┘
   opens "Messages" / the post
   sees the reply + an item card:
   ┌───────────────────────────────┐
   │ 📦 Scientific calculator      │
   │    LF-2026-0001 · Found       │
   │    open the item →            │
   └───────────────────────────────┘
4. clicks the card → item page → "Submit claim"
                                            │
5. Jamie or staff approves the claim ◀──────┘
6. item is marked "returned"
   (receiver name + ID recorded)
   the lost post closes automatically
```

Key detail requested: the item is **attached to the message**, so the owner never
has to go digging through the Found items page to find out what was found.

---

## What's new compared with the PHP version

| Area | Before | Now |
| --- | --- | --- |
| Filing found items | Staff only | **Any signed-in user** can file a found item, with an optional photo |
| Contact between the two sides | None | **Public replies on the lost post**, with an optional embedded found-item card |
| Item ↔ conversation link | — | `item.response_to_lost_report_id` + `post_message.linked_item_id`; the reply is posted automatically when someone files from a lost post |
| Finder's role | Hand item to staff | Finder can link an item to a lost post, **approve/reject claims** on their item, and **record the hand-over** |
| Inbox | — | **Messages** page with unread badges (per thread) and deep links |
| Claim hand-over | Staff only | Finder **or** staff, with receiver + ID recorded |
| Frontend | HTML/CSS/JS + PHP API | **Next.js App Router**, React Server Components, Server Actions |
| Everything else | — | Staff dashboard, claim queue, matching, disposal, users/categories/locations/departments kept |

---

## Stack

- **Next.js 15.5** (App Router, Server Components, Server Actions)
- React 19 + TypeScript
- **mysql2** (plain SQL, no ORM) on the existing `lost_and_found_db`
- **bcryptjs** password hashing
- HMAC-signed, `HttpOnly` session cookie (no auth library needed)
- Hand-written CSS with light/dark support and a mobile layout
- Playwright (only for the end-to-end check)

---

## Requirements

- Node.js 20.9+ (tested on Node 24)
- MySQL / MariaDB — XAMPP's MySQL is fine (Apache is **not** used by the Next app)
- The `lost_and_found_db` database

---

## Setup

```bash
# 1. install dependencies
npm install

# 2. configure the database + session secret
copy .env.example .env.local     # then edit if your MySQL has a password
#    AUTH_SECRET must be a long random string

# 3. migrate the existing schema (safe to run again)
npm run db:migrate

# 4. optional: demo accounts + sample posts/items
npm run db:seed

# 5. run it
npm run dev
# or a production build:
npm run build
npm start
```

Open **http://localhost:3000**.

> **XAMPP note:** MySQL from XAMPP is still used. Apache is not — the Next.js
> server listens on port 3000. phpMyAdmin at `http://localhost/phpmyadmin` still
> works for inspecting the database. The project's `.htaccess` blocks Apache from
> serving the source tree or `.env.local` and redirects
> `http://localhost/lostfound/` to `http://localhost:3000/`.

### First-time database

If `lost_and_found_db` does not exist yet:

1. Create the database in phpMyAdmin.
2. Import [`legacy-php/database.sql`](legacy-php/database.sql) (the original schema).
3. Run `npm run db:migrate` to add the messaging layer.

---

## Demo accounts

Created by `npm run db:seed` (password is shown per account):

| Email | Password | Role |
| --- | --- | --- |
| `alex@demo.local` | `demo1234` | user (owner of the demo lost posts) |
| `jamie@demo.local` | `demo1234` | user (finder of the demo items) |
| `staff@demo.local` | `demo1234` | staff |
| `admin@school.edu` | `admin123` | admin |

Seeding never changes existing accounts or their passwords.

---

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/feed` | everyone | the lost board: search, filter, open a post |
| `/lost/new` | everyone | report a lost item |
| `/lost/[id]` | everyone | the post + its conversation; reply and attach an existing found item |
| `/lost` | everyone | my lost posts |
| `/items` | everyone | found items; filter, view, claim |
| `/items/new` | everyone | file a found item, optionally linked to a lost post |
| `/items/[id]` | everyone | item detail; claim form; finder/staff claim review + hand-over |
| `/messages` | everyone | conversations grouped by lost post, with unread counts |
| `/notifications` | everyone | deep-linked notifications (message, claim, match, return) |
| `/claims` | everyone | my claims and their status |
| `/dashboard` | staff/admin | counts, recent activity |
| `/dashboard/claims` | staff/admin | review claims, release items |
| `/dashboard/reports` | staff/admin | all lost reports + "Find matches" |
| `/admin/users` | admin | roles and active status |
| `/admin/settings` | admin | categories, locations, departments |

---

## Who can do what

- **Any signed-in user** can report a lost item, file a found item, reply on a
  post, attach an item to a reply, claim an item, and track their claims.
- **The finder** (whoever filed the item) can also:
  - link the item to a lost post (owner gets a message with the item attached),
  - approve or reject claims on that item,
  - record the hand-over (receiver name + ID presented).
- **Staff** can do everything a finder can, for every item, plus the dashboard,
  full claim queue, lost-report matching, storage updates, disposal and history.
- **Admin** additionally manages users, categories, locations and departments.

---

## Database changes

`npm run db:migrate` is idempotent and only adds missing pieces:

- `post_message` — replies on a lost post, with optional `linked_item_id`.
- `lost_report_read` — per-user/per-thread read timestamps for unread badges.
- `item.response_to_lost_report_id` — the found item filed in reply to a post.
- `item.found_location_text` — free-text location for community-filed items.
- `item.found_location_id` — now nullable (community filings do not need a lookup).
- `notification.related_lost_report_id` + `new_message` notification type.

Existing rows (users, lost reports, items, claims) are preserved.

---

## How the two-sided link is enforced

- Filing an item with `response_to_lost_report_id` inserts the item **and** a
  `post_message` row with `linked_item_id = item_id` in one transaction, then
  notifies the owner.
- Replying on a post can attach any active found item; the message renders a
  card with the item code, title, status and photo.
- Staff confirming a match also posts a reply with the item attached, so the
  conversation stays the single place where the owner sees what turned up.
- The item page shows the linked lost post and the full claim thread; the lost
  post shows the item card and the full conversation.

---

## Security notes

- Passwords hashed with bcrypt (cost 10).
- Session cookie: HMAC-SHA256 signed, `HttpOnly`, `SameSite=Lax`, 30 days.
- Every server action re-checks the signed-in user and ownership/permissions;
  finders can only review claims on their own item, and only the finder/staff
  can hand an item over.
- Uploaded photos are validated by magic bytes (JPG/PNG/WEBP/GIF, max 5 MB),
  stored outside the build output in `data/uploads/`, and served through
  `/uploads/[name]` with a strict filename allow-list.
- React escapes all user content; SQL uses prepared statements.
- Valuable items can hide brand/color/description from other users until a claim
  is verified.

---

## Scripts

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build
npm start          # production server on :3000
npm run db:migrate # idempotent schema migration
npm run db:seed    # demo users + sample two-sided conversation
npm run e2e        # Playwright check of the whole flow (run db:seed first)
```

The E2E test drives the real UI: posts a lost item, files the found item from the
post, checks the linked message, claims it, approves it, hands it over, and checks
the staff/admin pages. Screenshots land in `test-results/screens/`.

---

## Project layout

```
src/
  app/
    login, register, feed, lost, items, messages, notifications, claims
    dashboard/ (staff)       admin/ (admin)
    (app)/layout.tsx         signed-in shell + sidebar
    uploads/[name]/route.ts  serves uploaded photos
  components/                sidebar, avatars, badges, item cards, …
  lib/
    db.ts                    mysql2 pool
    auth.ts                  sessions + guards
    queries.ts               read queries
    actions.ts               all server actions
    upload.ts                image validation/storage
    notify.ts                notification helper
scripts/                     migrate, seed, e2e
data/uploads/                uploaded photos (gitignored)
legacy-php/                  previous PHP + vanilla JS app
```

---

## Troubleshooting

- **"Can't reach the server" / DB error page** — start MySQL in the XAMPP
  control panel and check `DB_*` in `.env.local`.
- **Port 3000 already in use** — `npx next start -p 3001` (or `npx next dev -p 3001`).
- **Login immediately bounces back** — `AUTH_SECRET` must be set in `.env.local`.
- **Photos 404** — ensure `data/uploads/` is writable by the Node process; the
  folder is created automatically on the first upload.
- **Old app** — `legacy-php/` is not used at runtime; keep it for reference or
  delete it once you are happy with the rewrite.
