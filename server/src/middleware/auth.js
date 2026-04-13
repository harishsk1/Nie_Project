"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../utils/jwt");
const ApiError_1 = require("../utils/ApiError");
const requireAuth = async (req, _res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
        ? header.split(" ")[1]
        : req.cookies?.accessToken;
    if (!token)
        throw new ApiError_1.ApiError(401, "Unauthorized");
    const decoded = (0, jwt_1.verifyAccessToken)(token);
    const userId = decoded.sub;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new ApiError_1.ApiError(401, "Unauthorized");
    req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        loginType: user.loginType,
        isEmailVerified: user.isEmailVerified,
    };
    next();
};
exports.requireAuth = requireAuth;
