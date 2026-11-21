import client from "./client";

export interface ReportQuery {
  type: string;
  dateFrom?: string;
  dateTo?: string;
  month?: number;
  year?: number;
  buildingId?: number;
  /** income year starting 1 July (tax_statement) */
  fiscalYear?: number;
}

export const reportApi = {
  getData: async (params: ReportQuery) => {
    const { data } = await client.get("/reports", { params });
    return data.data;
  },

  downloadPDF: async (params: ReportQuery): Promise<void> => {
    const { data } = await client.get("/reports/pdf", {
      params,
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${params.type}_report.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  downloadExcel: async (params: ReportQuery): Promise<void> => {
    const { data } = await client.get("/reports/excel", {
      params,
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${params.type}_report.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
