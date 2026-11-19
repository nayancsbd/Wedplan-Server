export type UserRole = 'customer' | 'vendor' | 'admin';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}
