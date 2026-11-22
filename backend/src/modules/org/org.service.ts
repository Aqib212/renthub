import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { audit } from "../../shared/audit";
import { prisma } from "../../shared/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/utils/errors";
import { toNumberId } from "../../shared/utils/helpers";
import { permissionMatrix } from "../../shared/permissions";
import type { InviteMemberInput, UpdateMemberInput, UpdateOrgInput } from "./org.validation";
import { DEFAULT_LATE_FEE, type LateFeeSettings } from "../../shared/utils/lateFee";

export interface OrgSettings {
  dueDay: number;
  noticeMonths: number;
  /** SMS receipts and the 5th / due day / overdue reminders */
  sms: { enabled: boolean; reminders: boolean };
  /** extra clauses added to every new agreement deed */
  agreementClauses: string[];
  /** tenant portal on/off for this landlord */
  portal: { enabled: boolean };
  /** how tenants pay (bKash number, bank account); shown in the portal */
  payInfo: string;
  /** added once to a monthly rent invoice `afterDays` after its due date (off by default) */
  lateFee: LateFeeSettings;
}
export const DEFAULT_SETTINGS: OrgSettings = { dueDay: 10, noticeMonths: 2, sms: { enabled: true, reminders: true }, agreementClauses: [], portal: { enabled: true }, payInfo: "", lateFee: DEFAULT_LATE_FEE };

export const settingsOf = (raw: unknown): OrgSettings => {
  const r = (raw as Partial<OrgSettings>) ?? {};
  return { ...DEFAULT_SETTINGS, ...r, sms: { ...DEFAULT_SETTINGS.sms, ...(r.sms ?? {}) }, portal: { ...DEFAULT_SETTINGS.portal, ...(r.portal ?? {}) }, lateFee: { ...DEFAULT_SETTINGS.lateFee, ...(r.lateFee ?? {}) } };
};

const memberSelect = {
  id: true,
  role: true,
  isActive: true,
  buildingIds: true,
  createdAt: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true } },
} as const;

export class OrgService {
  async getCurrent(orgId: number) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundError("Organisation not found");
    const { gateway, ...rest } = org; // the payment gateway keys never go to the browser
    return { ...rest, settings: settingsOf(org.settings), onlinePay: !!(gateway as { storeId?: string } | null)?.storeId };
  }

  async update(orgId: number, input: UpdateOrgInput) {
    const current = await this.getCurrent(orgId);
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.settings && { settings: { ...current.settings, ...input.settings, sms: { ...current.settings.sms, ...(input.settings.sms ?? {}) }, portal: { ...current.settings.portal, ...(input.settings.portal ?? {}) }, lateFee: { ...current.settings.lateFee, ...(input.settings.lateFee ?? {}) } } }),
      },
    });
    const { gateway, ...rest } = org;
    return { ...rest, settings: settingsOf(org.settings), onlinePay: !!(gateway as { storeId?: string } | null)?.storeId };
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

    const m = await prisma.membership.create({ data: { userId: user.id, orgId, role: input.role, buildingIds: await this.buildingsJson(orgId, input.buildingIds) }, select: memberSelect });
    await audit(prisma, "member.add", "Membership", m.id, { email: input.email, role: input.role });
    return m;
  }

  async updateMember(orgId: number, memberId: string, input: UpdateMemberInput) {
    const m = await this.ownMember(orgId, memberId);
    if (m.role === "OWNER") throw new ForbiddenError("The owner's role can't be changed here");
    const { buildingIds, ...rest } = input;
    const updated = await prisma.membership.update({
      where: { id: m.id },
      data: { ...rest, ...(buildingIds !== undefined ? { buildingIds: await this.buildingsJson(orgId, buildingIds) } : {}) },
      select: memberSelect,
    });
    await audit(prisma, "member.update", "Membership", m.id, { before: { role: m.role, isActive: m.isActive, buildingIds: m.buildingIds as any }, after: input as any });
    return updated;
  }

  async removeMember(orgId: number, memberId: string) {
    const m = await this.ownMember(orgId, memberId);
    if (m.role === "OWNER") throw new ForbiddenError("The owner can't be removed");
    await prisma.membership.delete({ where: { id: m.id } });
    await audit(prisma, "member.remove", "Membership", m.id, { role: m.role, userId: Number(m.userId) });
  }

  /** Which buildings a member may see: null = all; otherwise ids that must belong to this workspace. */
  private async buildingsJson(orgId: number, ids: number[] | null | undefined) {
    if (!ids || !ids.length) return Prisma.DbNull;
    const found = await prisma.building.count({ where: { orgId, id: { in: ids } } });
    if (found !== new Set(ids).size) throw new NotFoundError("Building not found");
    return [...new Set(ids)];
  }

  private async ownMember(orgId: number, memberId: string) {
    const m = await prisma.membership.findFirst({ where: { id: toNumberId(memberId), orgId } });
    if (!m) throw new NotFoundError("Member not found");
    return m;
  }
}
