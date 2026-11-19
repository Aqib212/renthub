export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    emailVerified: boolean;
    avatar: string | null;
  };
  tokens: AuthTokens;
}
