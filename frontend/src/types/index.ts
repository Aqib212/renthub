export interface User {
  id: number;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN" | "HOUSE_OWNER" | "MANAGER" | "ACCOUNTANT";
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  emailVerified: boolean;
  avatar: string | null;
  lastLoginAt?: string;
  createdAt?: string;
  ownerProfile?: OwnerProfile | null;
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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
  role?: "HOUSE_OWNER" | "MANAGER" | "ACCOUNTANT";
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
