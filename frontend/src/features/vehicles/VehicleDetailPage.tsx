import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Chip, Grid, Link, Stack, Typography } from "@mui/material";
import { DeleteOutline, EditOutlined, EventNoteOutlined, HandshakeOutlined, BuildOutlined } from "@mui/icons-material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentsCard } from "@/components/DocumentsCard";
import { vehicleApi } from "@/api/vehicles";
import { bookingApi } from "@/api/bookings";
import { BOOKING_CHIP, BookingDialog, formatWhen } from "@/features/bookings/BookingsPage";
import { useCurrentMembership } from "@/store/authStore";
import { useT, type MessageKey } from "@/i18n";
import { apiError, formatBDT, formatDate } from "@/utils/format";
import { STATUS_CHIP, VehicleDialog } from "./VehiclesPage";

export const VehicleDetailPage = () => {
  const { id } = useParams();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const role = useCurrentMembership()?.role;
  const canWrite = role === "OWNER" || role === "MANAGER";
  const [edit, setEdit] = useState(false);
  const [book, setBook] = useState(false);
  const { data: bookings = [] } = useQuery({ queryKey: ["bookings", "vehicle", id], queryFn: () => bookingApi.list({ vehicleId: Number(id) }) });
  const { data: v } = useQuery({ queryKey: ["vehicle", id], queryFn: () => vehicleApi.get(id!) });
  const remove = useMutation({
    mutationFn: () => vehicleApi.remove(v!.id),
    onSuccess: () => { toast.success(t("veh.deleted")); navigate("/vehicles"); },
    onError: (e) => toast.error(apiError(e)),
  });
  if (!v) return null;

  const row = (label: string, value: React.ReactNode) => (
    <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
      <Typography color="text.secondary" fontSize={14}>{label}</Typography>
      <Typography fontSize={14} fontWeight={600} textAlign="right">{value || "–"}</Typography>
    </Stack>
  );

  return (
    <Box>
      <PageHeader
        title={v.regNo}
        subtitle={[t(`veh.type.${v.type}` as MessageKey), v.model, v.year, v.color].filter(Boolean).join(" · ")}
        actions={canWrite && (
          <Stack direction="row" spacing={1}>
            {!v.agreement && v.status === "AVAILABLE" && (
              <Button variant="contained" startIcon={<HandshakeOutlined />} onClick={() => navigate(`/agreements/new?vehicleId=${v.id}`)}>{t("veh.lease")}</Button>
            )}
            {!v.agreement && v.status !== "OFF_ROAD" && <Button variant="outlined" startIcon={<EventNoteOutlined />} onClick={() => setBook(true)}>{t("book.book")}</Button>}
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEdit(true)}>{t("veh.edit")}</Button>
            {!v.agreements.length && <Button color="error" startIcon={<DeleteOutline />} onClick={() => window.confirm(t("veh.confirmDelete")) && remove.mutate()}>{t("veh.delete")}</Button>}
          </Stack>
        )}
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" fontSize={17}>{t("veh.details")}</Typography>
                  <Chip size="small" label={t(`veh.status.${v.status}` as MessageKey)} sx={{ bgcolor: STATUS_CHIP[v.status].bg, color: STATUS_CHIP[v.status].fg }} />
                </Stack>
                {row(t("veh.driver"), v.agreement && <Link component={RouterLink} to={`/agreements/${v.agreement.id}`}>{v.agreement.driver.name}{v.agreement.driver.phone ? ` · ${v.agreement.driver.phone}` : ""}</Link>)}
                {row(t("veh.terms"), v.agreement ? `${formatBDT(v.agreement.rate, lang)} / ${t(v.agreement.cycle === "DAILY" ? "veh.perDay" : "veh.perMonth")}` : v.rate ? `${formatBDT(v.rate, lang)} (${t("veh.asking")})` : null)}
                {row(t("veh.chassis"), v.chassisNo)}
                {row(t("veh.engine"), v.engineNo)}
                {v.notes && <Typography fontSize={14} color="text.secondary" sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>{v.notes}</Typography>}
                <Button size="small" startIcon={<BuildOutlined />} sx={{ mt: 1.5 }} onClick={() => navigate(`/maintenance?vehicleId=${v.id}`)}>{t("nav.maintenance")}</Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>{t("veh.history")}</Typography>
                {!v.agreements.length && <Typography color="text.secondary" fontSize={14}>{t("veh.noHistory")}</Typography>}
                {v.agreements.map((a) => (
                  <Stack key={a.id} direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                    <Link component={RouterLink} to={`/agreements/${a.id}`} fontSize={14}>{a.driverName}</Link>
                    <Typography fontSize={13} color="text.secondary">
                      {formatBDT(a.rate, lang)} / {t(a.cycle === "DAILY" ? "veh.perDay" : "veh.perMonth")} · {formatDate(a.startDate, lang)} – {a.endDate ? formatDate(a.endDate, lang) : t("veh.now")}
                    </Typography>
                  </Stack>
                ))}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
        <Grid item xs={12} md={6}>
          <Stack spacing={2.5}>
            <DocumentsCard link={{ assetId: v.assetId }} defaultKind="FITNESS" />
            {(bookings.length > 0 || v.type === "CAR" || v.type === "MICROBUS") && (
              <Card>
                <CardContent>
                  <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>{t("book.vehicleBookings")}</Typography>
                  {!bookings.length && <Typography color="text.secondary" fontSize={14}>{t("book.noBookings")}</Typography>}
                  {[...bookings].reverse().slice(0, 10).map((b) => (
                    <Stack key={b.id} direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Link component={RouterLink} to={`/bookings/${b.id}`} fontSize={14}>{b.customer}</Link>
                        <Typography fontSize={12} color="text.secondary">{formatWhen(b.startAt, lang)} – {formatWhen(b.endAt, lang)}</Typography>
                      </Box>
                      <Chip size="small" label={t(`book.status.${b.status}` as MessageKey)} sx={{ bgcolor: BOOKING_CHIP[b.status].bg, color: BOOKING_CHIP[b.status].fg }} />
                    </Stack>
                  ))}
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
      <VehicleDialog open={edit} onClose={() => setEdit(false)} vehicle={v} />
      <BookingDialog open={book} onClose={() => setBook(false)} preset={{ vehicleId: v.id }} />
    </Box>
  );
};
