import type { UserRole, LoginType } from "@prisma/client";
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email: string;
      username: string;
      role: UserRole | string;
      loginType: LoginType | string;
      isEmailVerified: boolean;
    };
  }
}
export {};
