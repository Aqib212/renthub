export type TenantStatus = "ACTIVE" | "FORMER";

export interface Tenant {
  id: number;
  flatId: number | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  nid: string | null;
  passport: string | null;
  drivingLicense: string | null;
  occupation: string | null;
  office: string | null;
  emergencyContact: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  photo: string | null;
  agreementDoc: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  members: number;
  /** derived from the latest agreement */
  status: TenantStatus;
  kind?: "PERSON" | "COMPANY";
  lang?: "BN" | "EN";
  household?: { name: string; relation?: string; age?: number; nid?: string }[] | null;
  agreementId?: number | null;
  agreementStatus?: "DRAFT" | "ACTIVE" | "NOTICE" | "ENDED" | null;
  flat?: { name: string; floorId: number; floor: { name: string; buildingId: number; building: { name: string } } } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  nid?: string;
  passport?: string;
  drivingLicense?: string;
  occupation?: string;
  office?: string;
  emergencyContact?: string;
  presentAddress?: string;
  permanentAddress?: string;
  moveInDate?: string;
  moveOutDate?: string;
  members?: number;
  status: TenantStatus;
}
