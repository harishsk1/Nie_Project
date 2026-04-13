import type { Request, Response } from "express";
import crypto from "crypto";

import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import {
  generateTemporaryToken,
  hashPassword,
  comparePassword,
} from "../utils/crypto";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { UserLoginType, UserRolesEnum } from "../constants";
import { config } from "../config";

function sanitizeUser(user: any) {
  if (!user) return user;
  const {
    password,
    refreshToken,
    emailVerificationToken,
    emailVerificationExpiry,
    forgotPasswordToken,
    forgotPasswordExpiry,
    ...rest
  } = user;
  return rest;
}

async function generateAccessAndRefreshTokens(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");

  const payload = {
    sub: user.id,
    role: user.role,
    loginType: user.loginType,
    isEmailVerified: user.isEmailVerified,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
}

const cookieOptions: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax";
} = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? "strict" : "lax",
};

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password, role } = req.body as {
    email: string;
    username: string;
    password: string;
    role?: UserRolesEnum;
  };

  const normalizedEmail = (email || "").trim().toLowerCase();
  const normalizedUsername = (username || "").trim();

  if (!normalizedEmail || !normalizedUsername || !password) {
    throw new ApiError(400, "Email, username and password are required");
  }

  const existedUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedEmail, mode: "insensitive" } },
        { username: { equals: normalizedUsername, mode: "insensitive" } },
      ],
    },
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }

  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashed,
      isEmailVerified: false,
      role: (role as any) || UserRolesEnum.USER,
      loginType: UserLoginType.EMAIL_PASSWORD,
    },
  });

  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken(30);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: tokenExpiry,
    },
  });

  return res.status(201).json(
    new ApiResponse(
      200,
      {
        user: sanitizeUser(user),
        ...(config.isProduction ? {} : { verifyTokenDevOnly: unHashedToken }),
      },
      "User registered; verification token generated"
    )
  );
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password } = req.body as {
    email?: string;
    username?: string;
    password: string;
  };

  const identifier = (email ?? username ?? "").trim();

  if (!identifier) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const normalizedIdentifier = identifier.toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedIdentifier, mode: "insensitive" } },
        { username: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  if (user.loginType !== UserLoginType.EMAIL_PASSWORD) {
    throw new ApiError(
      400,
      `You have previously registered using ${String(
        user.loginType
      ).toLowerCase()}. Please use that provider to access your account.`
    );
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user.id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: sanitizeUser(user), accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new ApiError(401, "Unauthorized");
  await prisma.user.update({
    where: { id: req.user.id },
    data: { refreshToken: null },
  });

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out"));
});

export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.id) throw new ApiError(401, "Unauthorized");
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          sanitizeUser(user),
          "Current user fetched successfully"
        )
      );
  }
);

export const forgotPasswordRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiError(404, "User does not exist", []);
    }

    const { unHashedToken, hashedToken, tokenExpiry } =
      generateTemporaryToken(30);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: tokenExpiry,
      },
    });

    const payload: Record<string, unknown> = {};
    if (!config.isProduction) {
      payload.resetTokenDevOnly = unHashedToken;
    }

    return res
      .status(200)
      .json(new ApiResponse(200, payload, "Password reset token generated"));
  }
);

export const resetForgottenPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { resetToken } = req.params as { resetToken: string };
    const { newPassword } = req.body as { newPassword: string };

    if (!newPassword || newPassword.length < 6) {
      throw new ApiError(400, "New password must be at least 6 characters");
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new ApiError(489, "Token is invalid or expired");
    }

    const hashed = await hashPassword(newPassword);

    await prisma.user.update({
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
      .json(new ApiResponse(200, {}, "Password reset successfully"));
  }
);

export const changeCurrentPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body as {
      oldPassword: string;
      newPassword: string;
    };

    if (!req.user?.id) throw new ApiError(401, "Unauthorized");

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new ApiError(404, "User does not exist");

    const ok = await comparePassword(oldPassword, user.password);
    if (!ok) throw new ApiError(400, "Invalid old password");

    const hashed = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
      },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
  }
);

export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response) => {
    const incomingRefreshToken =
      req.cookies?.refreshToken || (req.body?.refreshToken as string);

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decoded = verifyRefreshToken(incomingRefreshToken);
    const userId = (decoded.sub as string) || (decoded._id as string);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await (async () => {
      const payload = {
        sub: user.id,
        role: user.role,
        loginType: user.loginType,
        isEmailVerified: user.isEmailVerified,
      };
      const access = signAccessToken(payload);
      const refresh = signRefreshToken(payload);
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: refresh },
      });
      return { accessToken: access, refreshToken: refresh };
    })();

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      );
  }
);

export const assignRole = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const { role } = req.body as { role: UserRolesEnum };

  const validRoles = Object.values(UserRolesEnum);
  if (!role || !validRoles.includes(role as UserRolesEnum)) {
    throw new ApiError(400, "Invalid role. Must be USER or ADMIN");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Role changed for the user"));
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
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
    .json(new ApiResponse(200, sanitizedUsers, "Users fetched successfully"));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User deleted successfully"));
});

