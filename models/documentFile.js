const { DataTypes } = require("sequelize");
const db = require("../config/db");
const Document = require("./document"); // after Document is defined

const DocumentFile = db.sequelize.define(
  "dms_document_files",
  {
    document_file_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    document_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Alfresco node ID",
    },
    folder_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_private: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  { tableName: "dms_document_files", timestamps: true, createdAt: "created_at", updatedAt: false }
);

DocumentFile.belongsTo(Document, { foreignKey: "document_id", as: "document" });

module.exports = DocumentFile;
