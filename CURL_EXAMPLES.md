# DMS API – cURL Examples

Base URL: `http://localhost:5001` (or set `BASE=http://localhost:5001` and use `$BASE`).

After login, set your token:  
`TOKEN="<token_from_login_response>"`

---

## Health

### GET /health – Health check

```bash
curl -X GET "http://localhost:5001/health"
```

---

## Auth

### POST /api/auth/login – Login

```bash
curl -X POST "http://localhost:5001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"password\":\"password123\"}"
```

---

## Users (require Bearer token)

### GET /api/users/me – Get current user

```bash
curl -X GET "http://localhost:5001/api/users/me" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Categories

### GET /api/categories – List categories

```bash
# Flat list (default)
curl -X GET "http://localhost:5001/api/categories"

# Tree structure
curl -X GET "http://localhost:5001/api/categories?flat=false"
```

### GET /api/categories/:id – Get category by ID

```bash
curl -X GET "http://localhost:5001/api/categories/1"
```

### POST /api/categories – Create category (auth required)

```bash
curl -X POST "http://localhost:5001/api/categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"My Category\"}"
```

### PUT /api/categories/:id – Update category (auth required)

```bash
curl -X PUT "http://localhost:5001/api/categories/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated Category Name\"}"
```

### DELETE /api/categories/:id – Delete category (auth required)

```bash
curl -X DELETE "http://localhost:5001/api/categories/1" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tags master (`dms_tags_master`)

### GET /api/tags-master – List all tags

```bash
curl -X GET "http://localhost:5001/api/tags-master"
```

### GET /api/tags-master/:id – Get tag by ID

```bash
curl -X GET "http://localhost:5001/api/tags-master/1"
```

### POST /api/tags-master – Create tag (auth required)

```bash
curl -X POST "http://localhost:5001/api/tags-master" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Important\"}"
```

### PUT /api/tags-master/:id – Update tag (auth required)

```bash
curl -X PUT "http://localhost:5001/api/tags-master/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated tag name\"}"
```

### DELETE /api/tags-master/:id – Delete tag (auth required)

```bash
curl -X DELETE "http://localhost:5001/api/tags-master/1" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Documents (require Bearer token)

### GET /api/documents – List documents

```bash
# Default pagination
curl -X GET "http://localhost:5001/api/documents" \
  -H "Authorization: Bearer $TOKEN"

# With filters
curl -X GET "http://localhost:5001/api/documents?page=1&limit=10&category_id=1&sort=created_at&order=DESC" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/documents/stats/summary – File counts and sizes (all / images / PDFs / other)

Returns `data.total_assets`, `data.images`, `data.pdfs`, `data.other_files` — each has `count`, `size_bytes`, `size_gb` (binary GB, 1024³).

```bash
curl -X GET "http://localhost:5001/api/documents/stats/summary" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/documents/stats/by-distribution – Files by team (`distribution`) and `media_type`

Returns `data` as an array of `{ distribution, type, file_count, total_size_bytes, total_size_gb }`. `type` is the file’s `media_type` (`unknown` if unset).

```bash
curl -X GET "http://localhost:5001/api/documents/stats/by-distribution" \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/documents – Create document (with optional file upload)

```bash
# JSON only (no files)
curl -X POST "http://localhost:5001/api/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"My Document\",\"description\":\"Optional description\",\"tags\":\"tag1,tag2\",\"category_id\":1,\"distribution\":\"Marketing\"}"

# With file upload (multipart) — distribution = team; asset_type for all files; optional per-file JSON arrays
curl -X POST "http://localhost:5001/api/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=My Document" \
  -F "description=Optional description" \
  -F "distribution=Marketing" \
  -F "asset_type=Product brochure" \
  -F 'file_asset_types=["One-pager","Spec sheet"]' \
  -F "files=@/path/to/file1.pdf" \
  -F "files=@/path/to/file2.docx"
```

### GET /api/documents/:id – Get document by ID

```bash
curl -X GET "http://localhost:5001/api/documents/1" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/documents/:id/files/:fileId/content – Download file content

```bash
curl -X GET "http://localhost:5001/api/documents/1/files/1/content" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded-file.pdf
```

### POST /api/documents/search – Search documents

All filters are combined with **AND**. With `search_text`, Alfresco matches are intersected with the DB filters. Omit criteria to list (with optional `category_id`, `page`, `limit`).

```bash
# Alfresco full-text + DB filters
curl -X POST "http://localhost:5001/api/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"search_text\":\"keyword\",\"title\":\"Report\",\"distribution\":\"Marketing\",\"media_type\":\"image\",\"asset_type\":\"Brochure\",\"category_id\":1,\"created_by\":1,\"page\":1,\"limit\":20}"

# DB-only multi-field (no Alfresco)
curl -X POST "http://localhost:5001/api/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"description\":\"quarterly\",\"tags\":\"finance\",\"distribution\":\"Sales\"}"

# Same fields nested under search_fields
curl -X POST "http://localhost:5001/api/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"search_fields\":{\"title\":\"Budget\",\"category_id\":2}}"
```

### PUT /api/documents/:id – Update document

```bash
curl -X PUT "http://localhost:5001/api/documents/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Updated Title\",\"description\":\"Updated description\",\"tags\":\"new,tags\",\"category_id\":2,\"distribution\":\"Legal\"}"
```

### DELETE /api/documents/:id – Delete document

```bash
curl -X DELETE "http://localhost:5001/api/documents/1" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Quick reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Health check |
| POST | /api/auth/login | No | Login |
| GET | /api/users/me | Yes | Current user |
| GET | /api/categories | No | List categories |
| GET | /api/categories/:id | No | Get category |
| POST | /api/categories | Yes | Create category |
| PUT | /api/categories/:id | Yes | Update category |
| DELETE | /api/categories/:id | Yes | Delete category |
| GET | /api/tags-master | No | List tags (master) |
| GET | /api/tags-master/:id | No | Get tag by ID |
| POST | /api/tags-master | Yes | Create tag |
| PUT | /api/tags-master/:id | Yes | Update tag |
| DELETE | /api/tags-master/:id | Yes | Delete tag |
| GET | /api/documents | Yes | List documents |
| GET | /api/documents/stats/summary | Yes | File counts & sizes (assets, images, PDFs, other) |
| GET | /api/documents/stats/by-distribution | Yes | Files by distribution & media type |
| POST | /api/documents | Yes | Create document |
| POST | /api/documents/search | Yes | Search documents |
| GET | /api/documents/:id | Yes | Get document |
| GET | /api/documents/:id/files/:fileId/content | Yes | Download file |
| PUT | /api/documents/:id | Yes | Update document |
| DELETE | /api/documents/:id | Yes | Delete document |

**Swagger UI:** Open `http://localhost:5001/api-docs` in a browser to explore and try the API interactively.
