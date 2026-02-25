# Setup Guide (For Colleagues / New Clone or Zip)

If you downloaded the project (zip or clone) and **the app runs but you see no data**, follow this.

## 1. Put `.env` in the **project root**

- The `.env` file must be in the **same folder as `package.json`** (the root of the project), **not** inside `client/`.
- So the structure should look like:
  ```
  machine-management-system-main/
  ├── .env          ← here
  ├── package.json
  ├── client/
  ├── src/
  └── ...
  ```

## 2. Run **both** the backend and the frontend

The UI (React) gets data from the **API server**. If only the frontend is running, there is no API, so you will see no data.

**From the project root**, run:

```bash
npm install
npm run dev
```

This will:

- Start the **API server** on **http://localhost:3000**
- Start the **React app** on **http://localhost:3001**
- The React app is configured to send API requests to port 3000 (via proxy), so data will load only when both are running.

**Wrong:** Only running `cd client && npm start` → no backend → no data.

## 3. `.env` contents (MySQL)

The app uses **MySQL**. Your `.env` in the project root should have at least:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=embroidery_erp

# JWT (use any long random string in production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
```

- If you use the **same database as your colleague** (e.g. a shared server), use the **same** values they use (host, port, user, password, DB name). Ensure your machine is allowed to connect (e.g. firewall / DB user host).
- If you use a **local MySQL** on your machine, create the database (e.g. `embroidery_erp`), run migrations, and optionally seeds:
  ```bash
  npx knex migrate:latest
  npx knex seed:run
  ```
  Otherwise the DB will be empty and you will see no data.

## 4. Quick checklist

| Check | What to do |
|-------|------------|
| `.env` in project root | Move/copy `.env` next to `package.json`, not inside `client/`. |
| Backend running | Run `npm run dev` from root (or start server with `npm run server:dev`). |
| Backend port 3000 | Client proxy points to `http://localhost:3000`. Don’t change server port unless you also set `REACT_APP_API_URL` (see below). |
| DB credentials | Correct `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`. |
| DB has data | If DB is new/empty, run migrations and seeds, or use a DB that already has data. |
| Login | Use valid credentials that exist in the `users` (or auth) table. |

## 5. Optional: Backend on another URL (e.g. another machine)

If the **backend** runs somewhere else (e.g. `http://192.168.1.10:3000` or a deployed URL), create a file in the **client** folder:

**`client/.env`** (or `client/.env.local`):

```env
REACT_APP_API_URL=http://192.168.1.10:3000
```

Replace with your actual backend URL. The client will then use this URL for API calls instead of the proxy. Restart the React app after adding this.

## 6. Still no data?

- Open browser **Developer Tools (F12)** → **Network** tab. Reload the page and check:
  - Are requests to `/api/...` going to the right place (e.g. `localhost:3000` or `REACT_APP_API_URL`)?
  - Do they return **200** with JSON, or **4xx/5xx** or CORS errors?
- Check the **terminal** where the server is running for **database connection** or **API errors**.
- Confirm you are **logged in**; many endpoints require authentication.
