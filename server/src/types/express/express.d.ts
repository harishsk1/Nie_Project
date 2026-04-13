import type { UserRole, LoginType } from "@prisma/client";

declare global {
  namespace Express {
    interface UserJWT {
      id: string;
      email: string;
      username: string;
      role: UserRole | string;
      loginType: LoginType | string;
      isEmailVerified: boolean;
    }
    interface Request {
      user?: UserJWT;
    }
  }
}
export {};
