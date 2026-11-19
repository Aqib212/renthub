import client from "./client";
import type { Expense, ExpenseListResponse, ExpenseQueryParams } from "@/types/expense";

export const expenseApi = {
  list: async (params?: ExpenseQueryParams): Promise<ExpenseListResponse> => {
    const { data } = await client.get("/expenses", { params });
    return data;
  },

  getById: async (id: number): Promise<Expense> => {
    const { data } = await client.get(`/expenses/${id}`);
    return data;
  },

  create: async (body: {
    category: string;
    amount: number;
    description?: string;
    date?: string;
    buildingId?: number;
  }): Promise<Expense> => {
    const { data } = await client.post("/expenses", body);
    return data;
  },

  update: async (id: number, body: Partial<{
    category: string;
    amount: number;
    description: string;
    date: string;
    buildingId: number;
  }>): Promise<Expense> => {
    const { data } = await client.patch(`/expenses/${id}`, body);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await client.delete(`/expenses/${id}`);
  },
};
