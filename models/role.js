const { DataTypes } = require("sequelize");
const db = require("../config/db");

const Role = db.sequelize.define(
  "dms_roles",
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  { tableName: "dms_roles", timestamps: false }
);

module.exports = Role;
