import client from "./client";
import type { Payment, PaymentDetail, PaymentListResponse, PaymentQueryParams } from "@/types/payment";

export const paymentApi = {
  list: async (params?: PaymentQueryParams): Promise<PaymentListResponse> => {
    const { data } = await client.get("/payments", { params });
    return { data: data.data, meta: data.meta };
  },

  getById: async (id: number): Promise<PaymentDetail> => {
    const { data } = await client.get(`/payments/${id}`);
    return data.data;
  },

  create: async (body: {
    invoiceId: number;
    amount: number;
    method: string;
    transactionId?: string;
    collector?: string;
    remarks?: string;
    date?: string;
  }): Promise<Payment> => {
    const { data } = await client.post("/payments", body);
    return data.data;
  },

  update: async (id: number, body: Partial<{
    amount: number;
    method: string;
    transactionId: string;
    collector: string;
    remarks: string;
    date: string;
  }>): Promise<Payment> => {
    const { data } = await client.patch(`/payments/${id}`, body);
    return data.data;
  },

  remove: async (id: number): Promise<void> => {
    await client.delete(`/payments/${id}`);
  },
};
