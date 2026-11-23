import { useMemo, useState } from "react";
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton,
  InputAdornment, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { Add, AccountBalanceWalletOutlined, Delete, Edit, Search, TrendingDown, TrendingUp } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseApi } from "@/api/expense";
import { buildingApi } from "@/api/building";
import { ExpenseFormDialog } from "./components/ExpenseFormDialog";
import { CategoryChip, catKey } from "./components/CategoryChip";
import { CATEGORY_TONES, EXPENSE_CATEGORIES } from "@/types/expense";
import type { Expense, ExpenseCategory, ExpenseQueryParams } from "@/types/expense";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCurrentMembership } from "@/store/authStore";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { formatBDT, formatDate, toBnDigits } from "@/utils/format";
import { tokens } from "@/theme";

type Period = "month" | "last" | "year" | "all" | "custom";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Period → date range (local days, both ends included). */
const rangeOf = (p: Period): { dateFrom?: string; dateTo?: string } => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (p === "month") return { dateFrom: ymd(new Date(y, m, 1)), dateTo: ymd(new Date(y, m + 1, 0)) };
  if (p === "last") return { dateFrom: ymd(new Date(y, m - 1, 1)), dateTo: ymd(new Date(y, m, 0)) };
  if (p === "year") return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  return {};
};

const Stat = ({ label, value, foot }: { label: string; value: string; foot?: React.ReactNode }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 26, mt: 0.5, lineHeight: 1.2 }} noWrap>{value}</Typography>
      {foot && <Box sx={{ mt: 0.75, fontSize: 13, color: "text.secondary" }}>{foot}</Box>}
    </CardContent>
  </Card>
);

const field = { fullWidth: false, size: "small" as const };

export default function ExpenseListPage() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  const role = useCurrentMembership()?.role;
  const canWrite = role === "OWNER" || role === "MANAGER" || role === "ACCOUNTANT";

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState<{ dateFrom?: string; dateTo?: string }>({});
  const [filters, setFilters] = useState<Pick<ExpenseQueryParams, "category" | "buildingId" | "search">>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const range = period === "custom" ? custom : rangeOf(period);
  const params: ExpenseQueryParams = { page: page + 1, limit: rowsPerPage, ...filters, ...range };
  const setFilter = (p: Partial<typeof filters>) => { setFilters((f) => ({ ...f, ...p })); setPage(0); };

  const { data, isLoading } = useQuery({ queryKey: ["expenses", params], queryFn: () => expenseApi.list(params) });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings", { limit: 200 }],
    queryFn: async () => { const r = await buildingApi.getAll({ limit: 200 }); return (r.data.data ?? []) as { id: number; name: string }[]; },
  });

  const remove = useMutation({
    mutationFn: (id: number) => expenseApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); setDeleteTarget(null); },
  });

  const s = data?.meta.summary;
  const rows = data?.data ?? [];
  const periodLabel = useMemo(() => {
    if (period === "month" || period === "last") {
      const d = new Date(range.dateFrom!);
      return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { month: "long", year: "numeric" });
    }
    if (period === "year") return t("exp.p.year");
    if (period === "all") return t("exp.p.all");
    return [range.dateFrom && formatDate(range.dateFrom, lang), range.dateTo && formatDate(range.dateTo, lang)].filter(Boolean).join(" – ") || t("exp.p.all");
  }, [period, range.dateFrom, range.dateTo, lang, t]);

  const top = s?.byCategory[0];
  const diff = s && s.previousTotal != null ? s.total - s.previousTotal : null;
  const hasFilters = !!(filters.category || filters.buildingId || filters.search);
  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: Expense) => { if (canWrite) { setEditing(e); setFormOpen(true); } };

  return (
    <Box>
      <PageHeader
        title={t("exp.title")}
        subtitle={t("exp.subtitle")}
        actions={canWrite && <Button variant="contained" startIcon={<Add />} onClick={openNew}>{t("exp.add")}</Button>}
      />

      {/* Summary */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={4}>
          <Stat
            label={t("exp.spent", { period: periodLabel })}
            value={formatBDT(s?.total ?? 0, lang)}
            foot={diff != null && (diff === 0 ? t("exp.same") : (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: diff > 0 ? CATEGORY_TONES.REPAIRS.fg : "success.main" }}>
                {diff > 0 ? <TrendingUp sx={{ fontSize: 16 }} /> : <TrendingDown sx={{ fontSize: 16 }} />}
                <span>{t("exp.vsPrev", { amount: formatBDT(Math.abs(diff), lang) })}</span>
              </Stack>
            ))}
          />
        </Grid>
        {!phone && (
          <Grid item md={4}>
            <Stat
              label={t("exp.biggest")}
              value={top ? t(catKey(top.category)) : "–"}
              foot={top && `${formatBDT(top.amount, lang)} · ${Math.round((top.amount / Math.max(1, s!.total)) * 100)}%`}
            />
          </Grid>
        )}
        <Grid item xs={6} md={4}>
          <Stat
            label={t("exp.entries")}
            value={lang === "bn" ? toBnDigits(s?.count ?? 0) : String(s?.count ?? 0)}
            foot={s && s.count > 0 && t("exp.split", { general: s.general, bldg: s.count - s.general })}
          />
        </Grid>
      </Grid>

      {/* Where it went */}
      {s && s.total > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontSize: 16, mb: 1.5 }}>{t("exp.where")}</Typography>
            <Box sx={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", bgcolor: tokens.rowLine, mb: 1.5 }}>
              {s.byCategory.map((c) => (
                <Tooltip key={c.category} title={`${t(catKey(c.category))}: ${formatBDT(c.amount, lang)}`}>
                  <Box sx={{ flex: c.amount, bgcolor: CATEGORY_TONES[c.category].fg, opacity: filters.category && filters.category !== c.category ? 0.25 : 1 }} />
                </Tooltip>
              ))}
            </Box>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
              {s.byCategory.map((c) => (
                <CategoryChip
                  key={c.category} c={c.category} selected={filters.category === c.category}
                  label={`${t(catKey(c.category))} ${formatBDT(c.amount, lang)}`}
                  onClick={() => setFilter({ category: filters.category === c.category ? undefined : c.category })}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} useFlexGap flexWrap="wrap">
          <TextField
            {...field} label={t("exp.search")} sx={{ flex: 1, minWidth: 200 }}
            value={filters.search ?? ""} onChange={(e) => setFilter({ search: e.target.value || undefined })}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <TextField {...field} select label={t("exp.period")} sx={{ minWidth: 150 }} value={period}
            onChange={(e) => { setPeriod(e.target.value as Period); setPage(0); }}>
            {(["month", "last", "year", "all", "custom"] as Period[]).map((p) => <MenuItem key={p} value={p}>{t(`exp.p.${p}` as MessageKey)}</MenuItem>)}
          </TextField>
          {period === "custom" && (
            <>
              <TextField {...field} type="date" label={t("exp.from")} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
                value={custom.dateFrom ?? ""} onChange={(e) => { setCustom((c) => ({ ...c, dateFrom: e.target.value || undefined })); setPage(0); }} />
              <TextField {...field} type="date" label={t("exp.to")} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
                value={custom.dateTo ?? ""} onChange={(e) => { setCustom((c) => ({ ...c, dateTo: e.target.value || undefined })); setPage(0); }} />
            </>
          )}
          <TextField {...field} select label={t("exp.building")} sx={{ minWidth: 160 }} value={filters.buildingId ?? ""}
            onChange={(e) => setFilter({ buildingId: e.target.value ? Number(e.target.value) : undefined })}>
            <MenuItem value="">{t("exp.allBuildings")}</MenuItem>
            {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          <TextField {...field} select label={t("exp.category")} sx={{ minWidth: 170 }} value={filters.category ?? ""}
            onChange={(e) => setFilter({ category: (e.target.value as ExpenseCategory) || undefined })}>
            <MenuItem value="">{t("exp.allCategories")}</MenuItem>
            {EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{t(catKey(c))}</MenuItem>)}
          </TextField>
          {hasFilters && <Button size="small" onClick={() => { setFilters({}); setPage(0); }}>{t("exp.clear")}</Button>}
        </Stack>
      </Paper>

      {/* List */}
      {!isLoading && rows.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: "center", display: "grid", justifyItems: "center", gap: 1 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: CATEGORY_TONES.HOLDING_TAX.bg, color: "primary.main", display: "grid", placeItems: "center" }}>
              <AccountBalanceWalletOutlined />
            </Box>
            <Typography variant="h6" sx={{ fontSize: 17 }}>
              {hasFilters ? t("exp.emptyFiltered") : t("exp.emptyTitle", { period: periodLabel })}
            </Typography>
            {!hasFilters && <Typography color="text.secondary" sx={{ maxWidth: 420 }}>{t("exp.emptyBody")}</Typography>}
            {canWrite && !hasFilters && <Button variant="contained" startIcon={<Add />} onClick={openNew} sx={{ mt: 1 }}>{t("exp.add")}</Button>}
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          {phone ? (
            <Box>
              {rows.map((e) => (
                <Box key={e.id} onClick={() => openEdit(e)}
                  sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${tokens.rowLine}`, cursor: canWrite ? "pointer" : "default" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <CategoryChip c={e.category} label={t(catKey(e.category))} />
                    <Typography fontWeight={700}>{formatBDT(e.amount, lang)}</Typography>
                  </Stack>
                  {e.description && <Typography fontSize={14} sx={{ mt: 0.75 }}>{e.description}</Typography>}
                  <Typography fontSize={13} color="text.secondary" sx={{ mt: 0.25 }}>
                    {formatDate(e.date, lang)} · {e.buildingName ?? t("exp.general")}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("exp.date")}</TableCell>
                  <TableCell>{t("exp.category")}</TableCell>
                  <TableCell>{t("exp.description")}</TableCell>
                  <TableCell>{t("exp.building")}</TableCell>
                  <TableCell align="right">{t("exp.amount")}</TableCell>
                  {canWrite && <TableCell align="right" sx={{ width: 96 }} />}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>…</TableCell></TableRow>
                ) : rows.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(e.date, lang)}</TableCell>
                    <TableCell><CategoryChip c={e.category} label={t(catKey(e.category))} /></TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      {e.description ? <Typography fontSize={14} noWrap title={e.description}>{e.description}</Typography> : <Typography color="text.disabled">–</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: e.buildingName ? "text.primary" : "text.secondary" }}>{e.buildingName ?? t("exp.general")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatBDT(e.amount, lang)}</TableCell>
                    {canWrite && (
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title={t("exp.edit")}><IconButton size="small" onClick={() => openEdit(e)}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title={t("exp.delete")}><IconButton size="small" color="error" onClick={() => setDeleteTarget(e)}><Delete fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <TablePagination
            component="div" count={data?.meta.total ?? 0} page={page} rowsPerPage={rowsPerPage}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </TableContainer>
      )}

      <ExpenseFormDialog
        open={formOpen} expense={editing} buildings={buildings}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onDelete={editing ? () => { setFormOpen(false); setDeleteTarget(editing); } : undefined}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("exp.deleteTitle")}</DialogTitle>
        <DialogContent>
          {deleteTarget && (
            <Typography>
              {t("exp.deleteBody", { category: t(catKey(deleteTarget.category)), amount: formatBDT(deleteTarget.amount, lang), date: formatDate(deleteTarget.date, lang) })}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t("exp.cancel")}</Button>
          <Button color="error" variant="contained" disabled={remove.isPending} onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}>
            {t("exp.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
