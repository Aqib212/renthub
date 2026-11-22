import client from "./client";
import type { DocumentKind } from "./documents";

export type VehicleType = "CNG" | "TAXI" | "CAR" | "MICROBUS" | "OTHER";
export type VehicleStatus = "AVAILABLE" | "ON_LEASE" | "OFF_ROAD";
export const VEHICLE_TYPES: VehicleType[] = ["CNG", "TAXI", "CAR", "MICROBUS", "OTHER"];

export interface Vehicle {
  id: number;
  assetId: number;
  type: VehicleType;
  regNo: string;
  model: string | null;
  year: number | null;
  color: string | null;
  chassisNo: string | null;
  engineNo: string | null;
  rate: number | null;
  status: VehicleStatus;
  notes: string | null;
  agreement: { id: number; cycle: "DAILY" | "MONTHLY"; rate: number; startDate: string; driver: { id: number; name: string; phone: string | null } } | null;
  nextExpiry: { id: number; kind: DocumentKind; name: string; expiresAt: string } | null;
}
export interface VehicleDetail extends Vehicle {
  agreements: { id: number; cycle: string; rate: number; status: string; startDate: string; endDate: string | null; driverName: string }[];
}
export type VehicleInput = Partial<Omit<Vehicle, "id" | "assetId" | "status" | "agreement" | "nextExpiry">> & { type: VehicleType; regNo: string };

export interface JamaRow {
  agreementId: number;
  vehicle: { id: number; regNo: string; type: VehicleType; status: VehicleStatus };
  driver: { id: number; name: string; phone: string | null };
  rate: number;
  jama: number;
  entry: { id: number; amount: number; reason: string | null } | null;
  offDays: number;
  paidToday: number;
  owed: number;
  invoiceId: number | null;
}
export interface JamaSheet { date: string; rows: JamaRow[]; totals: { expected: number; collected: number; owed: number } }

export interface ExpiringDoc {
  id: number;
  kind: DocumentKind;
  name: string;
  expiresAt: string;
  daysLeft: number;
  owner: { type: "vehicle" | "unit" | "tenant" | "agreement"; id: number; label: string } | null;
}

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const vehicleLabel = (v: { regNo: string; type: string }) => `${v.regNo} (${v.type})`;

export const vehicleApi = {
  list: () => d<Vehicle[]>(client.get("/vehicles")),
  get: (id: number | string) => d<VehicleDetail>(client.get(`/vehicles/${id}`)),
  create: (body: VehicleInput) => d<VehicleDetail>(client.post("/vehicles", body)),
  update: (id: number, body: Partial<VehicleInput>) => d<VehicleDetail>(client.patch(`/vehicles/${id}`, body)),
  remove: (id: number) => client.delete(`/vehicles/${id}`),
};

export const jamaApi = {
  sheet: (date?: string) => d<JamaSheet>(client.get("/jama", { params: { date } })),
  /** the month invoice to collect against (made now if missing) */
  open: (agreementId: number, date: string) => d<{ invoiceId: number }>(client.post("/jama/open", { agreementId, date })),
  setDay: (body: { agreementId: number; date: string; amount: number; reason?: string | null }) => d<JamaSheet>(client.put("/jama/days", body)),
  clearDay: (id: number) => d<JamaSheet>(client.delete(`/jama/days/${id}`)),
};

export const expiringApi = {
  list: (days = 30) => d<ExpiringDoc[]>(client.get("/documents/expiring", { params: { days } })),
};
