import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, CircularProgress, Autocomplete,
} from "@mui/material";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { paymentApi } from "@/api/payment";
import { invoiceApi } from "@/api/invoice";
import { METHOD_LABELS } from "@/types/payment";
import { MONTH_NAMES } from "@/types/invoice";
import type { PaymentMethod } from "@/types/payment";
import toast from "react-hot-toast";
import { toastWarnings } from "@/features/agreements/WarningsAlert";
import { formatBDT, apiError } from "@/utils/format";

interface Props {
  open: boolean;
  onClose: () => void;
  preselectedInvoiceId?: number;
}

export function PaymentFormDialog({ open, onClose, preselectedInvoiceId }: Props) {
  const queryClient = useQueryClient();
  const [invoiceId, setInvoiceId] = useState<number>(preselectedInvoiceId ?? 0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [collector, setCollector] = useState("");
  const [remarks, setRemarks] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");

  const { data: invoiceList } = useQuery({
    queryKey: ["invoices", { limit: 100 }],
    queryFn: () => invoiceApi.list({ limit: 100 }),
    enabled: open,
  });

  // carried-forward invoices are settled through the later invoice that includes their balance
  const invoiceOptions = invoiceList?.data
    ?.filter((inv) => inv.id === preselectedInvoiceId || (!inv.carriedForward && inv.dueAmount > 0))
    .map((inv) => ({
      id: inv.id,
      label: `${inv.invoiceNo} · ${inv.flatName} · ${MONTH_NAMES[inv.month - 1]} ${inv.year} (Due ${formatBDT(inv.dueAmount)})`,
    })) || [];

  useEffect(() => {
    if (open) {
      setInvoiceId(preselectedInvoiceId ?? 0);
      setInvoiceInput("");
      setAmount("");
      setMethod("CASH");
      setTransactionId("");
      setCollector("");
      setRemarks("");
    }
  }, [open, preselectedInvoiceId]);

  const selectedInvoice = invoiceList?.data?.find((inv) => inv.id === invoiceId);

  useEffect(() => {
    if (selectedInvoice && open) setAmount(String(selectedInvoice.dueAmount));
  }, [selectedInvoice?.id, open]);

  const createMutation = useMutation({
    mutationFn: () => paymentApi.create({
      invoiceId,
      amount: parseFloat(amount),
      method,
      transactionId: transactionId || undefined,
      collector: collector || undefined,
      remarks: remarks || undefined,
    }),
    onSuccess: (p: any) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["billing-month"] });
      toast.success("Payment recorded");
      toastWarnings(p?.warnings); // e.g. cash on rent above ৳25,000 (NBR)
      onClose();
    },
    onError: (e) => toast.error(apiError(e, "Could not record payment")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId || !amount || parseFloat(amount) <= 0) return;
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={invoiceOptions}
              value={invoiceOptions.find((o) => o.id === invoiceId) || null}
              onChange={(_, v) => setInvoiceId(v?.id ?? 0)}
              inputValue={invoiceInput}
              onInputChange={(_, v) => setInvoiceInput(v)}
              renderInput={(params) => (
                <TextField {...params} label="Invoice" required />
              )}
              fullWidth
              disabled={!!preselectedInvoiceId}
            />
            {selectedInvoice && (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Total" size="small" sx={{ flex: 1 }}
                  value={formatBDT(selectedInvoice.totalAmount)}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  label="Due" size="small" sx={{ flex: 1 }}
                  value={formatBDT(selectedInvoice.dueAmount)}
                  InputProps={{ readOnly: true }}
                />
              </Stack>
            )}
            <TextField
              label="Amount" type="number" required fullWidth
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              select label="Payment Method" required fullWidth value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <MenuItem key={m} value={m}>{METHOD_LABELS[m]}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Transaction ID" fullWidth value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="bKash/Cheque/Bank reference"
            />
            <TextField
              label="Collected By" fullWidth value={collector}
              onChange={(e) => setCollector(e.target.value)}
              placeholder="Collector name"
            />
            <TextField
              label="Remarks" fullWidth multiline rows={2} value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit" variant="contained"
            disabled={createMutation.isPending || !invoiceId || !amount || parseFloat(amount) <= 0}
            startIcon={createMutation.isPending ? <CircularProgress size={16} /> : undefined}
          >
            {createMutation.isPending ? "Saving..." : "Record Payment"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
