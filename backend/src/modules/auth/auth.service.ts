import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../shared/prisma";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt";
import { generateOtp } from "../../shared/utils/generateOtp";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  TooManyRequestsError,
  ForbiddenError,
} from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { env } from "../../config/env";
import type { RegisterInput, LoginInput, ChangePasswordInput, UpdateProfileInput, EmailChangeInput } from "./auth.validation";
import { normalizeBdPhone } from "../../shared/notify/phone";
import type { AuthResponse, AuthTokens } from "./auth.types";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

/** Workspaces the user belongs to, for the organisation switcher. */
export async function membershipsOf(userId: bigint | number) {
  const rows = await prisma.membership.findMany({
    where: { userId, isActive: true },
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  // limited = the member sees only some buildings (no fleet screens); the owner never is
  return rows.map((m) => ({ orgId: String(m.orgId), orgName: m.org.name, role: m.role, limited: m.role !== "OWNER" && Array.isArray(m.buildingIds) && m.buildingIds.length > 0 }));
}

export class AuthService {
  private generateTokens(userId: string, email: string, role: string): AuthTokens {
    const payload = { userId, email, role };
    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    if (input.phone) {
      const phoneExists = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (phoneExists) {
        throw new ConflictError("An account with this phone number already exists");
      }
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        otp: generateOtp(),
        otpExpiresAt: new Date(Date.now() + env.otp.expiresInMinutes * 60 * 1000),
        otpPurpose: "EMAIL_VERIFICATION",
        // every self-registered user owns a new workspace; staff are invited into existing ones
        memberships: {
          create: {
            role: "OWNER",
            org: { create: { name: input.orgName ?? `${input.firstName} ${input.lastName}`, settings: { dueDay: 10, noticeMonths: 2 } } },
          },
        },
      },
    });

    const tokens = this.generateTokens(String(user.id), user.email, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    console.log(`[DEV] OTP for ${user.email}: ${user.otp}`);

    return {
      user: {
        id: String(user.id),
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        memberships: await membershipsOf(user.id),
      },
      tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (user.status === "BLOCKED") {
      throw new ForbiddenError("Your account has been blocked. Contact support.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new TooManyRequestsError(
        `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`
      );
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      const attempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts: attempts };

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
        updateData.loginAttempts = 0;
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });

      const remaining = MAX_LOGIN_ATTEMPTS - attempts;
      throw new UnauthorizedError(
        remaining > 0
          ? `Invalid email or password. ${remaining} attempt(s) remaining.`
          : "Account locked due to too many failed attempts. Try again in 30 minutes."
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = this.generateTokens(String(user.id), user.email, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      user: {
        id: String(user.id),
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        memberships: await membershipsOf(user.id),
      },
      tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const user = await prisma.user.findUnique({ where: { id: toNumberId(decoded.userId) } });

    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (user.status === "BLOCKED") {
      throw new ForbiddenError("Account blocked");
    }

    const tokens = this.generateTokens(String(user.id), user.email, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return tokens;
  }

  /** Revoke the session behind a refresh cookie (an invalid or stale token is simply ignored). */
  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    try {
      const { userId } = verifyRefreshToken(refreshToken);
      await prisma.user.updateMany({ where: { id: toNumberId(userId), refreshToken }, data: { refreshToken: null } });
    } catch {
      // expired or forged: nothing to revoke
    }
  }

  async logout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: toNumberId(userId) },
      data: { refreshToken: null },
    });
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: toNumberId(userId) } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isCurrentPasswordValid = await bcrypt.compare(input.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new ValidationError("Current password is incorrect");
    }

    const isSamePassword = await bcrypt.compare(input.newPassword, user.password);
    if (isSamePassword) {
      throw new ValidationError("New password must be different from current password");
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await prisma.user.update({
      where: { id: toNumberId(userId) },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return { message: "If the email exists, a reset link has been sent" };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    console.log(`[DEV] Reset token for ${user.email}: ${resetToken}`);

    return { message: "If the email exists, a reset link has been sent" };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new ValidationError("Invalid or expired reset token");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
        refreshToken: null,
      },
    });
  }

  async verifyEmail(email: string, otp: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.emailVerified) {
      throw new ValidationError("Email already verified");
    }

    if (!user.otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new ValidationError("OTP has expired. Request a new one.");
    }

    if (user.otp !== otp || user.otpPurpose !== "EMAIL_VERIFICATION") {
      throw new ValidationError("Invalid OTP");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        otp: null,
        otpExpiresAt: null,
        otpPurpose: null,
      },
    });
  }

  async resendOtp(email: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return { message: "If the email exists, a new OTP has been sent" };
    }

    const otp = generateOtp();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpExpiresAt: new Date(Date.now() + env.otp.expiresInMinutes * 60 * 1000),
        otpPurpose: "EMAIL_VERIFICATION",
      },
    });

    console.log(`[DEV] New OTP for ${user.email}: ${otp}`);

    return { message: "If the email exists, a new OTP has been sent" };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: toNumberId(userId) },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        emailVerified: true,
        avatar: true,
        lastLoginAt: true,
        createdAt: true,
        ownerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return { ...user, memberships: await membershipsOf(user.id) };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const id = toNumberId(userId);
    const data: { firstName?: string; lastName?: string; phone?: string | null } = {
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
    };
    if (input.phone !== undefined) {
      const n = normalizeBdPhone(input.phone);
      if (input.phone && !n) throw new ValidationError("Invalid Bangladeshi phone number");
      // stored as 01XXXXXXXXX; older rows may hold another format of the same number
      data.phone = n ? n.slice(2) : null;
      if (n) {
        const taken = await prisma.user.findFirst({ where: { id: { not: id }, phone: { in: [data.phone!, n, "+" + n] } } });
        if (taken) throw new ConflictError("Phone number already in use");
      }
    }
    await prisma.user.update({ where: { id }, data });
    // same shape as login/profile (with memberships), so the client store keeps the workspace
    return this.getProfile(userId);
  }

  /** Step 1 of an email change: check the password, park the new address, send it a code. */
  async requestEmailChange(userId: string, input: EmailChangeInput) {
    const user = await prisma.user.findUnique({ where: { id: toNumberId(userId) } });
    if (!user) throw new NotFoundError("User not found");
    if (!(await bcrypt.compare(input.password, user.password))) throw new ValidationError("Password is incorrect");
    const newEmail = input.newEmail.toLowerCase();
    if (newEmail === user.email) throw new ValidationError("That is already your email");
    if (await prisma.user.findUnique({ where: { email: newEmail } })) throw new ConflictError("Email already in use");
    const otp = generateOtp();
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: newEmail, otp, otpPurpose: "EMAIL_CHANGE", otpExpiresAt: new Date(Date.now() + env.otp.expiresInMinutes * 60 * 1000) },
    });
    // ponytail: no email sender yet, so the code goes to the console like the other codes; guessing is bounded only by authRateLimiter + expiry
    console.log(`[DEV] Email change code for ${newEmail}: ${otp}`);
    return { email: newEmail };
  }

  /** Step 2: the code sent to the new address switches the login email. */
  async confirmEmailChange(userId: string, otp: string) {
    const user = await prisma.user.findUnique({ where: { id: toNumberId(userId) } });
    if (!user) throw new NotFoundError("User not found");
    if (user.otpPurpose !== "EMAIL_CHANGE" || !user.pendingEmail || !user.otp) throw new ValidationError("No email change is waiting. Start again.");
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) throw new ValidationError("The code has expired. Request a new one.");
    if (user.otp !== otp) throw new ValidationError("Wrong code");
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: user.pendingEmail, emailVerified: true, pendingEmail: null, otp: null, otpPurpose: null, otpExpiresAt: null },
      });
    } catch (e: any) {
      if (e?.code === "P2002") throw new ConflictError("Email already in use");
      throw e;
    }
    return this.getProfile(userId);
  }

}
