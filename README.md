# TaskFlow API

A small REST API for managing projects and tasks. Users register and log in, create projects, add other users as members, and create tasks inside a project. Built with NestJS and PostgreSQL, using plain SQL.

## What you need

- Node.js (tested on v24)
- PostgreSQL (tested on 16), installed and running. On a Mac with Homebrew:

  ```bash
  brew install postgresql@16
  brew services start postgresql@16
  ```

  On other systems, download it from https://www.postgresql.org/download/

## Setup

1. Install the packages:

   ```bash
   npm install  
   OR
   npm i 
   ```

2. Create the database and its tables:

   ```bash
   createdb taskflow_api_dev
   psql -d taskflow_api_dev -f db/schema.sql
   ```

3. Copy `.env.example` to `.env` and fill it in:

   ```bash
   cp .env.example .env
   ```

   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your-postgres-user
   DB_PASSWORD=
   DB_NAME=taskflow_api_dev
   JWT_SECRET=any-long-random-text
   JWT_EXPIRES_IN=1h
   PORT=3010
   ```

   Leave `DB_PASSWORD` empty if your Postgres user has no password.

## Run

```bash
npm run start:dev
```

The API is now at `http://localhost:3010`.

## Tests

The tests use their own database. Create it once:

```bash
createdb taskflow_api_test
psql -d taskflow_api_test -f db/schema.sql
```

Then:

```bash
npm test             # unit tests
npm run test:e2e     # end-to-end tests
npm run test:cov     # all tests, with a coverage report
```

The end-to-end tests **empty** `taskflow_api_test` every time they start, and they refuse to run on any other database.

## Using the API

register a user first:

```bash
curl -X POST http://localhost:3010/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Ashmit", "email": "ashmit@example.com", "password": "password123"}'
```

Then log in to get a token:

```bash
curl -X POST http://localhost:3010/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ashmit@example.com", "password": "password123"}'
```

Send it in a header on every request except register and login:

```
Authorization: Bearer <token>
```

### Endpoints

| Method | URL | Who can use it | What it does |
|---|---|---|---|
| POST | `/users` | anyone | register |
| POST | `/users/login` | anyone | log in, get a token |
| POST | `/projects` | logged-in user | create a project (you become its owner) |
| GET | `/projects` | logged-in user | list your projects |
| GET | `/projects/:id` | project members | get one project |
| PATCH | `/projects/:id` | project owner | update a project |
| DELETE | `/projects/:id` | project owner | delete a project and its tasks |
| POST | `/projects/:id/members` | project owner | add a member by email |
| GET | `/projects/:id/members` | project members | list members |
| DELETE | `/projects/:id/members/:memberId` | project owner | remove a member |
| POST | `/projects/:projectId/tasks` | project members | create a task |
| GET | `/projects/:projectId/tasks` | project members | list tasks |
| GET | `/projects/:projectId/tasks/:taskId` | project members | get one task |
| PATCH | `/projects/:projectId/tasks/:taskId` | project members | update a task |
| DELETE | `/projects/:projectId/tasks/:taskId` | task creator or project owner | delete a task |

### What to send

- **Register:** `name`, `email`, `password` (at least 8 characters)
- **Log in:** `email`, `password`
- **Project:** `name`, and optionally `description` and `deadline` (for example `2026-12-31`)
- **Add member:** `email`
- **Task:** `title`, `priority` (`low`, `medium` or `high`), and optionally `description`, `status` (`todo`, `in_progress` or `done`; the default is `todo`), `due_date` and `assignee_id` (the assignee must be a member of the project)

When you update a project or a task, send only the fields you want to change. Send `"assignee_id": null` to un-assign a task.
