import { useState, useCallback } from "react";
import {
  Box, Grid, Card, CardContent, CardActionArea, Typography, Stack, Button,
  TextField, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Divider,
} from "@mui/material";
import {
  TrendingUp, Payments, Apartment, Warning, AccountBalanceWallet,
  PictureAsPdf, TableChart, Savings, EventBusy, Badge, RequestQuote,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { reportApi } from "@/api/report";
import type { ReportQuery } from "@/api/report";

import { PageHeader } from "@/components/ui/PageHeader";
const REPORT_TYPES = [
  { value: "income_expense", label: "Income vs Expense", icon: <TrendingUp />, color: "#4caf50" },
  { value: "collection", label: "Collection Report", icon: <Payments />, color: "#2196f3" },
  { value: "rent_roll", label: "Rent Roll", icon: <Apartment />, color: "#9c27b0" },
  { value: "outstanding", label: "Outstanding", icon: <Warning />, color: "#f44336" },
  { value: "expense_detail", label: "Expense Detail", icon: <AccountBalanceWallet />, color: "#ff9800" },
  { value: "deposit_liability", label: "Deposits held", icon: <Savings />, color: "#0B5D46" },
  { value: "vacancy_loss", label: "Vacancy loss", icon: <EventBusy />, color: "#B42318" },
  { value: "collection_by_collector", label: "By collector", icon: <Badge />, color: "#1D4ED8" },
  { value: "tax_statement", label: "Tax statement", icon: <RequestQuote />, color: "#8A5200" },
];

// Bangladesh income year: 1 July – 30 June
const thisFiscalYear = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const fiscalYears = Array.from({ length: 5 }, (_, i) => thisFiscalYear - i);

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState("income_expense");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [buildingId, setBuildingId] = useState<number | undefined>(undefined);
  const [fiscalYear, setFiscalYear] = useState(thisFiscalYear);
  const isTax = selectedType === "tax_statement";

  const query: ReportQuery = isTax
    ? { type: selectedType, fiscalYear, ...(buildingId && { buildingId }) }
    : {
        type: selectedType,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(month && { month }),
        ...(year && { year }),
        ...(buildingId && { buildingId }),
      };

  const { data, isLoading, isFetching } = useQuery<any>({
    queryKey: ["report", query],
    queryFn: () => reportApi.getData(query),
    placeholderData: (prev: any) => prev,
  });

  const handleDownloadPDF = useCallback(() => {
    reportApi.downloadPDF(query);
  }, [query]);

  const handleDownloadExcel = useCallback(() => {
    reportApi.downloadExcel(query);
  }, [query]);

  const renderSummary = () => {
    if (!data?.summary) return null;
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Summary</Typography>
        <Grid container spacing={2}>
          {Object.entries(data.summary).map(([key, val]) => {
            if (typeof val === "object") return null;
            const label = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
            const isNegative = key.includes("due") || (key === "netProfit" && (val as number) < 0);
            const isPositive = key === "netProfit" && (val as number) >= 0;
            return (
              <Grid item xs={6} sm={4} md={3} key={key}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography
                  variant="h6"
                  sx={{ color: isNegative ? "error.main" : isPositive ? "success.main" : undefined }}
                >
                  {typeof val === "number" ? val.toLocaleString() : String(val)}
                </Typography>
              </Grid>
            );
          })}
        </Grid>
      </Paper>
    );
  };

  const renderTable = () => {
    if (!data) return null;
    const rows = getRows(data);
    if (!rows || rows.length === 0) return <Typography color="text.secondary">No data available</Typography>;

    const headers = Object.keys(rows[0]);

    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {headers.map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600 }}>
                  {h.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row: any, i: number) => (
              <TableRow key={i} hover>
                {headers.map((h) => (
                  <TableCell key={h}>
                    {typeof row[h] === "number" ? row[h].toLocaleString() : String(row[h] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box>
      <PageHeader title="Reports" subtitle="Income, collection, rent roll and dues. Export to PDF or Excel." />

      <Grid container spacing={2} mb={3}>
        {REPORT_TYPES.map((rt) => (
          <Grid item xs={6} sm={4} md={2} key={rt.value}>
            <Card
              sx={{
                border: selectedType === rt.value ? 2 : 1,
                borderColor: selectedType === rt.value ? rt.color : "divider",
                cursor: "pointer",
              }}
              onClick={() => setSelectedType(rt.value)}
            >
              <CardActionArea>
                <CardContent sx={{ textAlign: "center", py: 2 }}>
                  <Box sx={{ color: rt.color, mb: 1 }}>{rt.icon}</Box>
                  <Typography variant="body2" fontWeight={600}>{rt.label}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {isTax ? (
            <TextField select label="Income year" size="small" sx={{ minWidth: 200 }} value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))}
              helperText="1 July – 30 June. For your accountant; not tax advice.">
              {fiscalYears.map((fy) => <MenuItem key={fy} value={fy}>{fy}–{String((fy + 1) % 100).padStart(2, "0")}</MenuItem>)}
            </TextField>
          ) : <>
          <TextField
            label="Date From" type="date" size="small" sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <TextField
            label="Date To" type="date" size="small" sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Typography variant="body2" color="text.secondary">or</Typography>
          <TextField
            select label="Month" size="small" sx={{ minWidth: 120 }}
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : undefined)}
          >
            <MenuItem value="">All</MenuItem>
            {Array.from({ length: 12 }, (_, i) => (
              <MenuItem key={i} value={i + 1}>
                {new Date(0, i).toLocaleString("default", { month: "long" })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select label="Year" size="small" sx={{ minWidth: 100 }}
            value={year ?? ""}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
          >
            <MenuItem value="">All</MenuItem>
            {years.map((y) => (
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </TextField>
          </>}
          <Divider orientation="vertical" flexItem />
          <Button
            variant="contained"
            color="error"
            startIcon={<PictureAsPdf />}
            onClick={handleDownloadPDF}
            disabled={isLoading || isFetching}
          >
            PDF
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<TableChart />}
            onClick={handleDownloadExcel}
            disabled={isLoading || isFetching}
          >
            Excel
          </Button>
        </Stack>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {renderSummary()}
          {renderTable()}
        </>
      )}
    </Box>
  );
}

function getRows(data: any): Record<string, any>[] | null {
  if (!data) return null;
  if (data.rows) return data.rows; // phase 4 reports return ready-made rows
  if (data.expenseBreakdown) return data.expenseBreakdown;
  if (data.byMethod) return data.byMethod.map((m: any) => ({ method: m.method, amount: m.amount, count: m.count }));
  if (data.flats) return data.flats.map((f: any) => ({
    flat: f.flatName,
    building: f.buildingName,
    status: f.status,
    tenant: f.tenantName || "Vacant",
    rent: f.rent,
    invoice: f.invoiceStatus || "—",
    due: f.dueAmount ?? "—",
  }));
  if (data.invoices) return data.invoices.map((inv: any) => ({
    flat: inv.flatName,
    tenant: inv.tenantName || "—",
    period: `${inv.month}/${inv.year}`,
    total: inv.totalAmount,
    paid: inv.paidAmount,
    due: inv.dueAmount,
    status: inv.status,
  }));
  if (data.expenses) return data.expenses.map((e: any) => ({
    date: e.date ? new Date(e.date).toLocaleDateString() : "",
    category: e.category,
    description: e.description || "—",
    building: e.buildingName || "General",
    amount: e.amount,
  }));
  return null;
}
