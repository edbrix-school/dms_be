# DMS API – Basic Document Management System with Alfresco

Minimal DMS API: documents stored in **Alfresco**, metadata in **MySQL**. Architecture: Route → Service → DAO.

## Prerequisites

- Node.js 18+
- MySQL
- Alfresco (for document storage and search)

## Setup

1. Copy `.env.example` to `.env` and set:
   - `DB_*` – MySQL connection
   - `JWT_SECRET` – secret for JWT
   - `ALFRESCO_URL`, `ALFRESCO_ID`, `ALFRESCO_USERNAME`, `ALFRESCO_PASSWORD`, `ALFRESCO_SEARCH_URL`

2. Create MySQL database:
   ```bash
   mysql -u root -p -e "CREATE DATABASE dms;"
   ```

3. Install and sync DB:
   ```bash
   npm install
   node sync-db.js
   ```
   Default admin user: `admin@dms.local` / `admin123`

4. Start server:
   ```bash
   npm run dev
   ```

## API

- **POST /api/auth/login** – Body: `{ "email", "password" }` → returns `{ user, token }`
- **GET /api/users/me** – (Bearer token) current user
- **GET /api/categories** – list categories
- **POST /api/categories** – (Bearer) create category
- **PUT /api/categories/:id** – (Bearer) update category
- **DELETE /api/categories/:id** – (Bearer) delete category
- **POST /api/documents** – (Bearer) multipart: `files`, optional `cover_image`; body: `title`, `description`, `tags`, `category_id`
- **GET /api/documents** – (Bearer) list; query: `page`, `limit`, `category_id`, `sort`, `order`
- **GET /api/documents/:id** – (Bearer) get document with files metadata
- **GET /api/documents/:id/files/:fileId/content** – (Bearer) download file from Alfresco
- **POST /api/documents/search** – (Bearer) body: `search_text`, `category_id`, `page`, `limit`
- **PUT /api/documents/:id** – (Bearer) update metadata
- **DELETE /api/documents/:id** – (Bearer) delete document and Alfresco nodes

## Project structure

- `config/db.js` – Sequelize (MySQL)
- `models/` – user, role, document, documentFile, category
- `routes/` – auth, documents, categories, users
- `services/` – auth, document, category
- `dao/` – auth, document, category repositories
- `common/alfrescoService.js` – Alfresco upload, download, search, delete
- `middleware/auth.js` – JWT verifyAuth
