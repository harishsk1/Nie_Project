"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getAllUsers = exports.assignRole = exports.refreshAccessToken = exports.changeCurrentPassword = exports.resetForgottenPassword = exports.forgotPasswordRequest = exports.getCurrentUser = exports.logoutUser = exports.loginUser = exports.registerUser = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const ApiError_1 = require("../utils/ApiError");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
const crypto_2 = require("../utils/crypto");
const jwt_1 = require("../utils/jwt");
const constants_1 = require("../constants");
const config_1 = require("../config");
function sanitizeUser(user) {
    if (!user)
        return user;
    const { password, refreshToken, emailVerificationToken, emailVerificationExpiry, forgotPasswordToken, forgotPasswordExpiry, ...rest } = user;
    return rest;
}
async function generateAccessAndRefreshTokens(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new ApiError_1.ApiError(404, "User not found");
    const payload = {
        sub: user.id,
        role: user.role,
        loginType: user.loginType,
        isEmailVerified: user.isEmailVerified,
    };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
    });
    return { accessToken, refreshToken };
}
const cookieOptions = {
    httpOnly: true,
    secure: config_1.config.isProduction,
    sameSite: config_1.config.isProduction ? "strict" : "lax",
};
exports.registerUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, username, password, role } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedUsername = (username || "").trim();
    if (!normalizedEmail || !normalizedUsername || !password) {
        throw new ApiError_1.ApiError(400, "Email, username and password are required");
    }
    const existedUser = await prisma_1.prisma.user.findFirst({
        where: {
            OR: [
                { email: { equals: normalizedEmail, mode: "insensitive" } },
                { username: { equals: normalizedUsername, mode: "insensitive" } },
            ],
        },
    });
    if (existedUser) {
        throw new ApiError_1.ApiError(409, "User with email or username already exists", []);
    }
    const hashed = await (0, crypto_2.hashPassword)(password);
    const user = await prisma_1.prisma.user.create({
        data: {
            email: normalizedEmail,
            username: normalizedUsername,
            password: hashed,
            isEmailVerified: false,
            role: role || constants_1.UserRolesEnum.USER,
            loginType: constants_1.UserLoginType.EMAIL_PASSWORD,
        },
    });
    const { unHashedToken, hashedToken, tokenExpiry } = (0, crypto_2.generateTemporaryToken)(30);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            emailVerificationToken: hashedToken,
            emailVerificationExpiry: tokenExpiry,
        },
    });
    return res.status(201).json(new ApiResponse_1.ApiResponse(200, {
        user: sanitizeUser(user),
        ...(config_1.config.isProduction ? {} : { verifyTokenDevOnly: unHashedToken }),
    }, "User registered; verification token generated"));
});
exports.loginUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, username, password } = req.body;
    const identifier = (email ?? username ?? "").trim();
    if (!identifier) {
        throw new ApiError_1.ApiError(400, "Username or email is required");
    }
    if (!password) {
        throw new ApiError_1.ApiError(400, "Password is required");
    }
    const normalizedIdentifier = identifier.toLowerCase();
    const user = await prisma_1.prisma.user.findFirst({
        where: {
            OR: [
                { email: { equals: normalizedIdentifier, mode: "insensitive" } },
                { username: { equals: identifier, mode: "insensitive" } },
            ],
        },
    });
    if (!user) {
        throw new ApiError_1.ApiError(404, "User does not exist");
    }
    if (user.loginType !== constants_1.UserLoginType.EMAIL_PASSWORD) {
        throw new ApiError_1.ApiError(400, `You have previously registered using ${String(user.loginType).toLowerCase()}. Please use that provider to access your account.`);
    }
    const isValidPassword = await (0, crypto_2.comparePassword)(password, user.password);
    if (!isValidPassword) {
        throw new ApiError_1.ApiError(401, "Invalid user credentials");
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse_1.ApiResponse(200, { user: sanitizeUser(user), accessToken, refreshToken }, "User logged in successfully"));
});
exports.logoutUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user?.id)
        throw new ApiError_1.ApiError(401, "Unauthorized");
    await prisma_1.prisma.user.update({
        where: { id: req.user.id },
        data: { refreshToken: null },
    });
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse_1.ApiResponse(200, {}, "User logged out"));
});
exports.getCurrentUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user?.id)
        throw new ApiError_1.ApiError(401, "Unauthorized");
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, sanitizeUser(user), "Current user fetched successfully"));
});
exports.forgotPasswordRequest = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email } = req.body;
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new ApiError_1.ApiError(404, "User does not exist", []);
    }
    const { unHashedToken, hashedToken, tokenExpiry } = (0, crypto_2.generateTemporaryToken)(30);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            forgotPasswordToken: hashedToken,
            forgotPasswordExpiry: tokenExpiry,
        },
    });
    const payload = {};
    if (!config_1.config.isProduction) {
        payload.resetTokenDevOnly = unHashedToken;
    }
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, payload, "Password reset token generated"));
});
exports.resetForgottenPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
        throw new ApiError_1.ApiError(400, "New password must be at least 6 characters");
    }
    const hashedToken = crypto_1.default
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
    const user = await prisma_1.prisma.user.findFirst({
        where: {
            forgotPasswordToken: hashedToken,
            forgotPasswordExpiry: { gt: new Date() },
        },
    });
    if (!user) {
        throw new ApiError_1.ApiError(489, "Token is invalid or expired");
    }
    const hashed = await (0, crypto_2.hashPassword)(newPassword);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashed,
            forgotPasswordToken: null,
            forgotPasswordExpiry: null,
            refreshToken: null,
        },
    });
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, {}, "Password reset successfully"));
});
exports.changeCurrentPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!req.user?.id)
        throw new ApiError_1.ApiError(401, "Unauthorized");
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        throw new ApiError_1.ApiError(404, "User does not exist");
    const ok = await (0, crypto_2.comparePassword)(oldPassword, user.password);
    if (!ok)
        throw new ApiError_1.ApiError(400, "Invalid old password");
    const hashed = await (0, crypto_2.hashPassword)(newPassword);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashed,
        },
    });
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, {}, "Password changed successfully"));
});
exports.refreshAccessToken = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError_1.ApiError(401, "Unauthorized request");
    }
    const decoded = (0, jwt_1.verifyRefreshToken)(incomingRefreshToken);
    const userId = decoded.sub || decoded._id;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new ApiError_1.ApiError(401, "Invalid refresh token");
    if (incomingRefreshToken !== user.refreshToken) {
        throw new ApiError_1.ApiError(401, "Refresh token is expired or used");
    }
    const { accessToken, refreshToken } = await (async () => {
        const payload = {
            sub: user.id,
            role: user.role,
            loginType: user.loginType,
            isEmailVerified: user.isEmailVerified,
        };
        const access = (0, jwt_1.signAccessToken)(payload);
        const refresh = (0, jwt_1.signRefreshToken)(payload);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: refresh },
        });
        return { accessToken: access, refreshToken: refresh };
    })();
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse_1.ApiResponse(200, { accessToken, refreshToken }, "Access token refreshed"));
});
exports.assignRole = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;
    const validRoles = Object.values(constants_1.UserRolesEnum);
    if (!role || !validRoles.includes(role)) {
        throw new ApiError_1.ApiError(400, "Invalid role. Must be USER or ADMIN");
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new ApiError_1.ApiError(404, "User does not exist");
    }
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { role },
    });
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, {}, "Role changed for the user"));
});
exports.getAllUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const users = await prisma_1.prisma.user.findMany({
        select: {
            id: true,
            email: true,
            username: true,
            role: true,
            isEmailVerified: true,
            loginType: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
    const sanitizedUsers = users.map((user) => sanitizeUser(user));
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, sanitizedUsers, "Users fetched successfully"));
});
exports.deleteUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new ApiError_1.ApiError(404, "User does not exist");
    }
    await prisma_1.prisma.user.delete({
        where: { id: userId },
    });
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, {}, "User deleted successfully"));
});
