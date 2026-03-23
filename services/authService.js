const bcrypt = require("bcrypt");
const authRepository = require("../dao/authRepository");

async function login(email, password) {
  const user = await authRepository.findUserByEmail(email);
  if (!user) return null;
  if (user.is_blocked) return { blocked: true };
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return null;
  delete user.password_hash;
  return user;
}

module.exports = {
  login,
};
