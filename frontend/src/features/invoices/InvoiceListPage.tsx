import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Chip, IconButton, TablePagination, TextField, MenuItem, Button, Stack, Tooltip, InputAdornment,
} from "@mui/material";
import { Add, VisibilityOutlined, PaymentsOutlined, DeleteOutline, Search, EditCalendarOutlined } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { invoiceApi } from "@/api/invoice";
import { PageHeader } from "@/components/ui/PageHeader";
import { GenerateSingleInvoiceDialog } from "./components/GenerateSingleInvoiceDialog";
import { PaymentFormDialog } from "@/features/payments/components/PaymentFormDialog";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MONTH_NAMES } from "@/types/invoice";
import type { InvoiceStatus, InvoiceQueryParams } from "@/types/invoice";
import { INVOICE_STATUS } from "@/theme";
import { formatBDT, apiError } from "@/utils/format";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i);

export default function InvoiceListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState<InvoiceQueryParams>(() => ({
    month: params.get("month") ? Number(params.get("month")) : undefined,
    year: params.get("year") ? Number(params.get("year")) : undefined,
  }));
  const [singleGenerateOpen, setSingleGenerateOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<number | undefined>(undefined);

  const queryParams: InvoiceQueryParams = { page: page + 1, limit: rowsPerPage, ...filters };
  const { data, isLoading } = useQuery({ queryKey: ["invoices", queryParams], queryFn: () => invoiceApi.list(queryParams) });

  const remove = useMutation({
    mutationFn: (id: number) => invoiceApi.deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["billing-month"] });
      toast.success("Invoice deleted");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const setFilter = (change: Partial<InvoiceQueryParams>) => {
    setFilters((p) => ({ ...p, ...change }));
    setPage(0);
  };
  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <Box>
      <PageHeader
        title="Invoices"
        subtitle="Every monthly bill sent to your tenants. Open one to print it, share the link or record a payment."
        actions={
          <>
            <Button variant="outlined" startIcon={<Add />} onClick={() => setSingleGenerateOpen(true)}>Invoice one flat</Button>
            <Button variant="contained" startIcon={<EditCalendarOutlined />} onClick={() => navigate("/billing")}>Monthly billing</Button>
          </>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField
            label="Search flat or tenant" size="small" sx={{ flex: 1 }}
            value={filters.search ?? ""}
            onChange={(e) => setFilter({ search: e.target.value || undefined })}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <TextField select label="Month" size="small" sx={{ minWidth: 140 }} value={filters.month ?? ""}
            onChange={(e) => setFilter({ month: e.target.value ? Number(e.target.value) : undefined })}>
            <MenuItem value="">All months</MenuItem>
            {MONTH_NAMES.map((name, i) => <MenuItem key={i} value={i + 1}>{name}</MenuItem>)}
          </TextField>
          <TextField select label="Year" size="small" sx={{ minWidth: 110 }} value={filters.year ?? ""}
            onChange={(e) => setFilter({ year: e.target.value ? Number(e.target.value) : undefined })}>
            <MenuItem value="">All</MenuItem>
            {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <TextField select label="Status" size="small" sx={{ minWidth: 140 }} value={filters.status ?? ""}
            onChange={(e) => setFilter({ status: (e.target.value as InvoiceStatus) || undefined })}>
            <MenuItem value="">All</MenuItem>
            {Object.entries(INVOICE_STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
          </TextField>
          {hasFilters && <Button size="small" onClick={() => { setFilters({}); setPage(0); }}>Clear</Button>}
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice</TableCell>
              <TableCell>Flat / Tenant</TableCell>
              <TableCell>Month</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell align="right">Due</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}>Loading…</TableCell></TableRow>
            ) : !data?.data.length ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <Typography sx={{ fontWeight: 600 }}>No invoices yet</Typography>
                  <Typography variant="body2" color="text.secondary">Go to Monthly Billing to create this month's invoices.</Typography>
                </TableCell>
              </TableRow>
            ) : data.data.map((inv) => (
              <TableRow key={inv.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/invoices/${inv.id}/print`)}>
                <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{inv.invoiceNo}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{inv.flatName}</Typography>
                  <Typography variant="caption" color="text.secondary">{inv.tenantName || "—"}{inv.buildingName ? ` · ${inv.buildingName}` : ""}</Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{MONTH_NAMES[inv.month - 1].slice(0, 3)} {inv.year}</TableCell>
                <TableCell align="right">{formatBDT(inv.totalAmount)}</TableCell>
                <TableCell align="right" sx={{ color: "success.main" }}>{formatBDT(inv.paidAmount)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: inv.dueAmount > 0 && !inv.carriedForward ? "error.main" : "text.secondary" }}>
                  {formatBDT(inv.dueAmount)}
                </TableCell>
                <TableCell>
                  {inv.carriedForward ? (
                    <Tooltip title="Balance moved to the next month's invoice"><Chip size="small" label="Carried fwd" /></Tooltip>
                  ) : (
                    <Chip size="small" color={INVOICE_STATUS[inv.status].color} label={INVOICE_STATUS[inv.status].label} />
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="View / print">
                    <IconButton size="small" onClick={() => navigate(`/invoices/${inv.id}/print`)}><VisibilityOutlined fontSize="small" /></IconButton>
                  </Tooltip>
                  <WhatsAppButton icon path={`/invoices/${inv.id}/share-text`} disabled={inv.carriedForward || inv.dueAmount <= 0} />
                  <Tooltip title="Record payment">
                    <span>
                      <IconButton size="small" color="primary" disabled={inv.carriedForward || inv.dueAmount <= 0} onClick={() => setPaymentInvoiceId(inv.id)}>
                        <PaymentsOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <span>
                      <IconButton size="small" color="error" disabled={inv.paidAmount > 0}
                        onClick={() => confirm(`Delete ${inv.invoiceNo}?`) && remove.mutate(inv.id)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </span>
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
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>

      <GenerateSingleInvoiceDialog open={singleGenerateOpen} onClose={() => setSingleGenerateOpen(false)} />
      <PaymentFormDialog open={paymentInvoiceId !== undefined} onClose={() => setPaymentInvoiceId(undefined)} preselectedInvoiceId={paymentInvoiceId} />
    </Box>
  );
}
