import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { Tenancy } from "@/api/portal";
import { useT } from "@/i18n";
import { formatBDT, formatDate } from "@/utils/format";
import { CHIP } from "@/theme";
import { monthLabel, usePortalHome } from "./PortalLayout";

const CLAIM_TONE = { PENDING: CHIP.warning, CONFIRMED: CHIP.ok, REJECTED: CHIP.error } as const;

export const PortalHomePage = () => {
  const { t, lang } = useT();
  const { data, isLoading } = usePortalHome();
  if (isLoading || !data) return <Typography>{t("common.loading")}</Typography>;

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontSize: 22 }}>{t("portal.hello", { name: data.name })}</Typography>
      {!data.tenancies.length && <Alert severity="info">{t("portal.noTenancy")}</Alert>}
      {data.tenancies.map((x) => <TenancyCard key={x.agreementId} x={x} lang={lang} />)}

      {data.claims.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontSize={16} sx={{ mb: 1 }}>{t("portal.claims")}</Typography>
            <Stack spacing={1.25}>
              {data.claims.map((c) => (
                <Box key={c.id}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography fontSize={14}>
                      {formatBDT(c.amount, lang)} · {t(`method.${c.method}`)} · {c.transactionId}
                    </Typography>
                    <Chip size="small" sx={{ bgcolor: CLAIM_TONE[c.status].bg, color: CLAIM_TONE[c.status].fg }} label={t(`portal.claim.${c.status}`)} />
                  </Stack>
                  {c.status === "REJECTED" && c.reviewNote && <Typography fontSize={13} color="error.main">{c.reviewNote}</Typography>}
                  {c.receipt?.shareToken && (
                    <Button size="small" component={RouterLink} to={`/r/${c.receipt.shareToken}`} sx={{ px: 0 }}>{t("rcp.view")} {c.receipt.receiptNo}</Button>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

const TenancyCard = ({ x, lang }: { x: Tenancy; lang: "en" | "bn" }) => {
  const { t } = useT();
  const inv = x.openInvoice;
  const tone = x.status === "ACTIVE" ? CHIP.ok : x.status === "NOTICE" ? CHIP.warning : CHIP.muted;
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography fontWeight={700}>{x.unit ? `${x.unit.name}, ${x.unit.building.name}` : x.org.name}</Typography>
            <Typography variant="body2" color="text.secondary">{x.org.name}</Typography>
          </Box>
          <Chip size="small" sx={{ bgcolor: tone.bg, color: tone.fg }} label={t(`portal.status.${x.status}`)} />
        </Stack>

        <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: x.openDues > 0 ? CHIP.warning.bg : CHIP.ok.bg }}>
          {x.openDues > 0 ? (
            <>
              <Typography fontSize={13} color="text.secondary">{t("portal.dueNow")}</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 800 }}>{formatBDT(x.openDues, lang)}</Typography>
              {inv && (
                <Typography fontSize={13}>
                  {t("portal.billFor", { month: monthLabel(inv.month, inv.year, lang) })}
                  {inv.dueDate ? ` · ${t("portal.dueBy", { date: formatDate(inv.dueDate, lang) })}` : ""}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                {inv?.shareToken && <Button variant="outlined" component={RouterLink} to={`/i/${inv.shareToken}`}>{t("portal.viewBill")}</Button>}
                {inv && x.status !== "ENDED" && (
                  <Button variant="contained" component={RouterLink} to={`/portal/pay/${x.agreementId}/${inv.id}`}>{t("portal.iPaid")}</Button>
                )}
              </Stack>
            </>
          ) : (
            <Typography fontWeight={700} color={CHIP.ok.fg}>{t("portal.allPaid")}</Typography>
          )}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 2, "& dt": { fontSize: 12, color: "text.secondary" }, "& dd": { m: 0, fontWeight: 600 } }} component="dl">
          <div><dt>{t("portal.rent")}</dt><dd>{formatBDT(x.rent, lang)}</dd></div>
          <div><dt>{t("portal.deposit")}</dt><dd>{formatBDT(x.depositBalance, lang)}</dd></div>
          <div><dt>{t("deed.start")}</dt><dd>{formatDate(x.startDate, lang)}</dd></div>
          {x.endDate && <div><dt>{t("deed.end")}</dt><dd>{formatDate(x.endDate, lang)}</dd></div>}
        </Box>
        {x.pendingNotice && <Alert severity="info" sx={{ mt: 2 }}>{t("portal.noticePending", { date: formatDate(x.pendingNotice.moveOutDate, lang) })}</Alert>}
      </CardContent>
    </Card>
  );
};

