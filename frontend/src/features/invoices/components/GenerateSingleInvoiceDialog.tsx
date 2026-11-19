import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Alert, Snackbar, CircularProgress, Box,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceApi } from "@/api/invoice";
import { flatApi } from "@/api/flat";
import { tenantApi } from "@/api/tenant";
import { MONTH_NAMES } from "@/types/invoice";
import { useNavigate } from "react-router-dom";
import { formatBDT, apiError } from "@/utils/format";

const currentYear = new Date().getFullYear();
const now = new Date();
const defaultMonth = now.getMonth() + 1;
const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GenerateSingleInvoiceDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [flatId, setFlatId] = useState<number | "">("");
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(currentYear);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const [flats, setFlats] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setFlatId("");
    setPreviewData(null);
    (async () => {
      try {
        const [flatRes, tenantRes] = await Promise.all([
          flatApi.getAllForOwner(),
          tenantApi.getAllForOwner(),
        ]);
        setFlats((flatRes.data.data || []).filter((f: any) => f.status === "OCCUPIED"));
        setTenants(tenantRes.data.data || []);
      } catch { }
    })();
  }, [open]);

  const selectedFlat = flats.find((f: any) => f.id === flatId);
  const activeTenant = tenants.find((t: any) => t.flatId === flatId && t.status === "ACTIVE");

  const generateMutation = useMutation({
    mutationFn: () => invoiceApi.generateForFlat(flatId as number, month, year, false),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-month"] });
      setPreviewData(null);
      onClose();
      navigate(`/invoices/${result.id}/print`);
    },
    onError: (err: any) => {
      setSnackbar({ message: apiError(err, "Generation failed"), severity: "error" });
    },
  });

  const handlePreview = async () => {
    if (!flatId) return;
    setPreviewLoading(true);
    try {
      const data = await invoiceApi.generateForFlat(flatId as number, month, year, true);
      setPreviewData(data);
    } catch (err: any) {
      setSnackbar({ message: apiError(err, "Preview failed"), severity: "error" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = () => generateMutation.mutate();

  const chargeRows = previewData
    ? [
        ...previewData.items.map((it: any) => ({ label: it.label, detail: it.detail, value: it.amount })),
        ...(previewData.previousDue > 0 ? [{ label: "Previous due", value: previewData.previousDue }] : []),
        { label: "Total", value: previewData.totalAmount, bold: true },
      ]
    : [];

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Invoice for Flat</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select label="Flat" fullWidth required value={flatId}
              onChange={(e) => { setFlatId(Number(e.target.value)); setPreviewData(null); }}
            >
              <MenuItem value="" disabled>Select a flat</MenuItem>
              {flats.map((f: any) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.floor?.building?.name || ""} / {f.floor?.name || ""} / {f.name}
                </MenuItem>
              ))}
            </TextField>

            {selectedFlat && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Flat Details</Typography>
                <Typography variant="body2">Rent: {formatBDT(selectedFlat.rent)}</Typography>
                {activeTenant && (
                  <Typography variant="body2">
                    Tenant: {activeTenant.firstName} {activeTenant.lastName} ({activeTenant.phone || "—"})
                  </Typography>
                )}
              </Paper>
            )}

            <Stack direction="row" spacing={2}>
              <TextField
                select label="Month" fullWidth required value={month}
                onChange={(e) => { setMonth(Number(e.target.value)); setPreviewData(null); }}
              >
                {MONTH_NAMES.map((name, i) => (
                  <MenuItem key={i} value={i + 1}>{name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select label="Year" fullWidth required value={year}
                onChange={(e) => { setYear(Number(e.target.value)); setPreviewData(null); }}
              >
                {years.map((y) => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </TextField>
            </Stack>

            {previewData?.missing?.length > 0 && (
              <Alert severity="warning">
                Not entered for this month, so left off: {previewData.missing.map((m: any) => m.billType).join(", ")}.
                Add them in Monthly Billing first, or edit the invoice afterwards.
              </Alert>
            )}
            {previewData && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Charge</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {chargeRows.map((row: any) => (
                      <TableRow key={row.label}>
                        <TableCell sx={row.bold ? { fontWeight: 700 } : undefined}>
                          {row.label}
                          {row.detail && <Typography variant="caption" color="text.secondary" display="block">{row.detail}</Typography>}
                        </TableCell>
                        <TableCell align="right" sx={row.bold ? { fontWeight: 700 } : undefined}>
                          {formatBDT(row.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          {!previewData ? (
            <Button
              variant="outlined"
              onClick={handlePreview}
              disabled={!flatId || previewLoading}
              startIcon={previewLoading ? <CircularProgress size={16} /> : undefined}
            >
              {previewLoading ? "Loading..." : "Preview"}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              startIcon={generateMutation.isPending ? <CircularProgress size={16} /> : undefined}
            >
              {generateMutation.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {snackbar && (
        <Snackbar
          open
          autoHideDuration={4000}
          onClose={() => setSnackbar(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}