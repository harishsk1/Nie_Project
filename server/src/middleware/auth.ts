import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.split(" ")[1]
    : req.cookies?.accessToken;
  if (!token) throw new ApiError(401, "Unauthorized");

  const decoded = verifyAccessToken(token);
  const userId = decoded.sub as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(401, "Unauthorized");

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
