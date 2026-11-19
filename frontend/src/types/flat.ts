/** OCCUPIED and NOTICE are set by agreements. */
export type FlatStatus = "VACANT" | "OCCUPIED" | "NOTICE" | "UNDER_MAINTENANCE";
export type UnitType = "FLAT" | "ROOM" | "SEAT" | "SHOP" | "GARAGE";

/** The agreement holding the unit now (from the flats API). */
export interface CurrentAgreement {
  id: number;
  status: "ACTIVE" | "NOTICE";
  rate: number;
  startDate: string;
  endDate: string | null;
  tenant: { id: number; firstName: string; lastName: string; phone: string | null };
}

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
  assetId?: number;
  unitType?: UnitType;
  toLet?: boolean;
  currentAgreement?: CurrentAgreement | null;
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
