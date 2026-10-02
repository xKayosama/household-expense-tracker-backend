# group-expense-tracker-backend

Express API backed by MongoDB/Mongoose. Authentication uses JWTs returned by
`POST /api/auth/login`, sent as `Authorization: Bearer <token>` on protected routes.
Tokens expire after `JWT_EXPIRES_IN` (default: `7d`).

## Logout

Send `POST /api/auth/logout` with the current bearer token and no request body.
Success returns HTTP 200:

```json
{ "success": true, "message": "Logout successful." }
```

The frontend should clear its saved token and user state after success and return
to the login screen. Missing, invalid, expired, or already logged-out tokens return
401; clear local authentication state on 401 as well. A 500 response means server
revocation failed, so the client should allow a retry.

Logout revokes only the submitted token. Other sessions remain valid. MongoDB
stores a SHA-256 hash of the revoked token, with a TTL index that removes the
record after token expiration. All protected routes check this collection.
New login tokens have unique IDs so logins in the same second remain independent.
Existing tokens remain supported; identical tokens issued before this change
are revoked together.

Run `npm test` for authentication tests using mocked database operations.

## Module structure

The backend groups code by feature under `src/modules/`. Each feature owns its
routes, controllers, and models where applicable. Controllers currently contain
validation and business logic.

```text
src/
  app.js                      # Express setup and API route mounting
  config/
    database.js               # Shared database connection
  modules/
    auth/                     # Authentication routes, controller, middleware,
                              # revoked tokens, JWT and token hashing helpers
    users/                    # User model
    groups/               # Group routes, controller, models and access middleware
    expenses/                 # Expense routes, controller and model
    bills/                    # Bill routes, controller and model
    balances/                 # Balance routes and controller
    settlements/              # Settlement routes and controller
    dashboard/                # Dashboard routes and controller
server.js                     # Environment loading and server startup
```

Modules import authentication middleware from `modules/auth` and group
access middleware from `modules/groups`. Cross-feature model imports point
to the owning module. Group API URLs and response fields are documented below.

To add a feature, create its folder under `src/modules/`, place its controller,
routes, and any models there, then mount its router in `src/app.js`.

## Group API and database migration

Divvy supports any people sharing expenses. Group and GroupMember retain their
existing fields and rules; removal sets membership status to INACTIVE (not REMOVED).
The optional descriptive Group type was not added.

All previously group-scoped routes now use `/api/groups`: the root and `/:id`
CRUD routes, `/:id/members`, `/:id/members/:userId`, `/:id/expenses`, `/:id/bills`,
`/:id/balances`, `/:id/settlements`, and `/:id/dashboard`. Existing methods,
`:id` parameter names, authentication and status codes are preserved.
`/api/auth`, `/api/expenses/:expenseId` and `/api/bills/:billId` remain unchanged.
The existing dual router mounts are preserved.

Frontend changes: use `/api/groups` instead of `/api/households`; read `data.group`
and `data.groups` instead of `data.household` and `data.households`; use `groupId`
in membership, expense and bill records. Create/update request bodies retain the
same fields; the scoped URL supplies the relationship ID. Error text now says Group.

Group explicitly uses the existing `households` collection; GroupMember uses
`householdmembers`. There is no collection rename, copy, drop or record deletion.
Expense and Bill still use `expenses` and `bills`. IDs, ownership, timestamps,
membership status and all other fields are retained. The relationship field is
renamed from `householdId` to `groupId` in `householdmembers`, `expenses`, and `bills`.

Deploy with a maintenance window:

1. Back up the MongoDB database and stop all API instances and other writers.
2. Configure `MONGO_URI` in `.env` for the intended existing database.
3. Run `npm run migrate:groups -- --dry-run` (also the default without arguments).
4. Run `npm run migrate:groups -- --apply`.
5. Repeat the dry run; every existing affected collection should report zero.
6. Deploy/start this backend and update frontend clients before resuming traffic.

The script uses raw MongoDB updates to preserve timestamps, detects conflicting
old/new IDs across all affected collections before writing, and refuses to overwrite
conflicts. Resolve any conflict using the backup/source of truth before retrying.
Matching duplicate fields are safely normalized. It is idempotent and can resume
after an interrupted run. Updates are atomic per document, not across collections;
keep writers stopped until the full run succeeds. No migration is run automatically
on server startup. Rolling back the application requires restoring the relationship
field names from the backup during another maintenance window.

The repository URLs in package.json retain the real upstream repository name.
The Word developer guide is a historical source-archive document; the Markdown
guide and this README describe the current code.
