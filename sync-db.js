/**
 * Sync PostgreSQL tables (create if not exist) and seed default data.
 * Prerequisites: PostgreSQL running, database exists (e.g. CREATE DATABASE dms;).
 * Usage: node sync-db.js
 * Env: DB_HOST, DB_PORT (default 5432), DB_NAME, DB_USER, DB_PASSWORD
 */
require("dotenv").config();
const db = require("./config/db");

const Role = require("./models/role");
const User = require("./models/user");
const Category = require("./models/category");
const Document = require("./models/document");
const DocumentFile = require("./models/documentFile");
const TagMaster = require("./models/tagMaster");

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@dms.local";
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";

async function sync() {
  const sequelize = db.sequelize;
  try {
    await sequelize.sync({ alter: false });
    console.log("PostgreSQL tables synced (all dms_* tables).");

    const bcrypt = require("bcrypt");
    const t = await sequelize.transaction();
    try {
      const [role] = await Role.findOrCreate({
        where: { name: "Admin" },
        defaults: { name: "Admin" },
        transaction: t,
      });

      const existing = await User.findOne({
        where: { email: DEFAULT_ADMIN_EMAIL },
        transaction: t,
      });

      if (!existing) {
        await User.create(
          {
            email: DEFAULT_ADMIN_EMAIL,
            password_hash: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
            first_name: "Admin",
            last_name: "User",
            role_id: role.role_id,
            is_blocked: false,
          },
          { transaction: t }
        );
        console.log(`Default admin user created: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
      } else {
        console.log(`Admin user already exists (${DEFAULT_ADMIN_EMAIL}), skipping user seed.`);
      }

      await t.commit();
    } catch (seedErr) {
      await t.rollback();
      throw seedErr;
    }

    process.exit(0);
  } catch (err) {
    console.error("Sync failed:", err);
    process.exit(1);
  }
}

sync();
