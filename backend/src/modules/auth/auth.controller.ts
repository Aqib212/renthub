import { Response } from "express";
import { AuthService } from "./auth.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";

const authService = new AuthService();

export const register = asyncHandler(async (req, res: Response) => {
  const result = await authService.register(req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: "Registration successful. Please verify your email with the OTP sent.",
    data: result,
  });
});

export const login = asyncHandler(async (req, res: Response) => {
  const result = await authService.login(req.body);
  sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: result,
  });
});

export const refreshToken = asyncHandler(async (req, res: Response) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  sendSuccess(res, {
    statusCode: 200,
    message: "Token refreshed successfully",
    data: result,
  });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  await authService.logout(req.user!.userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Logout successful",
  });
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  await authService.changePassword(req.user!.userId, req.body);
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
