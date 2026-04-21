# SRS – Technical Details (DMS API)

This document provides technical details derived from the DMS API codebase for inclusion in the Software Requirements Specification (SRS). It also specifies **where roles must be inherited from the ERP system**.

---

## 1. Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| ORM | Sequelize |
| Database | PostgreSQL (configurable via `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`; optional `DB_SSL`, `DB_LOGGING`) |
| Authentication | JWT (Bearer/Token), bcrypt for password hashing |
| File upload | Multer |
| API documentation | OpenAPI 3.0 (Swagger) |
| HTTP client (external) | Axios |

---

## 2. Data Model (Entities)

### 2.1 Core tables

- **`dms_documents`** – Document metadata: `document_id`, `title`, `description`, `tags`, `category_id`, `distribution` (team / distribution), `module_name`, `screen_name`, `created_by`, `updated_by`, `cover_image`, `created_at`, `updated_at`.
- **`dms_document_files`** – File records: `document_file_id`, `document_id`, `file_name`, `file_type` (extension), `media_type` (`image` \| `video` \| `audio` \| `document` \| `other`), `asset_type`, `file_size` (bytes), `file_id` (Alfresco node ID), `folder_id`, `is_private`, `created_at`.
- **`dms_categories`** – Categories: `category_id`, `name`, `description`, `parent_id`, `sort_order`, `created_at`, `updated_at`. Supports hierarchy via `parent_id`.
- **`dms_users`** – Users: `user_id`, `email`, `password_hash`, `first_name`, `last_name`, `role_id`, `is_blocked`, `created_at`, `updated_at`.
- **`dms_roles`** – Roles: `role_id`, `name`. **See Section 6 for ERP role inheritance.**
- **`dms_tags_master`** – Tag master list: `tag_id`, `name`, `created_at`, `updated_at`.

### 2.2 Relationships

- Document **belongs to** User (creator: `created_by`), User (updater: `updated_by`), Category (`category_id`).
- Document **has many** DocumentFile.
- DocumentFile **belongs to** Document.
- User **belongs to** Role (`role_id`).
- Category supports self-reference (parent/children via `parent_id`).

---

## 3. Document Repository (DAO) Behaviour

- **Create:** `createDocument`, `createDocumentFile` – persist document metadata and file records.
- **Read:** `getById` (with optional `includeFiles`), `list` (paginated, filter by `category_id`, sort/order), `getDocumentFileById`, `getDocumentFileByDocumentAndFileId`, `getDocumentFilesByDocumentId`.
- **List by Alfresco IDs:** `getByAlfrescoIds` – given Alfresco node IDs (e.g. from search), returns matching documents with optional `category_id` filter.
- **Update:** `updateDocument` – title, description, tags, category_id, distribution, module_name, screen_name, updated_by.
- **Delete:** `deleteDocument` – deletes all related `DocumentFile` rows then the document.
- **Pagination:** `list` uses `page`, `limit` (max 100), `sort`, `order` (default `created_at` DESC).

---

## 4. External System: Alfresco

- **Purpose:** File storage and full-text search.
- **Storage:** Files uploaded via Multer are sent to Alfresco; DMS stores only metadata and Alfresco node ID (`file_id`) in `dms_document_files`.
- **Operations:** Upload (to configurable parent node), download by node ID, search (TEXT, cm:title, cm:description), delete node.
- **Configuration (env):** `ALFRESCO_URL`, `ALFRESCO_ID` (parent folder), `ALFRESCO_USERNAME`, `ALFRESCO_PASSWORD`, `ALFRESCO_SEARCH_URL`.
- **Search flow:** Client search → Alfresco search returns node IDs → `getByAlfrescoIds` returns DMS documents that reference those IDs.

---

## 5. Authentication and API Security

- **Login:** POST `/api/auth/login` with `email`, `password`. Validates via `authService.login` (bcrypt compare); returns JWT and user payload (excluding password).
- **JWT payload:** `user_id`, `email`, `role_id`; expiry 24h; verified with `JWT_SECRET`.
- **Protected routes:** All document, category, and user APIs use `verifyAuth` middleware (Bearer/Token header). No role-based access control (RBAC) is applied in code today; **role is intended for future use and must be sourced from ERP as per Section 6.**

---

## 6. Role Inheritance from ERP System

**Where to inherit role from ERP**

Roles and permissions for DMS users **SHALL be inherited from the ERP system** rather than from the local `dms_roles` table. The SRS should explicitly state the following.

### 6.1 Points of integration

1. **User authentication / session (login)**  
   - When a user logs in (or when SSO/session is established with ERP), the DMS **SHALL** obtain the user’s **role (and optionally permissions)** from the ERP system.  
   - The role identifier (or equivalent) **SHALL** be stored in the session/JWT (e.g. in the existing `role_id` or a new claim such as `erp_role_code`) so that all subsequent API calls can enforce role-based access without querying ERP on every request.

2. **Authorization (access control)**  
   - Before performing any sensitive operation (e.g. create/update/delete document, manage categories, manage users), the DMS **SHALL** enforce access control based on the **role (and permissions) inherited from ERP**.  
   - The SRS should specify that **role-based authorization** (e.g. “only Document Manager can delete”, “only Admin can manage categories”) is driven by ERP-defined roles, not by the local `dms_roles` table.  
   - The local `dms_roles` table may remain for backward compatibility or mapping (e.g. ERP role code → local `role_id`) but **SHALL NOT** be the system of record for “who can do what.”

3. **User provisioning / sync (optional but recommended)**  
   - If users are provisioned or updated from ERP, the SRS should state that **role_id** (or role information) in DMS user records **SHALL** be synced from ERP (e.g. on login or via a scheduled/sync job) so that reporting and legacy paths remain consistent.

### 6.2 What to state in the SRS

- **Requirement (example):**  
  *“User roles and permissions for the DMS SHALL be inherited from the ERP system. At login (or session establishment), the DMS SHALL retrieve the user’s role from the ERP and embed it in the session token. All authorization decisions (create, update, delete documents; manage categories; manage users) SHALL be based on ERP-inherited roles/permissions. The local `dms_roles` table SHALL NOT be the authority for access control; it may be used only for mapping or caching ERP role information.”*

- **Place in SRS:**  
  - In **Functional Requirements**: under “Authentication” and “Authorization / Access Control.”  
  - In **System Integration**: under “Integration with ERP” (role inheritance as a defined integration point).  
  - In **Data / Security**: clarify that role data is sourced from ERP for access control.

---

## 7. API Summary (for SRS)

- **Documents:** POST (create), GET list (query: page, limit, category_id, sort, order), GET by id, GET file content (`/:id/files/:fileId/content`), POST search, PUT update, DELETE.
- **Categories:** (as per category routes – list/CRUD as implemented.)
- **Auth:** POST `/api/auth/login` (email, password) → JWT + user (with role_id).
- **Responses:** Success/error envelope (e.g. success, code, message, data/error); 401 for missing/invalid token; 403 for blocked user; 422 for validation errors.

---

## 8. Configuration (Environment)

- **Database:** `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.  
- **JWT:** `JWT_SECRET`.  
- **Alfresco:** `ALFRESCO_URL`, `ALFRESCO_ID`, `ALFRESCO_USERNAME`, `ALFRESCO_PASSWORD`, `ALFRESCO_SEARCH_URL`.

---

*This addendum is generated from the current DMS API codebase. Merge the relevant sections into the main SRS and adjust requirement IDs and wording to match your SRS template.*
