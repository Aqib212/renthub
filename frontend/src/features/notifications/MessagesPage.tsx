import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, Grid, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { notificationApi, type NotificationStatus } from "@/api/collections";
import { orgApi } from "@/api/org";
import { useCurrentMembership } from "@/store/authStore";
import { useT } from "@/i18n";
import { apiError, formatDate } from "@/utils/format";

const STATUS_COLOR: Record<NotificationStatus, "default" | "success" | "error" | "warning"> = { QUEUED: "warning", SENT: "success", FAILED: "error", SKIPPED: "default" };

export const MessagesPage = () => {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const isOwner = useCurrentMembership()?.role === "OWNER";
  const [status, setStatus] = useState<NotificationStatus | "ALL">("ALL");
  const [previewLang, setPreviewLang] = useState<"BN" | "EN">("BN");

  const { data: outbox } = useQuery({
    queryKey: ["notifications", status],
    queryFn: () => notificationApi.list({ status: status === "ALL" ? undefined : status, limit: 50 }),
    refetchInterval: 15_000, // the drainer sends every minute
  });
  const { data: templates = [] } = useQuery({ queryKey: ["notification-preview"], queryFn: notificationApi.preview });
  const { data: org } = useQuery({ queryKey: ["org-current"], queryFn: orgApi.current });

  const retry = useMutation({
    mutationFn: (id: number) => notificationApi.retry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(apiError(e)),
  });
  const setSms = useMutation({
    mutationFn: (sms: { enabled?: boolean; reminders?: boolean }) => orgApi.update({ settings: { sms } as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-current"] }),
    onError: (e) => toast.error(apiError(e)),
  });
  const sms = (org?.settings as any)?.sms ?? { enabled: true, reminders: true };
  const counts = outbox?.meta.counts ?? {};

  return (
    <Box>
      <PageHeader title={t("msg.title")} subtitle={t("msg.subtitle")} />
      {org && (
        <Alert severity={(org.smsCredits ?? 0) <= 0 ? "error" : (org.smsCredits ?? 0) < 50 ? "warning" : "success"} sx={{ mb: 1.5 }}>
          {t("msg.credits", { left: org.smsCredits ?? 0, used: org.smsUsedThisMonth ?? 0 })}
        </Alert>
      )}
      <Alert severity="info" sx={{ mb: 2.5 }}>{t("msg.consoleNote")}</Alert>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
            <Typography variant="h6" fontSize={17}>{t("msg.outbox")}</Typography>
            <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, v) => v && setStatus(v)} aria-label="Filter by status">
              <ToggleButton value="ALL">All</ToggleButton>
              {(["QUEUED", "SENT", "FAILED", "SKIPPED"] as const).map((s) => (
                <ToggleButton key={s} value={s}>{t(`msg.status.${s}`)} {counts[s] ? `(${counts[s]})` : ""}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>{t("common.date")}</TableCell><TableCell>{t("msg.to")}</TableCell><TableCell>{t("msg.message")}</TableCell><TableCell>{t("common.status")}</TableCell><TableCell /></TableRow>
              </TableHead>
              <TableBody>
                {!outbox?.data.length && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" sx={{ py: 2 }}>{t("msg.empty")}</Typography></TableCell></TableRow>}
                {outbox?.data.map((n) => (
                  <TableRow key={n.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(n.createdAt, lang)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{n.to ?? "–"}</TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Typography variant="caption" color="text.secondary">{t(`msg.tpl.${n.template}`)} · {n.segments} SMS</Typography>
                      <Typography fontSize={14} sx={{ wordBreak: "break-word" }}>{n.body}</Typography>
                      {n.lastError && <Typography variant="caption" color="error.main">{n.lastError}</Typography>}
                    </TableCell>
                    <TableCell><Chip size="small" color={STATUS_COLOR[n.status]} label={t(`msg.status.${n.status}`)} /></TableCell>
                    <TableCell>{(n.status === "FAILED" || (n.status === "SKIPPED" && n.to)) && <Button size="small" onClick={() => retry.mutate(n.id)}>{t("msg.retry")}</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ display: "grid", gap: 1 }}>
                <Typography variant="h6" fontSize={17}>{t("msg.settings")}</Typography>
                <FormControlLabel disabled={!isOwner} control={<Switch checked={sms.enabled} onChange={(e) => setSms.mutate({ enabled: e.target.checked })} />} label={t("msg.enabled")} />
                <FormControlLabel disabled={!isOwner || !sms.enabled} control={<Switch checked={sms.reminders} onChange={(e) => setSms.mutate({ reminders: e.target.checked })} />} label={t("msg.reminders")} />
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ display: "grid", gap: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontSize={17}>{t("msg.templates")}</Typography>
                  <ToggleButtonGroup exclusive size="small" value={previewLang} onChange={(_, v) => v && setPreviewLang(v)} aria-label="Template language">
                    <ToggleButton value="BN">বাংলা</ToggleButton>
                    <ToggleButton value="EN">EN</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                {templates.map((tpl) => (
                  <Box key={tpl.key} sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.default" }}>
                    <Typography variant="caption" color="text.secondary">{t(`msg.tpl.${tpl.key}`)}</Typography>
                    <Typography fontSize={14} lang={previewLang === "BN" ? "bn" : "en"}>{tpl[previewLang]}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};
