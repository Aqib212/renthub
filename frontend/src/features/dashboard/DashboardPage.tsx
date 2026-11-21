import { Box, Grid, Card, CardContent, Typography, Table, TableHead, TableBody, TableRow, TableCell, Chip, Button, Stack, IconButton, Tooltip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ReceiptLongOutlined, EditCalendarOutlined, PrintOutlined } from "@mui/icons-material";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBDT } from "@/utils/format";
import { INVOICE_STATUS } from "@/theme";
import {
  Apartment,
  Payments,
  MoneyOff,
} from "@mui/icons-material";
import { useDashboard } from "@/hooks/useDashboard";
import { StatCard } from "./components/StatCard";
import { MonthlyCollectionChart } from "./components/Charts/MonthlyCollectionChart";
import { IncomeTrendChart } from "./components/Charts/IncomeTrendChart";
import { VacancyRateChart } from "./components/Charts/VacancyRateChart";
import { OutstandingRentChart } from "./components/Charts/OutstandingRentChart";
import dayjs from "dayjs";
import { Alert } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { claimsApi } from "@/features/payments/components/ClaimsPanel";
import { agreementApi } from "@/api/agreement";

/** Things tenants sent from the portal that wait for staff. */
const PortalInbox = () => {
  const navigate = useNavigate();
  const { data: claims = [] } = useQuery({ queryKey: ["payment-claims"], queryFn: claimsApi.pending });
  const { data: notices = [] } = useQuery({ queryKey: ["notice-requests"], queryFn: () => agreementApi.noticeRequests() });
  if (!claims.length && !notices.length) return null;
  return (
    <Alert severity="info" sx={{ mb: 2 }} action={<>
      {claims.length > 0 && <Button color="inherit" size="small" onClick={() => navigate("/payments")}>Payments</Button>}
      {notices.length > 0 && <Button color="inherit" size="small" onClick={() => navigate(`/agreements/${notices[0].agreementId}`)}>Notice</Button>}
    </>}>
      From the tenant portal: {claims.length} payment(s) to confirm{notices.length ? `, ${notices.length} move-out request(s)` : ""}.
    </Alert>
  );
};

export const DashboardPage = () => {
  const { data, isLoading, error } = useDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <Typography color="error">Failed to load dashboard data</Typography>
      </Box>
    );
  }

  const { stats, charts, recentPayments, billedByType, unpaidInvoices } = data;
  const formatCurrency = formatBDT;
  const collectedPct = stats.currentMonthTotal > 0 ? (stats.currentMonthCollection / stats.currentMonthTotal) * 100 : 0;
  const occupancyPct = stats.totalFlats > 0 ? (stats.occupiedFlats / stats.totalFlats) * 100 : 0;
  const maxType = Math.max(1, ...billedByType.map((b) => b.amount));
  const monthLabel = dayjs().format("MMMM YYYY");

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for ${monthLabel}`}
        actions={
          <>
            <Button variant="outlined" startIcon={<ReceiptLongOutlined />} onClick={() => navigate("/invoices")}>Invoices</Button>
            <Button variant="contained" startIcon={<EditCalendarOutlined />} onClick={() => navigate("/billing")}>Monthly billing</Button>
          </>
        }
      />
      <PortalInbox />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Billed this month" value={formatCurrency(stats.currentMonthTotal)} icon={<ReceiptLongOutlined />} color="#1D4ED8"
            subtitle={`${stats.totalInvoices} invoice(s)`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Collected this month" value={formatCurrency(stats.currentMonthCollection)} icon={<Payments />} color="#0B5D46"
            progress={collectedPct} subtitle={`${Math.round(collectedPct)}% of this month's bills`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total outstanding" value={formatCurrency(stats.totalDue)} icon={<MoneyOff />} color="#B42318"
            subtitle={`${stats.pendingInvoices} unpaid invoice(s)`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Occupancy" value={`${stats.occupiedFlats} / ${stats.totalFlats}`} icon={<Apartment />} color="#0B5D46"
            progress={occupancyPct} subtitle={`${stats.vacantFlats} vacant · ${stats.totalBuildings} building(s)`} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontSize: 16 }}>This month by bill type</Typography>
              <Typography variant="caption" color="text.secondary">What you billed for {monthLabel}</Typography>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {billedByType.length === 0 && (
                  <Typography color="text.secondary" variant="body2">No invoices for this month yet.</Typography>
                )}
                {billedByType.map((b) => (
                  <Box key={b.label}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{b.label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(b.amount)}</Typography>
                    </Stack>
                    <Box sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: "grey.100" }}>
                      <Box sx={{ height: "100%", width: `${(b.amount / maxType) * 100}%`, borderRadius: 3, bgcolor: "primary.main" }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ fontSize: 16 }}>Unpaid invoices</Typography>
                <Button size="small" onClick={() => navigate("/invoices")}>View all</Button>
              </Stack>
              <Table size="small" sx={{ mt: 1 }}>
                <TableBody>
                  {unpaidInvoices.length === 0 ? (
                    <TableRow><TableCell sx={{ border: 0, py: 3 }} align="center"><Typography color="text.secondary">Everyone has paid. 🎉</Typography></TableCell></TableRow>
                  ) : unpaidInvoices.map((inv) => (
                    <TableRow key={inv.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/invoices/${inv.id}/print`)}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{inv.flatName} · {inv.tenantName ?? "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">{inv.invoiceNo} · {dayjs().month(inv.month - 1).format("MMM")} {inv.year}</Typography>
                      </TableCell>
                      <TableCell><Chip size="small" color={INVOICE_STATUS[inv.status]?.color} label={INVOICE_STATUS[inv.status]?.label} /></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "error.main", whiteSpace: "nowrap" }}>{formatCurrency(inv.dueAmount)}</TableCell>
                      <TableCell align="right" padding="checkbox">
                        <Tooltip title="Open, print or share"><IconButton size="small"><PrintOutlined fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Monthly Collection
              </Typography>
              <Box sx={{ height: 280 }}>
                <MonthlyCollectionChart data={charts.monthlyCollection} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Vacancy Rate
              </Typography>
              <Box sx={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Box sx={{ width: "80%", maxWidth: 240 }}>
                  <VacancyRateChart occupied={stats.occupiedFlats} vacant={stats.vacantFlats} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Income Trend
              </Typography>
              <Box sx={{ height: 280 }}>
                <IncomeTrendChart data={charts.monthlyIncome} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Outstanding Rent by Flat
              </Typography>
              <Box sx={{ height: 280 }}>
                <OutstandingRentChart data={charts.outstandingRent} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Payments */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
            Recent Payments
          </Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Flat</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Transaction ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No payments yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                recentPayments.map((payment) => (
                  <TableRow key={payment.id} hover>
                    <TableCell>{payment.flatName}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      <Chip
                        label={payment.method}
                        size="small"
                        color={payment.method === "CASH" ? "success" : "primary"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {payment.transactionId || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {dayjs(payment.date).format("DD MMM YYYY")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
};
