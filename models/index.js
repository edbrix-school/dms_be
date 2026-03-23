// Load all models and set Document <-> Category association to avoid circular require
const Role = require("./role");
const User = require("./user");
const Category = require("./category");
const Document = require("./document");
const DocumentFile = require("./documentFile");
const TagMaster = require("./tagMaster");

Document.belongsTo(Category, { foreignKey: "category_id", as: "category" });
Category.hasMany(Document, { foreignKey: "category_id", as: "documents" });

module.exports = { Role, User, Category, Document, DocumentFile, TagMaster };
