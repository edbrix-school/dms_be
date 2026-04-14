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
            category_type_id: { type: "integer", nullable: true },
            module_id: { type: "integer", nullable: true },
            category_type: { $ref: "#/components/schemas/CategoryTypeMaster", nullable: true },
            module: { $ref: "#/components/schemas/ModuleNameMaster", nullable: true },
          },
        },
        CategoryTypeMaster: {
          type: "object",
          properties: {
            category_type_id: { type: "integer" },
            name: { type: "string" },
            created_at: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        ModuleNameMaster: {
          type: "object",
          properties: {
            module_id: { type: "integer" },
            category_type_id: { type: "integer" },
            name: { type: "string" },
            created_at: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time", nullable: true },
            category_type: { $ref: "#/components/schemas/CategoryTypeMaster", nullable: true },
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
        PaginatedCategoryResult: {
          type: "object",
          properties: {
            rows: { type: "array", items: { $ref: "#/components/schemas/Category" } },
            count: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        },
        PaginatedTagMasterResult: {
          type: "object",
          properties: {
            rows: { type: "array", items: { $ref: "#/components/schemas/TagMaster" } },
            count: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        },
        DocumentFile: {
          type: "object",
          properties: {
            document_file_id: { type: "integer" },
            file_name: { type: "string" },
            file_type: { type: "string", description: "File extension" },
            media_type: { type: "string", enum: ["image", "video", "audio", "document", "other"] },
            asset_type: { type: "string", nullable: true },
            file_size: { type: "integer", format: "int64", nullable: true, description: "Bytes" },
            file_id: { type: "string" },
          },
        },
        Document: {
          type: "object",
          properties: {
            document_id: { type: "integer" },
            doc_id: { type: "string", nullable: true, description: "Business document identifier" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            tags: { type: "string", nullable: true },
            category_id: { type: "integer", nullable: true },
            distribution: { type: "string", nullable: true, description: "Team / distribution channel" },
            created_by: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
            documentFiles: { type: "array", items: { $ref: "#/components/schemas/DocumentFile" } },
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
        DocumentStatsBucket: {
          type: "object",
          properties: {
            count: { type: "integer" },
            size_bytes: { type: "string", description: "Total size in bytes (string for large values)" },
            size_gb: { type: "number", description: "Total size in gigabytes (binary GB)" },
          },
        },
        DocumentStatsSummary: {
          type: "object",
          properties: {
            total_assets: { $ref: "#/components/schemas/DocumentStatsBucket" },
            images: { $ref: "#/components/schemas/DocumentStatsBucket" },
            pdfs: { $ref: "#/components/schemas/DocumentStatsBucket" },
            other_files: { $ref: "#/components/schemas/DocumentStatsBucket" },
          },
        },
        DistributionTypeStat: {
          type: "object",
          properties: {
            distribution: { type: "string" },
            type: { type: "string", description: "File media_type (image, video, document, unknown, …)" },
            file_count: { type: "integer" },
            total_size_bytes: { type: "string" },
            total_size_gb: { type: "number" },
          },
        },
        SearchRequest: {
          type: "object",
          description:
            "Combine any filters (AND). With search_text, Alfresco hits are intersected with DB filters. You may nest the same keys under search_fields.",
          properties: {
            search_text: { type: "string", description: "Full-text via Alfresco (optional)" },
            title: { type: "string", description: "Partial match on document title" },
            description: { type: "string" },
            tags: { type: "string" },
            distribution: { type: "string", description: "Partial match on team / distribution" },
            doc_id: { type: "string", description: "Single business document identifier filter" },
            doc_ids: {
              type: "array",
              items: { type: "string" },
              description: "Multiple business document identifiers (exact-match, OR within this array)",
            },
            category_id: { type: "integer", nullable: true },
            created_by: { type: "integer", nullable: true },
            media_type: { type: "string", enum: ["image", "video", "audio", "document", "other"] },
            asset_type: { type: "string", description: "Partial match on file asset_type" },
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
            search_fields: {
              type: "object",
              description: "Alternative: same keys as above nested in one object",
              additionalProperties: true,
            },
          },
        },
      },
    },
    tags: [
      { name: "Health", description: "Health check" },
      { name: "Auth", description: "Authentication" },
      { name: "Users", description: "Current user" },
      { name: "Categories", description: "Document categories" },
      { name: "Category types", description: "Category type master data" },
      { name: "Module names", description: "Module name master data" },
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
          description: "Get categories. `flat=false` returns tree; pagination (`page`, `limit`) applies only to flat responses.",
          parameters: [
            { name: "flat", in: "query", schema: { type: "boolean", default: true }, description: "If false, returns nested tree" },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page number for flat mode" },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page size for flat mode" },
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
                    description: { type: "string", nullable: true },
                    sort_order: { type: "integer", nullable: true },
                    parent_id: { type: "integer", nullable: true },
                    category_type_id: { type: "integer", nullable: true },
                    module_id: { type: "integer", nullable: true },
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
                    description: { type: "string", nullable: true },
                    sort_order: { type: "integer", nullable: true },
                    parent_id: { type: "integer", nullable: true },
                    category_type_id: { type: "integer", nullable: true },
                    module_id: { type: "integer", nullable: true },
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
      "/api/category-types": {
        get: {
          tags: ["Category types"],
          summary: "List category types",
          description: "All rows from category type master. Supports optional pagination.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page number" },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page size" },
          ],
          responses: {
            200: { description: "Category type rows", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          },
        },
        post: {
          tags: ["Category types"],
          summary: "Create category type",
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
            201: { description: "Category type created", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/category-types/{id}": {
        get: {
          tags: ["Category types"],
          summary: "Get category type by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Category type", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            404: { description: "Category type not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Category types"],
          summary: "Update category type",
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
            200: { description: "Category type updated", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Category types"],
          summary: "Delete category type",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Category type deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Category type not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/module-names": {
        get: {
          tags: ["Module names"],
          summary: "List module names",
          description: "All rows from module name master. Supports optional pagination and category type filtering.",
          parameters: [
            { name: "category_type_id", in: "query", schema: { type: "integer" }, description: "Optional category type filter" },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page number" },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page size" },
          ],
          responses: {
            200: { description: "Module name rows", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          },
        },
        post: {
          tags: ["Module names"],
          summary: "Create module name",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "category_type_id"],
                  properties: {
                    name: { type: "string" },
                    category_type_id: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Module name created", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/module-names/{id}": {
        get: {
          tags: ["Module names"],
          summary: "Get module name by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Module name", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            404: { description: "Module name not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Module names"],
          summary: "Update module name",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "category_type_id"],
                  properties: {
                    name: { type: "string" },
                    category_type_id: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Module name updated", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Module names"],
          summary: "Delete module name",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "Module name deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Module name not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/tags-master": {
        get: {
          tags: ["Tags master"],
          summary: "List tags",
          description: "All rows from dms_tags_master. Supports optional pagination.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page number" },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1 }, description: "Page size" },
          ],
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
          description:
            "Multipart: title (required), files (max 10), cover_image (optional). distribution = uploading team. Per file: media_type inferred from MIME/extension, or override with file_media_types JSON array. asset_type: single asset_type or JSON file_asset_types array aligned with files order.",
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
                    doc_id: { type: "string", description: "Business document identifier" },
                    tags: { type: "string" },
                    category_id: { type: "integer" },
                    distribution: { type: "string", description: "Team / distribution" },
                    asset_type: { type: "string", description: "Default asset type for all uploaded files" },
                    file_asset_types: { type: "string", description: 'JSON array, e.g. ["Brochure","Video"] per file order' },
                    file_media_types: { type: "string", description: 'JSON array overriding media_type per file: image|video|audio|document|other' },
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
          description:
            "Filter by multiple DB fields (AND). Optional search_text queries Alfresco; results are intersected with DB filters. Empty body lists by category_id only if provided, else all (paginated).",
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
      "/api/documents/stats/summary": {
        get: {
          tags: ["Documents"],
          summary: "File statistics summary",
          description:
            "Counts and total sizes (bytes + GB) for all files, images (media_type or image extensions), PDFs (extension pdf), and all other files. Mutually exclusive buckets.",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Aggregated stats",
              content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } },
            },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/documents/stats/by-distribution": {
        get: {
          tags: ["Documents"],
          summary: "Files by distribution and type",
          description:
            "Per document `distribution` (team) and per-file `media_type`, returns file count and total size. Empty distribution shown as (Unassigned); missing media_type as unknown.",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Array of breakdown rows in data",
              content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } },
            },
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
                    doc_id: { type: "string", nullable: true },
                    tags: { type: "string" },
                    category_id: { type: "integer", nullable: true },
                    distribution: { type: "string", nullable: true },
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
