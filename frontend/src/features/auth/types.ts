export type UserRole = "client" | "courier" | "admin";

export interface TokenOut {
  access_token: string;
  token_type: "bearer";
  user: UserMe;
}

export interface UserMe {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterClientPayload {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface RegisterCourierPayload extends RegisterClientPayload {
  transport_id?: number;
}
