import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, IconButton, Stack, TextField, Typography } from "@mui/material";
import { AddOutlined, DeleteOutline } from "@mui/icons-material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { agreementApi, today } from "@/api/agreement";
import { apiError, formatBDT } from "@/utils/format";
import { toastWarnings } from "./WarningsAlert";

/** Move-out settlement: final pro-rated month, deductions, deposit against dues, refund or amount still owed. */
export const MoveOutPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: a } = useQuery({ queryKey: ["agreement", id], queryFn: () => agreementApi.get(id!) });
  const [endDate, setEndDate] = useState(today());
  const [finalInvoice, setFinalInvoice] = useState(true);
  const [deductions, setDeductions] = useState<{ amount: number; note: string }[]>([]);

  useEffect(() => {
    if (a?.endDate) setEndDate(a.endDate.slice(0, 10));
  }, [a?.endDate]);

  const valid = deductions.filter((d) => d.amount > 0 && d.note.trim());
  const { data: s } = useQuery({
    queryKey: ["settlement", id, endDate, finalInvoice, JSON.stringify(valid)],
    queryFn: () => agreementApi.settlement(Number(id), { endDate, deductions: valid, finalInvoice }),
    enabled: !!a && !!endDate,
  });

  const end = useMutation({
    mutationFn: () => agreementApi.end(Number(id), { endDate, deductions: valid, finalInvoice }),
    onSuccess: (r) => {
      toast.success(r.due > 0 ? `Moved out. ${formatBDT(r.due)} is still owed.` : "Moved out and settled.");
      toastWarnings(r.warnings);
      qc.invalidateQueries();
      navigate(`/agreements/${id}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!a) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <PageHeader title="Move out" subtitle={`${a.tenant.firstName} ${a.tenant.lastName} · ${a.unit?.building.name ?? ""} ${a.unit?.name ?? ""}`} />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <TextField label="Last day in the unit" type="date" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <FormControlLabel control={<Checkbox checked={finalInvoice} onChange={(e) => setFinalInvoice(e.target.checked)} />} label="Bill the last month, pro-rated to this day" />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontSize={17}>Deductions</Typography>
                <Button size="small" startIcon={<AddOutlined />} onClick={() => setDeductions([...deductions, { amount: 0, note: "" }])}>Add</Button>
              </Stack>
              {!deductions.length && <Typography color="text.secondary" fontSize={14}>No damage or other deductions.</Typography>}
              {deductions.map((d, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField label="What for" value={d.note} onChange={(e) => setDeductions(deductions.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} sx={{ flex: 2 }} />
                  <TextField label="৳" type="number" value={d.amount || ""} onChange={(e) => setDeductions(deductions.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} sx={{ flex: 1 }} />
                  <IconButton aria-label="Remove deduction" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}><DeleteOutline /></IconButton>
                </Stack>
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ borderColor: "primary.main" }}>
            <CardContent sx={{ display: "grid", gap: 1 }}>
              <Typography variant="h6" fontSize={17}>Settlement</Typography>
              <Line label="Deposit held" value={s?.depositBalance} />
              <Line label="Unpaid invoices" value={s?.openDues} minus />
              <Line label={s?.lastMonthBilled ? "Last month (already invoiced)" : "Last month's rent (pro-rated)"} value={s?.finalRent} minus />
              <Line label="Deductions" value={s?.deductions} minus />
              <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.5, fontSize: 18 }}>
                <Typography fontWeight={700}>{s && s.due > 0 ? "Tenant still owes" : "Refund to tenant"}</Typography>
                <Typography fontWeight={800} color={s && s.due > 0 ? "error.main" : "primary.main"}>{s ? formatBDT(s.due > 0 ? s.due : s.refund) : "–"}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                The deposit pays unpaid invoices first (recorded as payments by deposit). Utilities for the last month are added when its invoice is made.
              </Typography>
              <Button variant="contained" sx={{ mt: 1 }} disabled={!s || end.isPending} onClick={() => end.mutate()}>Confirm move-out</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const Line = ({ label, value, minus }: { label: string; value?: number; minus?: boolean }) => (
  <Stack direction="row" justifyContent="space-between" gap={2} sx={{ borderBottom: "1px solid", borderColor: "divider", py: 0.75 }}>
    <Typography fontSize={14}>{label}</Typography>
    <Typography fontWeight={600} fontSize={14}>{value === undefined ? "–" : `${minus && value ? "− " : ""}${formatBDT(value)}`}</Typography>
  </Stack>
);
