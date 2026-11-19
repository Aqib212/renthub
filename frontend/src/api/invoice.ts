import client from "./client";
import axios from "axios";
import type { Invoice, InvoiceDetail, InvoiceListResponse, InvoiceQueryParams, UpdateInvoiceInput } from "@/types/invoice";

export const invoiceApi = {
  list: async (params?: InvoiceQueryParams): Promise<InvoiceListResponse> => {
    const { data } = await client.get("/invoices", { params });
    return { data: data.data, meta: data.meta };
  },

  getById: async (id: number): Promise<InvoiceDetail> => {
    const { data } = await client.get(`/invoices/${id}`);
    return data.data;
  },

  generate: async (month: number, year: number): Promise<{ generated: number; total: number; missing: { flatName: string; billType: string }[] }> => {
    const { data } = await client.post("/invoices/generate", { month, year });
    return data.data;
  },

  update: async (id: number, input: UpdateInvoiceInput): Promise<InvoiceDetail> => {
    const { data } = await client.patch(`/invoices/${id}`, input);
    return data.data;
  },

  share: async (id: number): Promise<{ shareToken: string }> => {
    const { data } = await client.post(`/invoices/${id}/share`);
    return data.data;
  },

  /** No auth header: used by the tenant's public link. */
  getShared: async (token: string): Promise<InvoiceDetail> => {
    const { data } = await axios.get(`/api/v1/public/invoices/${encodeURIComponent(token)}`);
    return data.data;
  },

  generateAll: async (month: number, year: number): Promise<{ ownerId: number; generated: number; total: number }[]> => {
    const { data } = await client.post("/invoices/generate-all", { month, year });
    return data.data;
  },

  generateForFlat: async (flatId: number, month: number, year: number, dryRun = false): Promise<any> => {
    const { data } = await client.post("/invoices/generate-for-flat", { flatId, month, year, dryRun });
    return data.data;
  },

  deleteInvoice: async (id: number): Promise<void> => {
    await client.delete(`/invoices/${id}`);
  },

  updateStatus: async (id: number, status: string): Promise<Invoice> => {
    const { data } = await client.patch(`/invoices/${id}/status`, { status });
    return data.data;
  },
};
