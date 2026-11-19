import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../shared/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { permissionMatrix } from "../../shared/permissions";
import type { InviteMemberInput, UpdateMemberInput, UpdateOrgInput } from "./org.validation";

export interface OrgSettings {
  dueDay: number;
  noticeMonths: number;
  /** SMS receipts and the 5th / due day / overdue reminders */
  sms: { enabled: boolean; reminders: boolean };
}
export const DEFAULT_SETTINGS: OrgSettings = { dueDay: 10, noticeMonths: 2, sms: { enabled: true, reminders: true } };

export const settingsOf = (raw: unknown): OrgSettings => {
  const r = (raw as Partial<OrgSettings>) ?? {};
  return { ...DEFAULT_SETTINGS, ...r, sms: { ...DEFAULT_SETTINGS.sms, ...(r.sms ?? {}) } };
};

const memberSelect = {
  id: true,
  role: true,
  isActive: true,
  createdAt: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true } },
} as const;

export class OrgService {
  async getCurrent(orgId: number) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundError("Organisation not found");
    return { ...org, settings: settingsOf(org.settings) };
  }

  async update(orgId: number, input: UpdateOrgInput) {
    const current = await this.getCurrent(orgId);
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.settings && { settings: { ...current.settings, ...input.settings, sms: { ...current.settings.sms, ...(input.settings.sms ?? {}) } } }),
      },
    });
    return { ...org, settings: settingsOf(org.settings) };
  }

  async listMembers(orgId: number) {
    const members = await prisma.membership.findMany({ where: { orgId }, select: memberSelect, orderBy: { createdAt: "asc" } });
    return { members, permissions: permissionMatrix() };
  }

  /**
   * Adds a staff member. An existing account (same email) is linked; otherwise an account is
   * created with a one-time password, printed to the console like OTPs (there is no email sender yet).
   */
  async invite(orgId: number, input: InviteMemberInput) {
    const email = input.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    let tempPassword: string | null = null;

    if (!user) {
      tempPassword = crypto.randomBytes(6).toString("base64url") + "A1";
      user = await prisma.user.create({
        data: {
          email,
          phone: input.phone || null,
          firstName: input.firstName,
          lastName: input.lastName,
          password: await bcrypt.hash(tempPassword, 12),
        },
      });
      console.log(`[DEV] Temporary password for ${email}: ${tempPassword}`);
    }

    const existing = await prisma.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId } } });
    if (existing) throw new ConflictError("This person is already a member");

    return prisma.membership.create({ data: { userId: user.id, orgId, role: input.role }, select: memberSelect });
  }

  async updateMember(orgId: number, memberId: string, input: UpdateMemberInput) {
    const m = await this.ownMember(orgId, memberId);
    if (m.role === "OWNER") throw new ForbiddenError("The owner's role can't be changed here");
    return prisma.membership.update({ where: { id: m.id }, data: input, select: memberSelect });
  }

  async removeMember(orgId: number, memberId: string) {
    const m = await this.ownMember(orgId, memberId);
    if (m.role === "OWNER") throw new ForbiddenError("The owner can't be removed");
    await prisma.membership.delete({ where: { id: m.id } });
  }

  private async ownMember(orgId: number, memberId: string) {
    const m = await prisma.membership.findFirst({ where: { id: toNumberId(memberId), orgId } });
    if (!m) throw new NotFoundError("Member not found");
    return m;
  }
}
