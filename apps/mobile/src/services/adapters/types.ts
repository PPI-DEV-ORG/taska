export type ApiUser = {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  role: string;
  status: string;
  warehouseId?: number | null;
  avatarFileId?: number | null;
  lastLoginAt?: string | null;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
