"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const ACCESS_SECRET = config_1.config.auth.accessTokenSecret;
const REFRESH_SECRET = config_1.config.auth.refreshTokenSecret;
const accessOpts = {
    expiresIn: config_1.config.auth.accessTokenTTL,
};
const refreshOpts = {
    expiresIn: config_1.config.auth.refreshTokenTTL,
};
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, ACCESS_SECRET, accessOpts);
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, REFRESH_SECRET, refreshOpts);
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
}
