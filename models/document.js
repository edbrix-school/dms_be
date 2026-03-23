const { DataTypes } = require("sequelize");
const db = require("../config/db");
const User = require("./user");

const Document = db.sequelize.define(
  "dms_documents",
  {
    document_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tags: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cover_image: {
      type: DataTypes.STRING,
      allowNull: true,
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
  { tableName: "dms_documents", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" }
);

Document.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Document.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
module.exports = Document;
Document.hasMany(require("./documentFile"), { foreignKey: "document_id", as: "documentFiles" });
