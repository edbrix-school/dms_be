require("dotenv").config();
require("./models"); // set Document-Category association

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const tagMasterRoutes = require("./routes/tagMasterRoutes");
const categoryTypeMasterRoutes = require("./routes/categoryTypeMasterRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

const allowedOrigins = [
  process.env.CLIENT_DEV_URL,
  process.env.CLIENT_QA_URL,
  process.env.CLIENT_UAT_URL,
  process.env.CLIENT_LOCAL_URL,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(bodyParser.json({ limit: "50mb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tags-master", tagMasterRoutes);
app.use("/api/category-types", categoryTypeMasterRoutes);
app.use("/api/users", userRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`DMS API running on port ${PORT}`);
});