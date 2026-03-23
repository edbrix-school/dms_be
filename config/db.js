const { Sequelize } = require("sequelize");
require("dotenv").config();

function buildDialectOptions() {
  const opts = {};
  if (process.env.DB_SSL === "true") {
    opts.ssl = { require: true, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" };
  }
  return Object.keys(opts).length ? opts : undefined;
}

class Database {
  constructor() {
    if (!Database.instance) {
      const port = parseInt(process.env.DB_PORT || "5432", 10);
      const dialectOptions = buildDialectOptions();

      this._sequelize = new Sequelize(
        process.env.DB_NAME || "dms",
        process.env.DB_USER || "postgres",
        process.env.DB_PASSWORD || "",
        {
          host: process.env.DB_HOST || "localhost",
          dialect: "postgres",
          port,
          ...(dialectOptions ? { dialectOptions } : {}),
          logging: process.env.DB_LOGGING === "true" ? console.log : false,
          pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000,
          },
        }
      );

      this._sequelize
        .authenticate()
        .then(() => {
          console.log("PostgreSQL connection established.");
        })
        .catch((err) => {
          console.error("Unable to connect to the database:", err);
        });

      Database.instance = this;
    }
    return Database.instance;
  }

  get sequelize() {
    return this._sequelize;
  }
}

const instance = new Database();
Object.freeze(instance);

module.exports = instance;
