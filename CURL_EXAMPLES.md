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

### POST /api/documents – Create document (with optional file upload)

```bash
# JSON only (no files)
curl -X POST "http://localhost:5001/api/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"My Document\",\"description\":\"Optional description\",\"tags\":\"tag1,tag2\",\"category_id\":1}"

# With file upload (multipart)
curl -X POST "http://localhost:5001/api/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=My Document" \
  -F "description=Optional description" \
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

```bash
curl -X POST "http://localhost:5001/api/documents/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"search_text\":\"keyword\",\"category_id\":1,\"page\":1,\"limit\":20}"
```

### PUT /api/documents/:id – Update document

```bash
curl -X PUT "http://localhost:5001/api/documents/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Updated Title\",\"description\":\"Updated description\",\"tags\":\"new,tags\",\"category_id\":2}"
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
| POST | /api/documents | Yes | Create document |
| POST | /api/documents/search | Yes | Search documents |
| GET | /api/documents/:id | Yes | Get document |
| GET | /api/documents/:id/files/:fileId/content | Yes | Download file |
| PUT | /api/documents/:id | Yes | Update document |
| DELETE | /api/documents/:id | Yes | Delete document |

**Swagger UI:** Open `http://localhost:5001/api-docs` in a browser to explore and try the API interactively.
