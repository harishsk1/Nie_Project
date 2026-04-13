"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaticFilePath = getStaticFilePath;
exports.getLocalPath = getLocalPath;
exports.removeLocalFile = removeLocalFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function getStaticFilePath(req, filename) {
    const base = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    return `${base}/uploads/${filename}`;
}
function getLocalPath(filename) {
    return path_1.default.join(process.cwd(), "public", "uploads", filename);
}
function removeLocalFile(localPath) {
    if (!localPath)
        return;
    fs_1.default.promises.unlink(localPath).catch(() => void 0);
}
