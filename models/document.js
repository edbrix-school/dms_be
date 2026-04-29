const { DataTypes } = require("sequelize");
const db = require("../config/db");

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
    doc_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    doc_key_poid: {
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
    distribution: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Team or org unit that uploaded / owns distribution",
    },
    module_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    screen_name: {
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

module.exports = Document;
Document.hasMany(require("./documentFile"), { foreignKey: "document_id", as: "documentFiles" });
