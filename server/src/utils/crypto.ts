import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generateTemporaryToken(minutes = 10) {
  const unHashedToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");
  const tokenExpiry = new Date(Date.now() + minutes * 60 * 1000);
  return { unHashedToken, hashedToken, tokenExpiry };
}

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
