export type UserRole = 'student' | 'teacher';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
}
