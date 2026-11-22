import client from "./client";
import type { TripLine } from "@/utils/rental";
import type { VehicleType } from "./vehicles";

export type BookingStatus = "RESERVED" | "ON_TRIP" | "DONE" | "CANCELLED";
export interface Extra { label: string; amount: number }

export interface Booking {
  id: number;
  vehicleId: number;
  tenantId: number;
  invoiceId: number | null;
  status: BookingStatus;
  driverName: string | null;
  driverPhone: string | null;
  pickup: string | null;
  destination: string | null;
  outstation: boolean;
  startAt: string;
  endAt: string;
  dayRate: number;
  hourCap: number;
  kmCap: number | null;
  overtimeRate: number;
  extraKmRate: number;
  fuelPerKm: number;
  startKm: number | null;
  endKm: number | null;
  startedAt: string | null;
  endedAt: string | null;
  extras: Extra[] | null;
  cancelCharge: number | null;
  notes: string | null;
  customer: string;
  vehicleLabel: string;
  vehicle: { id: number; regNo: string; type: VehicleType; model: string | null; assetId: number };
  tenant: { id: number; firstName: string; lastName: string; phone: string | null; kind: "PERSON" | "COMPANY" };
  invoice: { id: number; month: number; year: number; totalAmount: number; paidAmount: number; dueAmount: number; status: string } | null;
  charge: { days: number; hours: number; km: number | null; items: TripLine[]; total: number };
}

export interface BookingInput {
  vehicleId: number;
  tenantId?: number;
  customer?: { firstName: string; lastName?: string; phone?: string; kind?: "PERSON" | "COMPANY" };
  driverName?: string | null;
  driverPhone?: string | null;
  pickup?: string | null;
  destination?: string | null;
  outstation?: boolean;
  startAt: string;
  endAt: string;
  dayRate?: number;
  hourCap?: number;
  kmCap?: number | null;
  overtimeRate?: number;
  extraKmRate?: number;
  fuelPerKm?: number;
  notes?: string | null;
  advance?: { amount: number; method: string; transactionId?: string };
}
export interface SheetInput { endKm?: number | null; endedAt?: string | null; extras?: Extra[] }

const d = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const bookingApi = {
  list: (params: { from?: string; to?: string; vehicleId?: number; status?: BookingStatus } = {}) => d<Booking[]>(client.get("/bookings", { params })),
  get: (id: number | string) => d<Booking>(client.get(`/bookings/${id}`)),
  create: (body: BookingInput) => d<Booking>(client.post("/bookings", body)),
  update: (id: number, body: Partial<BookingInput>) => d<Booking>(client.patch(`/bookings/${id}`, body)),
  start: (id: number, body: { startKm: number; startedAt?: string }) => d<Booking>(client.post(`/bookings/${id}/start`, body)),
  sheet: (id: number, body: SheetInput) => d<Booking>(client.put(`/bookings/${id}/sheet`, body)),
  close: (id: number, body: SheetInput) => d<Booking>(client.post(`/bookings/${id}/close`, body)),
  cancel: (id: number, body: { charge?: number }) => d<Booking>(client.post(`/bookings/${id}/cancel`, body)),
};
