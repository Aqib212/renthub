import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Checkbox, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { cashApi, type PendingCash } from "@/api/collections";
import { useCurrentMembership } from "@/store/authStore";
import { useT } from "@/i18n";
import { apiError, formatBDT, formatDate } from "@/utils/format";

/** Cash staff collected and still hold; the owner or manager records it when it is handed over. */
export const CashHandoverPage = () => {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const role = useCurrentMembership()?.role;
  const canReceive = role === "OWNER" || role === "MANAGER";
  const { data: pending } = useQuery({ queryKey: ["cash-pending"], queryFn: cashApi.pending });
  const { data: history = [] } = useQuery({ queryKey: ["cash-history"], queryFn: cashApi.history, enabled: role !== "CARETAKER" });

  return (
    <Box>
      <PageHeader title={t("cash.title")} subtitle={t("cash.subtitle")} />
      <Grid container spacing={2.5}>
        {!pending?.collectors.length && (
          <Grid item xs={12}><Card><CardContent><Typography color="text.secondary">{t("cash.none")}</Typography></CardContent></Card></Grid>
        )}
        {pending?.collectors.map((c) => (
          <Grid item xs={12} md={6} key={c.membershipId}>
            <CollectorCard
              c={c}
              canReceive={canReceive}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["cash-pending"] });
                qc.invalidateQueries({ queryKey: ["cash-history"] });
              }}
            />
          </Grid>
        ))}

        {role !== "CARETAKER" && (
          <Grid item xs={12}>
            <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>{t("cash.history")}</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>{t("common.date")}</TableCell><TableCell>{t("cash.from")}</TableCell><TableCell>{t("cash.to")}</TableCell><TableCell align="right">{t("cash.payments")}</TableCell><TableCell align="right">{t("common.amount")}</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDate(h.date, lang)}{h.note ? <Typography variant="body2" color="text.secondary">{h.note}</Typography> : null}</TableCell>
                      <TableCell>{h.from.user.firstName} {h.from.user.lastName}</TableCell>
                      <TableCell>{h.to.user.firstName} {h.to.user.lastName}</TableCell>
                      <TableCell align="right">{h._count.payments}</TableCell>
                      <TableCell align="right">{formatBDT(h.amount, lang)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

const CollectorCard = ({ c, canReceive, onDone }: { c: PendingCash["collectors"][number]; canReceive: boolean; onDone: () => void }) => {
  const { t, lang } = useT();
  const [picked, setPicked] = useState<Set<number>>(() => new Set(c.payments.map((p) => Number(p.id))));
  const [note, setNote] = useState("");
  const total = c.payments.filter((p) => picked.has(Number(p.id))).reduce((s, p) => s + p.amount, 0);
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const record = useMutation({
    mutationFn: () => cashApi.record({ fromMembershipId: c.membershipId, paymentIds: [...picked], note: note || undefined }),
    onSuccess: () => { toast.success(t("cash.recorded")); onDone(); },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Card>
      <CardContent sx={{ display: "grid", gap: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Box>
            <Typography fontWeight={700}>{c.name}</Typography>
            <Typography variant="body2" color="text.secondary">{t(`role.${c.role}` as any)}</Typography>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("cash.inHand")}</Typography>
            <Typography sx={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 22 }}>{formatBDT(c.total, lang)}</Typography>
          </Box>
        </Stack>
        <Table size="small">
          <TableBody>
            {c.payments.map((p) => (
              <TableRow key={p.id}>
                {canReceive && (
                  <TableCell padding="checkbox">
                    <Checkbox checked={picked.has(Number(p.id))} onChange={() => toggle(Number(p.id))} inputProps={{ "aria-label": `Include ${p.receiptNo ?? p.id}` }} />
                  </TableCell>
                )}
                <TableCell>
                  <Typography fontSize={14}>{p.flatName}{p.tenantName ? ` · ${p.tenantName}` : ""}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.receiptNo} · {formatDate(p.date, lang)}</Typography>
                </TableCell>
                <TableCell align="right">{formatBDT(p.amount, lang)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canReceive && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" label="Note" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: 1 }} />
            <Button variant="contained" disabled={!picked.size || record.isPending} onClick={() => record.mutate()}>
              {t("cash.record", { amount: formatBDT(total, lang) })}
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
