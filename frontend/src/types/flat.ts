export type FlatStatus = "VACANT" | "OCCUPIED" | "UNDER_MAINTENANCE";

export interface Flat {
  id: number;
  floorId: number;
  name: string;
  flatNumber: string | null;
  bedrooms: number;
  bathrooms: number;
  kitchens: number;
  balconies: number;
  area: number | null;
  rent: number;
  advance: number | null;
  securityDeposit: number | null;
  sanctionedLoad: number | null;
  status: FlatStatus;
  totalTenants: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlatFormData {
  name: string;
  flatNumber?: string;
  bedrooms: number;
  bathrooms: number;
  kitchens: number;
  balconies: number;
  area?: number;
  rent: number;
  advance: number;
  securityDeposit?: number;
  sanctionedLoad?: number | null;
  status: FlatStatus;
}
