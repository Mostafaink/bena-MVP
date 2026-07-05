# bena-MVP

Bena MVP — a lightweight Node.js + Express backend with a SQLite database.

## Features

- **User authentication** — register and log in; passwords hashed with bcrypt; stateless JWT sessions
- **Listings CRUD** — create, read, update, and delete marketplace listings
- **Input validation** — powered by `express-validator`
- **SQLite database** — zero-configuration, file-based persistence via `better-sqlite3`

## Getting Started

### Prerequisites

- Node.js ≥ 18

### Install

```bash
npm install
```

### Configure

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable     | Default                          | Description                   |
|--------------|----------------------------------|-------------------------------|
| `PORT`       | `3000`                           | Port the server listens on    |
| `JWT_SECRET` | *(must be set)*                  | Secret used to sign JWT tokens|
| `DB_PATH`    | `bena.db` next to `src/index.js` | Path to the SQLite file       |

### Run

```bash
npm start
```

## API Reference

### Health

| Method | Path      | Auth | Description        |
|--------|-----------|------|--------------------|
| GET    | `/health` | No   | Returns `{status: "ok"}` |

### Auth

| Method | Path                    | Auth | Description                      |
|--------|-------------------------|------|----------------------------------|
| POST   | `/api/auth/register`    | No   | Create account, returns JWT      |
| POST   | `/api/auth/login`       | No   | Log in, returns JWT              |

**Register body:**
```json
{ "name": "Alice", "email": "alice@example.com", "password": "secret123" }
```

**Login body:**
```json
{ "email": "alice@example.com", "password": "secret123" }
```

Both return:
```json
{ "token": "<jwt>", "user": { "id": 1, "name": "Alice", "email": "alice@example.com" } }
```

### Listings

Protected routes require `Authorization: Bearer <token>`.

| Method | Path                  | Auth | Description               |
|--------|-----------------------|------|---------------------------|
| GET    | `/api/listings`       | No   | List all listings          |
| GET    | `/api/listings/:id`   | No   | Get a single listing       |
| POST   | `/api/listings`       | Yes  | Create a listing           |
| PATCH  | `/api/listings/:id`   | Yes  | Update your listing        |
| DELETE | `/api/listings/:id`   | Yes  | Delete your listing        |

**Create / update body fields:**

| Field         | Type   | Required | Notes                    |
|---------------|--------|----------|--------------------------|
| `title`       | string | Yes      | Non-empty                |
| `description` | string | No       | Free text                |
| `price`       | number | Yes      | Non-negative float       |

## Tests

```bash
npm test
```

18 tests cover the health check, auth, and all listing endpoints.

## Database Schema

```sql
users (id, name, email, password, created_at)
listings (id, user_id, title, description, price, created_at, updated_at)
```
