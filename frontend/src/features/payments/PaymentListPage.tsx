import { useState } from "react";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Chip, IconButton, TablePagination, TextField, MenuItem, Button,
  Stack, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import { Visibility, Delete, Receipt } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentApi } from "@/api/payment";
import { PaymentFormDialog } from "./components/PaymentFormDialog";
import { PaymentDetailDialog } from "./components/PaymentDetailDialog";
import { METHOD_LABELS, METHOD_COLORS } from "@/types/payment";
import type { Payment, PaymentMethod, PaymentQueryParams } from "@/types/payment";

import { PageHeader } from "@/components/ui/PageHeader";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Link } from "@mui/material";
import { cashApi } from "@/api/collections";
import { useT } from "@/i18n";
import { formatBDT } from "@/utils/format";
export default function PaymentListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState<PaymentQueryParams>({});
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formInvoiceId, setFormInvoiceId] = useState<number | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  const queryParams: PaymentQueryParams = {
    page: page + 1,
    limit: rowsPerPage,
    ...filters,
  };

  const { t, lang } = useT();
  const navigate = useNavigate();
  const { data: cash } = useQuery({ queryKey: ["cash-pending"], queryFn: cashApi.pending });
  const { data, isLoading } = useQuery({
    queryKey: ["payments", queryParams],
    queryFn: () => paymentApi.list(queryParams),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setDeleteTarget(null);
    },
  });

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleView = (payment: Payment) => {
    setSelectedPayment(payment);
    setDetailOpen(true);
  };

  const handleRecordPayment = () => {
    setFormInvoiceId(undefined);
    setFormOpen(true);
  };

  return (
    <Box>
      <PageHeader
        title={t("nav.collections")}
        subtitle="Every payment received, with its receipt number. The tenant gets the receipt by SMS."
        actions={<>
          <Button variant="outlined" onClick={() => navigate("/cash-handover")}>{t("cash.withStaff", { amount: formatBDT(cash?.total ?? 0, lang) })}</Button>
          <Button variant="contained" startIcon={<Receipt />} onClick={handleRecordPayment}>
          Record Payment
          </Button>
        </>}
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            select label="Method" size="small" sx={{ minWidth: 140 }}
            value={filters.method ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, method: e.target.value as PaymentMethod || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <MenuItem key={m} value={m}>{METHOD_LABELS[m]}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Date From" type="date" size="small" sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))}
          />
          <TextField
            label="Date To" type="date" size="small" sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))}
          />
          <TextField
            label="Search" size="small" sx={{ minWidth: 200 }}
            value={filters.search ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value || undefined }))}
            placeholder="Transaction ID, collector..."
          />
          {(filters.method || filters.dateFrom || filters.dateTo || filters.search) && (
            <Button size="small" onClick={() => { setFilters({}); setPage(0); }}>Clear</Button>
          )}
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("rcp.view")}</TableCell>
              <TableCell>Flat</TableCell>
              <TableCell>Tenant</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell>Method</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Reference / collector</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} align="center">Loading...</TableCell></TableRow>
            ) : !data?.data.length ? (
              <TableRow><TableCell colSpan={9} align="center">No payments found</TableCell></TableRow>
            ) : data.data.map((payment) => (
              <TableRow key={payment.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {payment.receiptNo ? <Link component={RouterLink} to={`/payments/${payment.id}/receipt`}>{payment.receiptNo}</Link> : "—"}
                </TableCell>
                <TableCell>{payment.flatName}</TableCell>
                <TableCell>{payment.tenantName || "—"}</TableCell>
                <TableCell>{payment.invoicePeriod}</TableCell>
                <TableCell>
                  <Chip
                    label={METHOD_LABELS[payment.method]}
                    size="small"
                    sx={{ backgroundColor: METHOD_COLORS[payment.method], color: "#fff" }}
                  />
                </TableCell>
                <TableCell align="right">{payment.amount.toLocaleString()}</TableCell>
                <TableCell>
                  {payment.transactionId || "—"}
                  {payment.collectorName && <Typography variant="body2" color="text.secondary">{payment.collectorName}</Typography>}
                </TableCell>
                <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => handleView(payment)}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(payment)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.meta?.total ?? 0}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>

      {selectedPayment && (
        <PaymentDetailDialog
          open={detailOpen}
          paymentId={selectedPayment.id}
          onClose={() => { setDetailOpen(false); setSelectedPayment(null); }}
        />
      )}

      <PaymentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        preselectedInvoiceId={formInvoiceId}
      />

      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Delete payment of {deleteTarget.amount.toLocaleString()}? This will recalculate the invoice balance.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(deleteTarget.id)}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
