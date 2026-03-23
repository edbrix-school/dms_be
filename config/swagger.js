/**
 * Swagger/OpenAPI 3.0 specification for DMS API
 */
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DMS API",
      version: "1.0.0",
      description: "Document Management System API with Alfresco integration",
    },
    servers: [
      { url: "http://localhost:5001", description: "Development server" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token from /api/auth/login",
        },
      },
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            code: { type: "integer", example: 200 },
            message: { type: "string", nullable: true },
            data: {},
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            code: { type: "integer" },
            message: { type: "string", nullable: true },
            error: {},
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "user@example.com" },
            password: { type: "string", example: "password123" },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            code: { type: "integer" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/User" },
                token: { type: "string", description: "JWT token" },
              },
            },
          },
        },
        User: {
          type: "object",
          properties: {
            user_id: { type: "integer" },
            email: { type: "string" },
            role_id: { type: "integer" },
            blocked: { type: "boolean" },
          },
        },
        Category: {
          type: "object",
          properties: {
            category_id: { type: "integer" },
            name: { type: "string" },
            parent_id: { type: "integer", nullable: true },
          },
        },
        TagMaster: {
          type: "object",
          properties: {
            tag_id: { type: "integer" },
            name: { type: "string" },
            created_at: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        Document: {
          type: "object",
          properties: {
            document_id: { type: "integer" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            tags: { type: "string", nullable: true },
            category_id: { type: "integer", nullable: true },
            created_by: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
            document_files: { type: "array", items: { type: "object" } },
          },
        },
        DocumentListResult: {
          type: "object",
          properties: {
            rows: { type: "array", items: { $ref: "#/components/schemas/Document" } },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        },
        SearchRequest: {
          type: "object",
          properties: {
            search_text: { type: "string" },
            category_id: { type: "integer", nullable: true },
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
          },
        },
      },
    },
    tags: [
      { name: "Health", description: "Health check" },
      { name: "Auth", description: "Authentication" },
      { name: "Users", description: "Current user" },
      { name: "Categories", description: "Document categories" },
      { name: "Tags master", description: "dms_tags_master reference tags" },
      { name: "Documents", description: "Documents and files" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          description: "Returns API health status.",
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { status: { type: "string", example: "ok" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          description: "Authenticate with email and password. Returns user and JWT token.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            200: { description: "Login successful", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
            401: { description: "Invalid email or password", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "User account is blocked", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/users/me": {
        get: {
          tags: ["Users"],
          summary: "Get current user",
          description: "Returns the authenticated user profile.",
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "User profile", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/categories": {
        get: {
          tags: ["Categories"],
          summary: "List categories",
          description: "Get all categories. Use flat=false for tree structure.",
          parameters: [
            { name: "flat", in: "query", schema: { type: "boolean", default: true }, description: "If false, returns nested tree" },
          ],
          responses: {
            200: { description: "List of categories", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          },
        },
        post: {
          tags: ["Categories"],
          summary: "Create category",
          description: "Create a new category. Requires authentication.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    parent_id: { type: "integer", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Category created", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/categories/{id}": {
        get: {
          tags: ["Categories"],
          summary: "Get category by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Category", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            404: { description: "Category not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Categories"],
          summary: "Update category",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    parent_id: { type: "integer", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Category updated", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Categories"],
          summary: "Delete category",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Category deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/tags-master": {
        get: {
          tags: ["Tags master"],
          summary: "List tags",
          description: "All rows from dms_tags_master, ordered by name.",
          responses: {
            200: { description: "List of tags", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          },
        },
        post: {
          tags: ["Tags master"],
          summary: "Create tag",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: {
            201: { description: "Tag created", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request (e.g. duplicate name)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/tags-master/{id}": {
        get: {
          tags: ["Tags master"],
          summary: "Get tag by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Tag", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            404: { description: "Tag not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Tags master"],
          summary: "Update tag",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: {
            200: { description: "Tag updated", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Tag not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Tags master"],
          summary: "Delete tag",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Tag deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Tag not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/documents": {
        get: {
          tags: ["Documents"],
          summary: "List documents",
          description: "Paginated list with optional category filter and sorting.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "category_id", in: "query", schema: { type: "integer" } },
            { name: "sort", in: "query", schema: { type: "string", default: "created_at" } },
            { name: "order", in: "query", schema: { type: "string", enum: ["ASC", "DESC"], default: "DESC" } },
          ],
          responses: {
            200: { description: "Paginated documents", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["Documents"],
          summary: "Create document",
          description: "Create document with optional file uploads. Multipart: title (required), files (max 10), cover_image (optional), description, tags, category_id.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    tags: { type: "string" },
                    category_id: { type: "integer" },
                    files: { type: "array", items: { type: "string", format: "binary" } },
                    cover_image: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Document created", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/documents/search": {
        post: {
          tags: ["Documents"],
          summary: "Search documents",
          description: "Full-text search with optional category filter.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchRequest" },
              },
            },
          },
          responses: {
            200: { description: "Search results", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/documents/{id}": {
        get: {
          tags: ["Documents"],
          summary: "Get document by ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Document", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Document not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Documents"],
          summary: "Update document",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    tags: { type: "string" },
                    category_id: { type: "integer", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Document updated", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Documents"],
          summary: "Delete document",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Document deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Document not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/documents/{id}/files/{fileId}/content": {
        get: {
          tags: ["Documents"],
          summary: "Download file content",
          description: "Returns the file binary. Set Authorization header with Bearer token.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "Document ID" },
            { name: "fileId", in: "path", required: true, schema: { type: "integer" }, description: "File ID" },
          ],
          responses: {
            200: { description: "File binary", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "File not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
