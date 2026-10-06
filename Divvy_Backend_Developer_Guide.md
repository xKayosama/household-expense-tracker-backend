Divvy

Backend Developer Guide

Onboarding, architecture, API map, business rules, and maintenance notes

Source reviewed: current backend source (updated for the Group refactor)
Guide generated from the actual backend source code • September 2026

# 1. Purpose and Scope

This guide is the handoff document for developers maintaining or extending the HomeSplit backend. It describes the current implementation as found in the uploaded source archive, rather than an idealized architecture. Use it as the starting point before changing routes, models, authentication, expense splitting, bills, balances, settlements, or dashboard behavior.

# 2. Technology Stack

| Area | Current choice | Notes |
| --- | --- | --- |
| Runtime | Node.js | CommonJS modules (`type: commonjs`). |
| Web framework | Express 5.2.1 | JSON REST API; CORS enabled globally. |
| Database | MongoDB + Mongoose 9.9.4 | Connection uses `MONGO_URI`. |
| Authentication | JWT + bcryptjs | Bearer tokens; passwords hashed with bcrypt cost 12. |
| Token logout | RevokedToken collection | Submitted token is SHA-256 hashed and stored until JWT expiry. |
| Dev server | nodemon | `npm run dev` starts `server.js`. |
| Tests | Node test runner | `npm test` → `node --test`; current README mentions auth tests. |

# 3. Quick Start

Prerequisites: Node.js, npm, and a reachable MongoDB instance (local MongoDB or Atlas).

```text
npm install

# Create .env in the project root
MONGO_URI=mongodb://127.0.0.1:27017/homesplit
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
PORT=5000

npm run dev
```

Verify the API:

```text
GET http://localhost:5000/api/health

Expected:
{
  "success": true,
  "message": "Divvy API is running"
}
```

Production-style start:

```text
npm start
```

# 4. Project Structure

```text
server.js
src/
  app.js
  config/database.js
  modules/
    auth/          # routes, controller, middleware, JWT, revocation
    users/User.js
    groups/        # Group.js, GroupMember.js, group.controller.js,
                   # group.routes.js, groupAccess.middleware.js
    expenses/      # routes, controller, Expense.js
    bills/         # routes, controller, Bill.js
    balances/      # routes, controller
    settlements/   # routes, controller
    dashboard/     # routes, controller
scripts/migrate-groups.js
test/
  auth.test.js
  groups.test.js
```

`server.js` loads environment variables, connects to MongoDB, then starts Express. `src/app.js` owns middleware and route mounting. Controllers contain validation and business logic; Mongoose models define persistence rules.

# 5. Request Lifecycle and Access Control

- Public authentication endpoints register and log users in.

- Protected routes use `protect`, which requires `Authorization: Bearer <token>`.

- `protect` verifies the JWT, checks whether its hash is in `RevokedToken`, loads the user, and attaches `req.user` plus token metadata.

- Group-scoped routes additionally use `groupAccess`. It verifies the group exists and that the authenticated user has an ACTIVE GroupMember record.

- Owner-only operations are enforced inside group controller methods, not through a separate owner middleware.

# 6. Authentication

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /api/auth/register | No | Create a user account. |
| POST | /api/auth/login | No | Authenticate and return JWT + user. |
| POST | /api/auth/logout | Bearer | Revoke only the submitted token. |
| GET | /api/auth/me | Bearer | Return the current authenticated user. |

Registration requires `firstName`, `lastName`, `email`, and `password`. Login requires email and password. Email lookup is case-normalized to lowercase.

```text
Authorization: Bearer <token>
```

Logout is server-enforced: the token hash is persisted in MongoDB and checked on every protected request. The RevokedToken schema uses a TTL index (`expiresAt`) so revoked records expire automatically when the JWT would have expired.

# 7. API Route Map

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | /api/groups | Bearer | Create group |
| GET | /api/groups | Bearer | List active groups for current user |
| GET | /api/groups/:id | Bearer + member | Group details + members |
| PUT | /api/groups/:id | Bearer + owner | Update name/currency |
| DELETE | /api/groups/:id | Bearer + owner | Delete group and related memberships, expenses, bills |
| POST | /api/groups/:id/members | Bearer + owner | Add existing user by email |
| GET | /api/groups/:id/members | Bearer + member | List active members |
| DELETE | /api/groups/:id/members/:userId | Bearer + owner | Remove member |
| POST | /api/groups/:id/expenses | Bearer + member | Create expense |
| GET | /api/groups/:id/expenses | Bearer + member | Paginated/filterable expense list |
| GET | /api/expenses/:expenseId | Bearer | Get one expense; controller verifies group membership |
| PUT | /api/expenses/:expenseId | Bearer | Update one expense; controller verifies group membership |
| DELETE | /api/expenses/:expenseId | Bearer | Delete one expense; controller verifies group membership |
| POST | /api/groups/:id/bills | Bearer + member | Create bill |
| GET | /api/groups/:id/bills | Bearer + member | Paginated/filterable bill list |
| GET | /api/bills/:billId | Bearer | Get one bill; controller verifies group membership |
| PUT | /api/bills/:billId | Bearer | Update one bill; controller verifies group membership |
| DELETE | /api/bills/:billId | Bearer | Delete one bill; controller verifies group membership |
| GET | /api/groups/:id/balances | Bearer + member | Calculate paid/owed/net per active member |
| GET | /api/groups/:id/settlements | Bearer + member | Generate suggested debtor → creditor payments |
| GET | /api/groups/:id/dashboard | Bearer + member | Dashboard summary, balances, bill summary, recent expenses, upcoming bills |

# 8. Expense Domain Rules

Expenses are the core shared-cost record. A payer must be an active member of the group, every participant must be an active member, and duplicate participants are rejected.

| Split type | Behavior |
| --- | --- |
| EQUAL | Divides to two decimal places. Any remainder is added to the first participant. |
| EXACT | Each participant supplies an amount. Rounded participant amounts must exactly equal the expense amount. |
| PERCENTAGE | Each participant supplies 0–100%. Percentages must total 100%; rounding difference is applied to the last participant. |

Expense categories:

```text
FOOD | RENT | UTILITIES | INTERNET | TRANSPORTATION | GROCERIES | HEALTHCARE | ENTERTAINMENT | SHOPPING | OTHERS
```

List endpoint query parameters include `page`, `limit` (capped at 100), `category`, `startDate`, and `endDate`.

Typical create payload:

```text
{
  "description": "Groceries",
  "amount": 1500,
  "category": "GROCERIES",
  "paidBy": "<userId>",
  "splitType": "EQUAL",
  "participants": [
    { "userId": "<userIdA>" },
    { "userId": "<userIdB>" }
  ],
  "date": "2026-09-10",
  "notes": "Weekly groceries"
}
```

# 9. Bills

Bills represent group obligations and can optionally be recurring. Amount must be greater than zero and `dueDate` must be a valid date. If `paidBy` is supplied, that user must be an active group member.

Categories:

```text
RENT | ELECTRICITY | WATER | INTERNET | PHONE | SUBSCRIPTION | INSURANCE | OTHER
```

Statuses and recurrence:

```text
status: PENDING | PAID | OVERDUE
recurrence: MONTHLY | WEEKLY | YEARLY | null
```

- If `isRecurring` is true, a valid recurrence is required.

- If `isRecurring` is false, recurrence must not be provided.

- Bill list filters: `page`, `limit` (max 100), `category`, `status`, `isRecurring=true|false`.

# 10. Data Model Summary

| Model | Important fields / relationships |
| --- | --- |
| User | firstName, lastName, unique lowercase email, password hash, avatar, role USER\|ADMIN\|OWNER |
| Group | name, ownerId → User, currency (default PHP) |
| GroupMember | groupId → Group, userId → User, role OWNER\|MEMBER, status ACTIVE\|INACTIVE, joinedAt |
| Expense | groupId, description, amount, category, paidBy → User, splitType, participants[], date, notes |
| Bill | groupId, name, amount, category, dueDate, recurring fields, paidBy → User\|null, status, notes |
| RevokedToken | tokenHash (unique), expiresAt with TTL expiry |

# 11. Balances, Settlements, and Dashboard

Balance logic treats `paid` as the total amount a member paid for group expenses and `owed` as the sum of that member's participant shares. `net = paid - owed`: positive means the member should receive money; negative means the member owes money.

The settlement endpoint converts those net balances into a simple set of debtor-to-creditor transfers, matching debtors and creditors sequentially and rounding to two decimals.

The dashboard currently loads all active members, all group expenses, and all group bills, then computes totals in application memory. It returns the latest five expenses, up to five future PENDING bills, per-member balances, and counts/amounts for pending, overdue, and paid bills.

# 12. Response and Error Conventions

Most endpoints return `{ success, message, data }`; several newer controllers also include a numeric `code`. Paginated list endpoints return a separate `pagination` object. This is not fully standardized across the codebase.

| HTTP | Typical meaning |
| --- | --- |
| 200 | Successful read/update/delete/logout |
| 201 | Resource created |
| 400 | Invalid request data or business-rule violation |
| 401 | Missing, invalid, expired, or revoked authentication |
| 403 | Authenticated but lacks group/owner access |
| 404 | Resource/user/group not found |
| 409 | Duplicate account or existing membership |
| 500 | Unexpected server/database failure |

# 13. Development Workflow

- Before implementing a feature, identify the model, controller, route, and access-control path it touches.

- Keep group-scoped collection endpoints under `/api/groups/:id/...` and protect them with both `protect` and `groupAccess`.

- For resource-by-ID endpoints, preserve membership verification inside the controller or introduce a reusable resource-access middleware.

- Validate membership whenever a request accepts a user ID as payer or participant.

- Preserve money rounding to two decimals in split/balance/settlement logic; add tests for rounding edge cases.

- Run `npm test` before pushing changes. Add tests for every new validation/business rule.

- When changing response shapes, update the frontend RTK Query types/endpoints in the same change set or coordinate the API contract explicitly.

# 14. Current Technical Notes / Risks

- There is no centralized error-handling middleware; controllers catch and format errors independently.

- Validation is hand-written in controllers. There is no schema-validation layer such as Zod/Joi/express-validator.

- API responses are not fully uniform: some include `code`, some do not.

- The expense and bill routers are mounted both under `/api/groups` and their top-level resource prefixes. Be careful when adding generic route patterns so they do not create accidental paths or conflicts.

- Dashboard calculations currently fetch entire group expense/bill collections into memory. This will become a performance concern for large histories; MongoDB aggregation is a future optimization path.

- Bill `OVERDUE` is stored as a status; the shown dashboard code does not automatically convert past-due PENDING bills to OVERDUE.

- Deleting a group cascades manually to memberships, expenses, and bills. Future group-owned collections must be added to this cleanup path.

- No `.env.example` was present in the reviewed archive. Add one without real secrets to reduce onboarding mistakes.

- The uploaded archive contains `node_modules`; source repositories should normally exclude it and rely on `package-lock.json` + `npm ci`/`npm install`.

# 15. Recommended Next Improvements

| Priority | Improvement | Why |
| --- | --- | --- |
| High | Add `.env.example` and setup checks | Makes onboarding and deployment safer. |
| High | Expand API tests beyond authentication | Protects split logic, permissions, pagination, and deletion behavior. |
| High | Introduce request validation schemas | Reduces repeated validation and inconsistent error shapes. |
| Medium | Centralize error/response formatting | Creates a predictable frontend contract. |
| Medium | Add database indexes | Group/date/category/status queries will benefit as data grows. |
| Medium | Move dashboard/balance calculations to aggregation where needed | Avoids loading full histories into application memory. |
| Medium | Add OpenAPI/Swagger contract | Makes endpoints discoverable and easier to integrate. |
| Low | Split large controllers into services/helpers | Improves testability as domain logic grows. |

# 16. New Developer Checklist

- Install dependencies and configure `.env`.

- Start MongoDB and run `npm run dev`.

- Confirm `/api/health` returns 200.

- Register/login and verify a Bearer token works on `/api/auth/me`.

- Create a group and inspect its owner membership.

- Create EQUAL, EXACT, and PERCENTAGE expenses and verify rounding.

- Create recurring and non-recurring bills.

- Compare balances and settlements after several expenses.

- Run the test suite before modifying behavior.

- Read the relevant controller completely before changing its route or frontend contract.

# 17. Handoff Rule

Treat the backend source code as the source of truth. If this document and the implementation diverge, verify the current controller/model behavior first, then update this guide in the same pull request. Documentation should evolve with API behavior, not after it.

See README.md for the required relationship migration and retained legacy MongoDB collection names. The Word version is a historical archive and has not been updated.
