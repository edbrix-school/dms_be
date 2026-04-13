const { DataTypes } = require("sequelize");
const db = require("../config/db");

const ModuleNameMaster = db.sequelize.define(
  "dms_module_names_master",
  {
    module_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "dms_module_names_master",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["category_type_id", "name"] }],
  }
);

module.exports = ModuleNameMaster;
