"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemporaryToken = generateTemporaryToken;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
function generateTemporaryToken(minutes = 10) {
    const unHashedToken = crypto_1.default.randomBytes(32).toString("hex");
    const hashedToken = crypto_1.default
        .createHash("sha256")
        .update(unHashedToken)
        .digest("hex");
    const tokenExpiry = new Date(Date.now() + minutes * 60 * 1000);
    return { unHashedToken, hashedToken, tokenExpiry };
}
async function hashPassword(plain) {
    const salt = await bcryptjs_1.default.genSalt(10);
    return bcryptjs_1.default.hash(plain, salt);
}
async function comparePassword(plain, hash) {
    return bcryptjs_1.default.compare(plain, hash);
}
