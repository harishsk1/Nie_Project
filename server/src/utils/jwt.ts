import jwt, { SignOptions, JwtPayload, Secret } from "jsonwebtoken";
import type { StringValue } from "ms";
import { config } from "../config";

type JwtPayloadIn = {
  sub: string;
  role: string;
  loginType: string;
  isEmailVerified: boolean;
};

const ACCESS_SECRET = config.auth.accessTokenSecret as Secret;
const REFRESH_SECRET = config.auth.refreshTokenSecret as Secret;

const accessOpts: SignOptions = {
  expiresIn: config.auth.accessTokenTTL as StringValue,
};
const refreshOpts: SignOptions = {
  expiresIn: config.auth.refreshTokenTTL as StringValue,
};

export function signAccessToken(payload: JwtPayloadIn) {
  return jwt.sign(payload, ACCESS_SECRET, accessOpts);
}

export function signRefreshToken(payload: JwtPayloadIn) {
  return jwt.sign(payload, REFRESH_SECRET, refreshOpts);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
