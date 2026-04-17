/**
 * Sync PostgreSQL schema and seed data.
 *
 * Prerequisites: PostgreSQL running; database exists (CREATE DATABASE dms;).
 *
 * Usage:
 *   npm run sync-db
 *   node sync-db.js
 *
 * Env:
 *   DB_HOST, DB_PORT (default 5432), DB_NAME, DB_USER, DB_PASSWORD
 *   DB_SYNC_ALTER=true  — align existing tables with models (adds columns; use once after schema changes, not for every prod deploy)
 *   SEED_SAMPLE_DATA=false — skip demo categories, tags, documents, demo user (default: true)
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 *   SEED_DEMO_EMAIL, SEED_DEMO_PASSWORD (defaults: demo@dms.local / demo123)
 */
require("dotenv").config();

require("./models");
const { Role, User, Category, Document, TagMaster, CategoryTypeMaster } = require("./models");
const db = require("./config/db");

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@dms.local";
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL || "demo@dms.local";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo123";

const useAlter = process.env.DB_SYNC_ALTER === "true";
const seedSample = process.env.SEED_SAMPLE_DATA !== "false";

const CATEGORY_SAMPLES = [
  { name: "General", description: "General documents", parent_id: null, sort_order: 0 },
  { name: "Legal", description: "Contracts and compliance", parent_id: null, sort_order: 1 },
  { name: "Marketing", description: "Campaigns and brand assets", parent_id: null, sort_order: 2 },
];

const TAG_SAMPLES = ["Confidential", "Public", "Draft", "Archived", "Q1-2026"];
const CATEGORY_TYPE_SAMPLES = ["Policy", "Product"];

async function seedCore(t, bcrypt) {
  const [adminRole] = await Role.findOrCreate({
    where: { name: "Admin" },
    defaults: { name: "Admin" },
    transaction: t,
  });

  const [editorRole] = await Role.findOrCreate({
    where: { name: "Editor" },
    defaults: { name: "Editor" },
    transaction: t,
  });

  let admin = await User.findOne({ where: { email: DEFAULT_ADMIN_EMAIL }, transaction: t });
  if (!admin) {
    admin = await User.create(
      {
        email: DEFAULT_ADMIN_EMAIL,
        password_hash: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
        first_name: "Admin",
        last_name: "User",
        role_id: adminRole.role_id,
        is_blocked: false,
      },
      { transaction: t }
    );
    console.log(`Admin user created: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
  } else {
    console.log(`Admin user exists: ${DEFAULT_ADMIN_EMAIL}`);
  }

  return { admin, adminRole, editorRole };
}

async function seedSampleData(t, bcrypt, admin) {
  const categoryTypeByName = {};
  for (const name of CATEGORY_TYPE_SAMPLES) {
    const [row] = await CategoryTypeMaster.findOrCreate({
      where: { name },
      defaults: { name },
      transaction: t,
    });
    categoryTypeByName[name] = row;
  }
  console.log(`Category types seeded (${CATEGORY_TYPE_SAMPLES.length} rows).`);

  const defaultCategoryType = categoryTypeByName.Policy || null;

  for (const c of CATEGORY_SAMPLES) {
    await Category.findOrCreate({
      where: { name: c.name },
      defaults: {
        ...c,
        category_type_id: defaultCategoryType ? defaultCategoryType.category_type_id : null,
      },
      transaction: t,
    });
  }
  console.log(`Categories seeded (${CATEGORY_SAMPLES.length} roots).`);

  for (const name of TAG_SAMPLES) {
    await TagMaster.findOrCreate({
      where: { name },
      defaults: { name },
      transaction: t,
    });
  }
  console.log(`Tag master seeded (${TAG_SAMPLES.length} tags).`);

  const demo = await User.findOne({ where: { email: DEMO_EMAIL }, transaction: t });
  const editorRole = await Role.findOne({ where: { name: "Editor" }, transaction: t });
  if (!demo && editorRole) {
    await User.create(
      {
        email: DEMO_EMAIL,
        password_hash: await bcrypt.hash(DEMO_PASSWORD, 10),
        first_name: "Demo",
        last_name: "Editor",
        role_id: editorRole.role_id,
        is_blocked: false,
      },
      { transaction: t }
    );
    console.log(`Demo user created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else if (demo) {
    console.log(`Demo user exists: ${DEMO_EMAIL}`);
  }

  const legal = await Category.findOne({ where: { name: "Legal" }, transaction: t });
  const marketing = await Category.findOne({ where: { name: "Marketing" }, transaction: t });

  const docSeeds = [
    {
      title: "[Sample] Employee handbook summary",
      description: "Demo document for search and list views (no files attached).",
      tags: "hr, policy, sample",
      category_id: legal ? legal.category_id : null,
      created_by: admin.user_id,
      distribution: "Human Resources",
    },
    {
      title: "[Sample] Brand guidelines 2026",
      description: "Placeholder marketing metadata.",
      tags: "brand, marketing",
      category_id: marketing ? marketing.category_id : null,
      created_by: admin.user_id,
      distribution: "Marketing",
    },
    {
      title: "[Sample] Quarterly compliance checklist",
      description: "Use for testing filters: distribution, tags, category.",
      tags: "compliance, quarterly",
      category_id: legal ? legal.category_id : null,
      created_by: admin.user_id,
      distribution: "Compliance",
    },
  ];

  for (const d of docSeeds) {
    const [row, created] = await Document.findOrCreate({
      where: { title: d.title },
      defaults: d,
      transaction: t,
    });
    if (created) {
      console.log(`Sample document created: ${row.title}`);
    }
  }
}

async function sync() {
  const sequelize = db.sequelize;
  try {
    await sequelize.sync({ alter: useAlter });
    console.log(
      useAlter
        ? "PostgreSQL sync complete (alter=true: schema aligned with models)."
        : "PostgreSQL sync complete (alter=false: new tables only). Set DB_SYNC_ALTER=true once if columns are missing."
    );

    const bcrypt = require("bcrypt");
    const t = await sequelize.transaction();
    try {
      const { admin } = await seedCore(t, bcrypt);

      if (seedSample) {
        await seedSampleData(t, bcrypt, admin);
        console.log("Sample data seed finished.");
      } else {
        console.log("SEED_SAMPLE_DATA=false — skipped categories, tags, documents, demo user.");
      }

      await t.commit();
    } catch (seedErr) {
      await t.rollback();
      throw seedErr;
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error("Sync failed:", err);
    try {
      await db.sequelize.close();
    } catch (_) {}
    process.exit(1);
  }
}

sync();
