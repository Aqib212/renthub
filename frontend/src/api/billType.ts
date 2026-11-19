import client from "./client";
import type { BillType, BillTypeInput, FlatChargeRow, BillingMonth } from "@/types/billType";

export const billTypeApi = {
  list: async (): Promise<BillType[]> => (await client.get("/bill-types")).data.data,
  create: async (data: Partial<BillTypeInput>): Promise<BillType> => (await client.post("/bill-types", data)).data.data,
  update: async (id: number, data: Partial<BillTypeInput>): Promise<BillType> =>
    (await client.patch(`/bill-types/${id}`, data)).data.data,
  remove: async (id: number) => client.delete(`/bill-types/${id}`),
  getFlats: async (id: number): Promise<FlatChargeRow[]> => (await client.get(`/bill-types/${id}/flats`)).data.data,
  setFlats: async (id: number, flats: { flatId: number; isActive: boolean; amount: number | null }[]): Promise<FlatChargeRow[]> =>
    (await client.put(`/bill-types/${id}/flats`, { flats })).data.data,
  getMonth: async (month: number, year: number): Promise<BillingMonth> =>
    (await client.get("/bill-entries", { params: { month, year } })).data.data,
  saveMonth: async (month: number, year: number, entries: any[]): Promise<BillingMonth> =>
    (await client.put("/bill-entries/bulk", { month, year, entries })).data.data,
};
