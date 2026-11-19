import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, IconButton, Typography, Box,
  InputAdornment, Divider, Alert,
} from "@mui/material";
import { Add, Close } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { invoiceApi } from "@/api/invoice";
import type { InvoiceDetail, InvoiceItem } from "@/types/invoice";
import { formatBDT, apiError } from "@/utils/format";

const money = { InputProps: { startAdornment: <InputAdornment position="start">৳</InputAdornment> } };

export const InvoiceEditDialog = ({ invoice, onClose }: { invoice: InvoiceDetail; onClose: () => void }) => {
  const qc = useQueryClient();
  const [items, setItems] = useState<InvoiceItem[]>(invoice.items.map((i) => ({ ...i })));
  const [discount, setDiscount] = useState(String(invoice.discount || ""));
  const [fine, setFine] = useState(String(invoice.fine || ""));
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [dueDate, setDueDate] = useState(invoice.dueDate ? dayjs(invoice.dueDate).format("YYYY-MM-DD") : "");

  const patch = (i: number, change: Partial<InvoiceItem>) => setItems((its) => its.map((it, j) => (j === i ? { ...it, ...change } : it)));
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const total = Math.max(0, subtotal + Number(invoice.previousDue) - (Number(discount) || 0) + (Number(fine) || 0));

  const save = useMutation({
    mutationFn: () =>
      invoiceApi.update(invoice.id, {
        items: items.map(({ billTypeId, label, detail, amount }) => ({ billTypeId, label: label.trim(), detail, amount: Number(amount) || 0 })),
        discount: Number(discount) || 0,
        fine: Number(fine) || 0,
        notes: notes.trim() || null,
        dueDate: dueDate || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Invoice updated");
      onClose();
    },
    onError: (e) => toast.error(apiError(e, "Could not update invoice")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit {invoice.invoiceNo}</DialogTitle>
      <DialogContent dividers>
        {invoice.carriedForward && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This invoice's balance was already carried into a later invoice. Changes here won't update that later invoice.
          </Alert>
        )}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Charges</Typography>
        <Stack spacing={1}>
          {items.map((it, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <TextField size="small" label="Description" value={it.label} onChange={(e) => patch(i, { label: e.target.value })} />
                {it.detail && <Typography variant="caption" color="text.secondary">{it.detail}</Typography>}
              </Box>
              <TextField size="small" type="number" label="Amount" sx={{ width: 150 }} value={it.amount}
                onChange={(e) => patch(i, { amount: e.target.value as any, detail: it.billTypeId ? "Adjusted" : it.detail })} {...money} />
              <IconButton size="small" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1} aria-label="Remove line">
                <Close fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button size="small" startIcon={<Add />} sx={{ alignSelf: "flex-start" }}
            onClick={() => setItems([...items, { billTypeId: null, label: "", detail: null, amount: 0 }])}>
            Add line
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={2}>
          <TextField size="small" type="number" label="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} {...money} />
          <TextField size="small" type="number" label="Late fine" value={fine} onChange={(e) => setFine(e.target.value)} {...money} />
          <TextField size="small" type="date" label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
        <TextField sx={{ mt: 2 }} label="Note for tenant" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "grey.50", display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            Charges {formatBDT(subtotal)}{Number(invoice.previousDue) > 0 ? ` + previous due ${formatBDT(invoice.previousDue)}` : ""}
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>Total {formatBDT(total)}</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <LoadingButton variant="contained" loading={save.isPending} disabled={items.some((it) => !it.label.trim())} onClick={() => save.mutate()}>
          Save changes
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
