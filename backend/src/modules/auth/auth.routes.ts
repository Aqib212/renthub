import { Router } from "express";
import * as authController from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authRateLimiter } from "../../middleware/rateLimiter.middleware";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  resendOtpSchema,
  updateProfileSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), authController.register);
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);
router.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post("/verify-email", authRateLimiter, validate(verifyOtpSchema), authController.verifyEmail);
router.post("/resend-otp", authRateLimiter, validate(resendOtpSchema), authController.resendOtp);

router.post("/logout", authenticate, authController.logout);
router.post("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);
router.get("/profile", authenticate, authController.getProfile);
router.patch("/profile", authenticate, validate(updateProfileSchema), authController.updateProfile);

export default router;
