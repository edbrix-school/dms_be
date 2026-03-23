const db = require("../config/db");
const User = require("../models/user");
const Role = require("../models/role");

async function findUserByEmail(email) {
  const user = await User.findOne({
    where: { email },
    attributes: ["user_id", "email", "password_hash", "first_name", "last_name", "role_id", "is_blocked"],
    include: [{ model: Role, as: "role", attributes: ["role_id", "name"] }],
  });
  return user ? user.toJSON() : null;
}

async function findUserById(userId) {
  const user = await User.findByPk(userId, {
    attributes: ["user_id", "email", "first_name", "last_name", "role_id", "is_blocked", "created_at"],
    include: [{ model: Role, as: "role", attributes: ["role_id", "name"] }],
  });
  return user ? user.toJSON() : null;
}

module.exports = {
  findUserByEmail,
  findUserById,
};
