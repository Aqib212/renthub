export interface DashboardStats {
  totalBuildings: number;
  totalFlats: number;
  occupiedFlats: number;
  vacantFlats: number;
  vacancyRate: number;
  currentMonthCollection: number;
  currentMonthTotal: number;
  currentMonthDue: number;
  totalDue: number;
  yearlyIncome: number;
  totalExpenses: number;
  profit: number;
  collectionRate: number;
  pendingInvoices: number;
  totalInvoices: number;
}

export interface MonthlyDataPoint {
  month: number;
  amount: number;
}

export interface MonthlyCollectionPoint {
  month: number;
  collected: number;
  due: number;
}

export interface OutstandingRentItem {
  flatName: string;
  dueAmount: number;
}

export interface RecentPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
  flatName: string;
  transactionId: string | null;
}

export interface UnpaidInvoice {
  id: number;
  invoiceNo: string;
  month: number;
  year: number;
  flatName: string;
  tenantName: string | null;
  tenantPhone: string | null;
  dueAmount: number;
  status: string;
}

export interface DashboardData {
  stats: DashboardStats;
  charts: {
    monthlyIncome: MonthlyDataPoint[];
    monthlyCollection: MonthlyCollectionPoint[];
    outstandingRent: OutstandingRentItem[];
  };
  billedByType: { label: string; amount: number }[];
  unpaidInvoices: UnpaidInvoice[];
  recentPayments: RecentPayment[];
}
