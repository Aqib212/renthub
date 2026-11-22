import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Grid, LinearProgress, Link, Stack, Typography } from "@mui/material";
import { expiringApi, jamaApi, type ExpiringDoc } from "@/api/vehicles";
import { DOCUMENT_KINDS } from "@/api/documents";
import { useT } from "@/i18n";
import { formatBDT, formatDate } from "@/utils/format";
import { todayBd } from "./JamaSheetPage";

const ownerLink = (d: ExpiringDoc) =>
  !d.owner ? null
  : d.owner.type === "vehicle" ? `/vehicles/${d.owner.id}`
  : d.owner.type === "tenant" ? `/tenants/${d.owner.id}`
  : d.owner.type === "agreement" ? `/agreements/${d.owner.id}`
  : "/flats";

/** Dashboard: documents expiring in 30 days, and today's jama when the workspace has daily leases. Both hide when empty. */
export const FleetCards = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { data: docs = [] } = useQuery({ queryKey: ["documents", "expiring"], queryFn: () => expiringApi.list(30) });
  const { data: jama } = useQuery({ queryKey: ["jama", todayBd()], queryFn: () => jamaApi.sheet(todayBd()) });
  const hasJama = !!jama?.rows.length;
  if (!docs.length && !hasJama) return null;
  const pct = jama && jama.totals.expected > 0 ? Math.min(100, (jama.totals.collected / jama.totals.expected) * 100) : 0;

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {hasJama && (
        <Grid item xs={12} md={docs.length ? 5 : 12}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontSize={17}>{t("jama.title")}</Typography>
                <Button size="small" onClick={() => navigate("/jama")}>{t("jama.open")}</Button>
              </Stack>
              <Typography fontSize={26} fontWeight={700} sx={{ mt: 1, fontVariantNumeric: "tabular-nums" }}>
                {formatBDT(jama!.totals.collected, lang)}
                <Typography component="span" color="text.secondary" fontSize={15}> / {formatBDT(jama!.totals.expected, lang)}</Typography>
              </Typography>
              <LinearProgress variant="determinate" value={pct} sx={{ my: 1.5, height: 8, borderRadius: 4 }} />
              <Typography fontSize={13} color="text.secondary">
                {t("jama.drivers", { n: jama!.rows.length })} · {t("jama.totalOwed")}: <b>{formatBDT(jama!.totals.owed, lang)}</b>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}
      {docs.length > 0 && (
        <Grid item xs={12} md={hasJama ? 7 : 12}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>{t("dash.expiring")}</Typography>
              {docs.slice(0, 6).map((d) => {
                const to = ownerLink(d);
                return (
                  <Box key={d.id} sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                    <Typography fontSize={14} sx={{ minWidth: 0 }}>
                      <b>{DOCUMENT_KINDS[d.kind] ?? d.name}</b>{" · "}
                      {to ? <Link component={RouterLink} to={to}>{d.owner!.label}</Link> : d.name}
                    </Typography>
                    <Typography fontSize={13} sx={{ whiteSpace: "nowrap" }} color={d.daysLeft < 0 ? "error.main" : d.daysLeft <= 7 ? "warning.dark" : "text.secondary"}>
                      {d.daysLeft < 0 ? t("dash.expiredOn", { date: formatDate(d.expiresAt, lang) }) : d.daysLeft === 0 ? t("dash.expiresToday") : t("doc.expiresIn", { days: d.daysLeft })}
                    </Typography>
                  </Box>
                );
              })}
              {docs.length > 6 && <Typography fontSize={13} color="text.secondary" sx={{ mt: 1 }}>{t("dash.more", { n: docs.length - 6 })}</Typography>}
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};
