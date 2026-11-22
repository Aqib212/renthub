export interface User {
  id: number;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  /** Platform role. Business roles are per workspace, in memberships. */
  role: "SUPER_ADMIN" | "USER";
  /** set by /auth/profile during a super-admin support view */
  support?: boolean;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  emailVerified: boolean;
  avatar: string | null;
  lastLoginAt?: string;
  createdAt?: string;
  ownerProfile?: OwnerProfile | null;
  memberships?: Membership[];
}

export type OrgRole = "OWNER" | "MANAGER" | "CARETAKER" | "ACCOUNTANT";

export interface Membership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  /** sees only some buildings (and no vehicles) */
  limited?: boolean;
}

export interface OwnerProfile {
  id: number;
  nid: string | null;
  passport: string | null;
  drivingLicense: string | null;
  occupation: string | null;
  office: string | null;
  emergencyContact: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  photo: string | null;
}

/** The refresh token is an httpOnly cookie the browser keeps; only the access token reaches JS. */
export interface AuthTokens {
  accessToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: Array<{ field: string; message: string }>;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Name of the new workspace (defaults to the person's name). */
  orgName?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
}
