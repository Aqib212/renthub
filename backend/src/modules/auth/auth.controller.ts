import { Response } from "express";
import { AuthService } from "./auth.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { env } from "../../config/env";
import { STAFF_RT, clearRefreshCookie, durationMs, readCookie, setRefreshCookie } from "../../shared/utils/cookies";
import { UnauthorizedError } from "../../shared/utils/errors";
import { prisma } from "../../shared/prisma";

/** Puts the refresh token in the httpOnly cookie and leaves only the access token in the body. */
const withCookie = <T extends { tokens: { accessToken: string; refreshToken: string } }>(res: Response, r: T) => {
  setRefreshCookie(res, STAFF_RT, r.tokens.refreshToken, durationMs(env.jwt.refreshExpiresIn));
  return { ...r, tokens: { accessToken: r.tokens.accessToken } };
};

const authService = new AuthService();

export const register = asyncHandler(async (req, res: Response) => {
  const result = await authService.register(req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: "Registration successful. Please verify your email with the OTP sent.",
    data: withCookie(res, result),
  });
});

export const login = asyncHandler(async (req, res: Response) => {
  const result = await authService.login(req.body);
  sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: withCookie(res, result),
  });
});

export const refreshToken = asyncHandler(async (req, res: Response) => {
  const token = readCookie(req, STAFF_RT.name);
  if (!token) throw new UnauthorizedError("Not logged in");
  let result;
  try {
    result = await authService.refreshToken(token);
  } catch (e) {
    clearRefreshCookie(res, STAFF_RT);
    throw e;
  }
  sendSuccess(res, {
    statusCode: 200,
    message: "Token refreshed successfully",
    data: withCookie(res, { tokens: result }).tokens,
  });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = readCookie(req, STAFF_RT.name);
  if (token) await authService.logoutByRefreshToken(token);
  clearRefreshCookie(res, STAFF_RT);
  sendSuccess(res, {
    statusCode: 200,
    message: "Logout successful",
  });
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  await authService.changePassword(req.user!.userId, req.body);
  clearRefreshCookie(res, STAFF_RT);
  sendSuccess(res, {
    statusCode: 200,
    message: "Password changed successfully. Please login again.",
  });
});

export const forgotPassword = asyncHandler(async (req, res: Response) => {
  const result = await authService.forgotPassword(req.body.email);
  sendSuccess(res, {
    statusCode: 200,
    message: result.message,
  });
});

export const resetPassword = asyncHandler(async (req, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  sendSuccess(res, {
    statusCode: 200,
    message: "Password reset successful. Please login with your new password.",
  });
});

export const verifyEmail = asyncHandler(async (req, res: Response) => {
  await authService.verifyEmail(req.body.email, req.body.otp);
  sendSuccess(res, {
    statusCode: 200,
    message: "Email verified successfully",
  });
});

export const resendOtp = asyncHandler(async (req, res: Response) => {
  const result = await authService.resendOtp(req.body.email);
  sendSuccess(res, {
    statusCode: 200,
    message: result.message,
  });
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getProfile(req.user!.userId);
  // support view: the super-admin sees the opened workspace as if they were its owner (read-only)
  if (req.user!.support) {
    const org = await prisma.organization.findUnique({ where: { id: req.user!.support }, select: { name: true } });
    (user as any).memberships = org ? [{ orgId: String(req.user!.support), orgName: org.name, role: "OWNER", limited: false }] : [];
    (user as any).support = true;
  }
  sendSuccess(res, {
    statusCode: 200,
    message: "Profile retrieved successfully",
    data: user,
  });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.updateProfile(req.user!.userId, req.body);
  sendSuccess(res, {
    statusCode: 200,
    message: "Profile updated successfully",
    data: user,
  });
});
