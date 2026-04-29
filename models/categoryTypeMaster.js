const { DataTypes } = require("sequelize");
const db = require("../config/db");

const CategoryTypeMaster = db.sequelize.define(
  "dms_category_types_master",
  {
    category_type_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
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
  { tableName: "dms_category_types_master", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" }
);

module.exports = CategoryTypeMaster;
