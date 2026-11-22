import client from "./client";

export type DocumentKind = "NID" | "AGREEMENT" | "PHOTO" | "UTILITY" | "OTHER" | "REGISTRATION" | "FITNESS" | "TAX_TOKEN" | "ROUTE_PERMIT" | "INSURANCE" | "LICENCE" | "ENLISTMENT";
export interface VaultDocument {
  id: number;
  kind: DocumentKind;
  name: string;
  mime: string | null;
  size: number | null;
  expiresAt: string | null;
  createdAt: string;
  uploadedBy: { user: { firstName: string; lastName: string } } | null;
}
export type DocumentLink = { tenantId?: number; assetId?: number; agreementId?: number };

export const DOCUMENT_KINDS: Record<DocumentKind, string> = {
  NID: "NID / passport",
  AGREEMENT: "Signed agreement",
  PHOTO: "Photo",
  UTILITY: "Utility paper",
  OTHER: "Other",
  REGISTRATION: "Registration (blue book)",
  FITNESS: "Fitness certificate",
  TAX_TOKEN: "Tax token",
  ROUTE_PERMIT: "Route permit",
  INSURANCE: "Insurance",
  LICENCE: "Driving licence",
  ENLISTMENT: "Ride-share enlistment",
};

export const documentApi = {
  list: (link: DocumentLink) => client.get("/documents", { params: link }).then((r) => r.data.data as VaultDocument[]),
  upload: (file: File, body: DocumentLink & { kind: DocumentKind; name?: string; expiresAt?: string }) => {
    const fd = new FormData();
    fd.append("file", file);
    Object.entries(body).forEach(([k, v]) => v !== undefined && v !== "" && fd.append(k, String(v)));
    return client.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data as VaultDocument);
  },
  remove: (id: number) => client.delete(`/documents/${id}`),
  /** Files need the auth header, so fetch as a blob and open it in a new tab. */
  open: async (id: number) => {
    const tab = window.open("", "_blank");
    const r = await client.get(`/documents/${id}/file`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data as Blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  blobUrl: async (id: number) => URL.createObjectURL((await client.get(`/documents/${id}/file`, { responseType: "blob" })).data as Blob),
};
