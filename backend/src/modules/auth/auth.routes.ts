import { Router } from "express";
import * as authController from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authRateLimiter } from "../../middleware/rateLimiter.middleware";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  resendOtpSchema,
  updateProfileSchema,
  emailChangeSchema,
  emailConfirmSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), authController.register);
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);
// the refresh token comes from the httpOnly cookie, not the body
router.post("/refresh-token", authController.refreshToken);
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post("/verify-email", authRateLimiter, validate(verifyOtpSchema), authController.verifyEmail);
router.post("/resend-otp", authRateLimiter, validate(resendOtpSchema), authController.resendOtp);

// no access token needed: logging out revokes the session behind the cookie
router.post("/logout", authController.logout);
router.post("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);
router.get("/profile", authenticate, authController.getProfile);
router.patch("/profile", authenticate, validate(updateProfileSchema), authController.updateProfile);
router.post("/email/change", authenticate, authRateLimiter, validate(emailChangeSchema), authController.requestEmailChange);
router.post("/email/confirm", authenticate, authRateLimiter, validate(emailConfirmSchema), authController.confirmEmailChange);

export default router;
