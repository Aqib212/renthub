import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { AddOutlined, PhotoCameraOutlined } from "@mui/icons-material";
import toast from "react-hot-toast";
import { portalApi } from "@/api/portal";
import { useT } from "@/i18n";
import { apiError, formatDate } from "@/utils/format";
import { CHIP } from "@/theme";
import { usePortalHome } from "./PortalLayout";

const TONE: Record<string, { bg: string; fg: string }> = { NEW: CHIP.info, ASSIGNED: CHIP.info, WAITING: CHIP.warning, IN_PROGRESS: CHIP.warning, DONE: CHIP.ok, CANCELLED: CHIP.muted };
const CATEGORIES = ["Plumbing", "Electrical", "Painting", "Carpentry", "Lift", "Gas", "Cleaning", "Other"];

export const PortalRepairsPage = () => {
  const { t, lang } = useT();
  const { data: home } = usePortalHome();
  const { data: rows = [] } = useQuery({ queryKey: ["portal", "repairs"], queryFn: portalApi.repairs });
  const [open, setOpen] = useState(false);
  const live = home?.tenancies.filter((x) => x.status !== "ENDED") ?? [];

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" sx={{ fontSize: 22 }}>{t("portal.repairs")}</Typography>
        {live.length > 0 && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setOpen(true)}>{t("portal.newRepair")}</Button>}
      </Stack>
      {!rows.length && <Typography color="text.secondary">{t("portal.noRepairs")}</Typography>}
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography fontWeight={700}>{r.title}</Typography>
              <Chip size="small" sx={{ bgcolor: TONE[r.status]?.bg, color: TONE[r.status]?.fg }} label={t(`portal.repair.${r.status}` as any)} />
            </Stack>
            <Typography variant="body2" color="text.secondary">{r.unit} · {formatDate(r.createdAt, lang)}</Typography>
            {r.description && <Typography variant="body2" sx={{ mt: 1 }}>{r.description}</Typography>}
            {r.photos.length > 0 && <Photos ids={r.photos} />}
          </CardContent>
        </Card>
      ))}
      {open && <RepairDialog agreements={live.map((x) => ({ id: x.agreementId, label: x.unit ? `${x.unit.name}, ${x.unit.building.name}` : x.org.name }))} onClose={() => setOpen(false)} />}
    </Stack>
  );
};

const RepairDialog = ({ agreements, onClose }: { agreements: { id: number; label: string }[]; onClose: () => void }) => {
  const { t } = useT();
  const qc = useQueryClient();
  const [agreementId, setAgreementId] = useState(agreements[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const send = useMutation({
    mutationFn: async () => {
      const r = await portalApi.reportRepair({ agreementId, title: title.trim(), description: description || undefined, category: category || undefined });
      if (files.length) await portalApi.addPhotos(r.id, files);
    },
    onSuccess: () => { toast.success(t("portal.repairSent")); qc.invalidateQueries({ queryKey: ["portal", "repairs"] }); onClose(); },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("portal.newRepair")}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        {agreements.length > 1 && (
          <TextField select label={t("common.unit")} value={agreementId} onChange={(e) => setAgreementId(Number(e.target.value))}>
            {agreements.map((a) => <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>)}
          </TextField>
        )}
        <TextField label={t("portal.repairTitle")} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <TextField select label={t("maint.category")} value={category} onChange={(e) => setCategory(e.target.value)}>
          <MenuItem value="">–</MenuItem>
          {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <TextField label={t("portal.repairDetails")} value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />
        <Button variant="outlined" component="label" startIcon={<PhotoCameraOutlined />} sx={{ justifySelf: "start" }}>
          {files.length ? `${t("maint.photos")}: ${files.length}` : t("portal.addPhotos")}
          <input hidden type="file" accept="image/*" capture="environment" multiple onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 4))} />
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("portal.cancel")}</Button>
        <Button variant="contained" disabled={send.isPending || !title.trim() || !agreementId} onClick={() => send.mutate()}>{t("portal.send")}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Photos need the tenant's token, so they are fetched as blobs. */
const Photos = ({ ids }: { ids: number[] }) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    Promise.all(ids.map((id) => portalApi.photoUrl(id))).then((u) => { made.push(...u); if (alive) setUrls(u); }).catch(() => {});
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [ids.join(",")]);
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
      {urls.map((u, i) => <Box key={u} component="img" src={u} alt={`Photo ${i + 1}`} sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 1.5 }} />)}
    </Stack>
  );
};
