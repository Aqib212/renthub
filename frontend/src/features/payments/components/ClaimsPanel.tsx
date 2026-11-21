import { useState } from "react";
import { Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import client from "@/api/client";
import { METHOD_LABELS, type PaymentMethod } from "@/types/payment";
import { MONTH_NAMES } from "@/types/invoice";
import { apiError, formatBDT } from "@/utils/format";
import { CHIP } from "@/theme";

export interface ClaimRow {
  id: number;
  amount: number;
  method: PaymentMethod;
  transactionId: string;
  paidOn: string;
  note: string | null;
  createdAt: string;
  tenant: { firstName: string; lastName: string; phone: string | null };
  invoice: { id: number; month: number; year: number; dueAmount: number; flat: { name: string; floor: { building: { name: string } } } };
}

export const claimsApi = {
  pending: () => client.get("/payment-claims", { params: { status: "PENDING" } }).then((r) => r.data.data as ClaimRow[]),
  confirm: (id: number, amount?: number) => client.post(`/payment-claims/${id}/confirm`, { amount }),
  reject: (id: number, reason: string) => client.post(`/payment-claims/${id}/reject`, { reason }),
};

/** "I paid" reports from the tenant portal: check the bKash / bank statement, then confirm (records the payment) or reject. */
export const ClaimsPanel = () => {
  const qc = useQueryClient();
  const { data: claims = [] } = useQuery({ queryKey: ["payment-claims"], queryFn: claimsApi.pending });
  const [rejecting, setRejecting] = useState<ClaimRow | null>(null);
  const done = (msg: string) => () => {
    toast.success(msg);
    ["payment-claims", "payments", "invoices", "invoice", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const confirm = useMutation({ mutationFn: (c: ClaimRow) => claimsApi.confirm(c.id), onSuccess: done("Payment recorded and receipt sent"), onError: (e) => toast.error(apiError(e)) });
  if (!claims.length) return null;

  return (
    <Card sx={{ mb: 2, borderColor: CHIP.warning.fg }}>
      <CardContent>
        <Typography variant="h6" fontSize={16}>Payments to confirm ({claims.length})</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Tenants reported these in the portal. Check them against your bKash, Nagad or bank statement first.
        </Typography>
        <Stack spacing={1.25}>
          {claims.map((c) => (
            <Stack key={c.id} direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} sx={{ borderTop: 1, borderColor: "divider", pt: 1.25 }}>
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} fontSize={14}>
                  {formatBDT(c.amount)} · {METHOD_LABELS[c.method]} · {c.transactionId}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {c.tenant.firstName} {c.tenant.lastName} · {c.invoice.flat.name}, {c.invoice.flat.floor.building.name} · {MONTH_NAMES[c.invoice.month - 1]} {c.invoice.year} bill · paid {new Date(c.paidOn).toLocaleDateString("en-GB", { timeZone: "UTC" })}
                  {c.note ? ` · “${c.note}”` : ""}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button color="error" onClick={() => setRejecting(c)}>Reject</Button>
                <Button variant="contained" disabled={confirm.isPending} onClick={() => confirm.mutate(c)}>Confirm</Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </CardContent>
      {rejecting && <RejectDialog claim={rejecting} onClose={() => setRejecting(null)} onDone={done("Claim rejected; the tenant gets an SMS")} />}
    </Card>
  );
};

const RejectDialog = ({ claim, onClose, onDone }: { claim: ClaimRow; onClose: () => void; onDone: () => void }) => {
  const [reason, setReason] = useState("Transaction not found in our statement");
  const m = useMutation({ mutationFn: () => claimsApi.reject(claim.id, reason), onSuccess: () => { onDone(); onClose(); }, onError: (e) => toast.error(apiError(e)) });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Reject {formatBDT(claim.amount)} from {claim.tenant.firstName}?</DialogTitle>
      <DialogContent sx={{ pt: "8px !important" }}>
        <TextField fullWidth label="Reason (sent to the tenant)" value={reason} onChange={(e) => setReason(e.target.value)} multiline
          InputProps={{ startAdornment: <InputAdornment position="start">✉</InputAdornment> }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>Reject</Button>
      </DialogActions>
    </Dialog>
  );
};
