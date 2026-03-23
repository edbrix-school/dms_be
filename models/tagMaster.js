const { DataTypes } = require("sequelize");
const db = require("../config/db");

const TagMaster = db.sequelize.define(
  "dms_tags_master",
  {
    tag_id: {
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
  { tableName: "dms_tags_master", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" }
);

module.exports = TagMaster;
