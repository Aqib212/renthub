import { useEffect, useState } from "react";
import {
  Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  Grid, IconButton, InputAdornment, MenuItem, Stack, Tab, Tabs, TextField, Typography, Autocomplete,
} from "@mui/material";
import { AddOutlined, BuildOutlined, PhotoCameraOutlined, DeleteOutline } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { maintenanceApi, MAINTENANCE_STATUS, type MaintenanceRequest, type MaintenanceStatus, type Priority } from "@/api/maintenance";
import { documentApi } from "@/api/documents";
import { flatApi } from "@/api/flat";
import { vehicleApi } from "@/api/vehicles";
import { useSearchParams } from "react-router-dom";
import { useCurrentMembership } from "@/store/authStore";
import { useT } from "@/i18n";
import { apiError, formatBDT, formatDate } from "@/utils/format";
import { CHIP } from "@/theme";

const TABS: ("OPEN" | MaintenanceStatus | "ALL")[] = ["OPEN", "NEW", "IN_PROGRESS", "WAITING", "DONE", "ALL"];
const CATEGORIES = ["Plumbing", "Electrical", "Painting", "Carpentry", "Lift", "Gas", "Cleaning", "Other"];
const PRIORITIES: Priority[] = ["LOW", "NORMAL", "URGENT"];

/** Repairs and complaints per unit. Owners, managers and caretakers can report and update them. */
export const MaintenancePage = () => {
  const { t, lang } = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]>("OPEN");
  const [editing, setEditing] = useState<MaintenanceRequest | "new" | null>(null);
  const role = useCurrentMembership()?.role;
  const canWrite = role === "OWNER" || role === "MANAGER" || role === "CARETAKER";

  const [params] = useSearchParams();
  const vehicleId = params.get("vehicleId") ? Number(params.get("vehicleId")) : undefined;
  const { data } = useQuery({
    queryKey: ["maintenance", tab, vehicleId],
    queryFn: () => maintenanceApi.list({ status: tab === "ALL" ? undefined : tab, vehicleId, limit: 100 }),
  });
  const counts = data?.counts ?? {};
  const countOf = (k: (typeof TABS)[number]) =>
    k === "ALL" ? Object.values(counts).reduce((s, n) => s + (n ?? 0), 0)
    : k === "OPEN" ? (["NEW", "ASSIGNED", "WAITING", "IN_PROGRESS"] as MaintenanceStatus[]).reduce((s, x) => s + (counts[x] ?? 0), 0)
    : counts[k] ?? 0;

  return (
    <Box>
      <PageHeader
        title={t("maint.title")}
        subtitle={t("maint.subtitle")}
        actions={canWrite && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing("new")}>{t("maint.new")}</Button>}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2 }}>
        {TABS.map((k) => (
          <Tab key={k} value={k} label={`${k === "OPEN" ? t("maint.open") : k === "ALL" ? t("maint.all") : t(`maint.status.${k}`)} (${countOf(k)})`} />
        ))}
      </Tabs>

      {!data?.rows.length && <Typography color="text.secondary">{t("maint.empty")}</Typography>}
      <Grid container spacing={2}>
        {data?.rows.map((r) => (
          <Grid item xs={12} md={6} lg={4} key={r.id}>
            <RequestCard r={r} lang={lang} onOpen={() => canWrite && setEditing(r)} />
          </Grid>
        ))}
      </Grid>
      {editing && <RequestDialog request={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Box>
  );
};

const tone = (s: MaintenanceStatus) => CHIP[MAINTENANCE_STATUS[s].tone];

const RequestCard = ({ r, lang, onOpen }: { r: MaintenanceRequest; lang: "en" | "bn"; onOpen: () => void }) => {
  const { t } = useT();
  return (
    <Card sx={{ height: "100%", cursor: "pointer", "&:hover": { borderColor: "primary.main" } }} onClick={onOpen}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={700}>{r.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {whereOf(r) || "–"}{r.tenant ? ` · ${r.tenant.name}` : ""}
            </Typography>
          </Box>
          <Chip size="small" sx={{ bgcolor: tone(r.status).bg, color: tone(r.status).fg, flexShrink: 0 }} label={t(`maint.status.${r.status}`)} />
        </Stack>
        {r.description && <Typography variant="body2" sx={{ mt: 1 }} noWrap>{r.description}</Typography>}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {r.priority === "URGENT" && <Chip size="small" sx={{ bgcolor: CHIP.error.bg, color: CHIP.error.fg }} label={t("maint.priority.URGENT")} />}
          {r.category && <Chip size="small" variant="outlined" label={r.category} />}
          {r.assignedTo && <Chip size="small" variant="outlined" icon={<BuildOutlined />} label={r.assignedTo.name} />}
          {r.photos.length > 0 && <Chip size="small" variant="outlined" icon={<PhotoCameraOutlined />} label={r.photos.length} />}
          {r.cost != null && <Chip size="small" variant="outlined" label={formatBDT(r.cost, lang)} />}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          {formatDate(r.createdAt, lang)}{r.createdBy ? ` · ${t("maint.reportedBy", { name: r.createdBy.name })}` : r.tenant ? ` · ${t("maint.reportedBy", { name: `${r.tenant.name} (tenant)` })}` : ""}
        </Typography>
      </CardContent>
    </Card>
  );
};

type Flat = { id: number; name: string; status: string; floor: { name: string; building: { name: string } } };
/** A unit or a vehicle the request is about. */
type Target = { key: string; flatId?: number; vehicleId?: number; label: string; free: boolean };
const whereOf = (r: MaintenanceRequest) => (r.unit ? `${r.unit.building.name} · ${r.unit.name}` : r.vehicle ? `${r.vehicle.regNo} (${r.vehicle.type})` : "");

const RequestDialog = ({ request, onClose }: { request: MaintenanceRequest | null; onClose: () => void }) => {
  const { t } = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    target: "",
    title: request?.title ?? "",
    description: request?.description ?? "",
    category: request?.category ?? "",
    priority: request?.priority ?? ("NORMAL" as Priority),
    assignedToId: request?.assignedTo?.id ?? 0,
    blocksUnit: request?.blocksUnit ?? false,
    status: request?.status ?? ("NEW" as MaintenanceStatus),
    cost: request?.cost != null ? String(request.cost) : "",
    createExpense: !request?.expenseId,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const [files, setFiles] = useState<File[]>([]);

  const { data: flats = [] } = useQuery({
    queryKey: ["flats", "all"],
    queryFn: async () => ((await flatApi.getAllForOwner()).data.data as Flat[]),
    enabled: !request,
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: vehicleApi.list, enabled: !request });
  const targets: Target[] = [
    ...flats.map((f) => ({ key: `f${f.id}`, flatId: f.id, label: `${f.floor.building.name} · ${f.name}`, free: f.status === "VACANT" })),
    ...vehicles.map((v) => ({ key: `v${v.id}`, vehicleId: v.id, label: `${v.regNo} (${v.type})`, free: v.status === "AVAILABLE" })),
  ];
  const { data: staff = [] } = useQuery({ queryKey: ["maintenance-assignees"], queryFn: maintenanceApi.assignees });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        category: form.category || null,
        priority: form.priority,
        assignedToId: form.assignedToId || null,
      };
      const saved = request
        ? await maintenanceApi.update(request.id, {
            ...body,
            status: form.status,
            cost: form.cost === "" ? null : Number(form.cost),
            createExpense: form.status === "DONE" && !!form.cost && form.createExpense && !request.expenseId,
          })
        : await maintenanceApi.create({ ...body, flatId: selected?.flatId, vehicleId: selected?.vehicleId, blocksUnit: form.blocksUnit });
      if (files.length) await maintenanceApi.addPhotos(saved.id, files);
      return saved;
    },
    onSuccess: () => {
      toast.success(t("maint.saved"));
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["flats"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: () => maintenanceApi.remove(request!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); qc.invalidateQueries({ queryKey: ["flats"] }); onClose(); },
    onError: (e) => toast.error(apiError(e)),
  });
  const selected = targets.find((x) => x.key === form.target) ?? null;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{request ? t("maint.edit") : t("maint.new")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {request ? (
            <Typography color="text.secondary">{whereOf(request)}{request.tenant ? ` · ${request.tenant.name}` : ""}</Typography>
          ) : (
            <Autocomplete
              options={targets}
              value={selected}
              onChange={(_, x) => set({ target: x?.key ?? "" })}
              getOptionLabel={(x) => x.label}
              groupBy={(x) => (x.vehicleId ? t("nav.vehicles") : t("maint.unit"))}
              isOptionEqualToValue={(a, b) => a.key === b.key}
              renderInput={(p) => <TextField {...p} label={t("maint.unit")} required />}
            />
          )}
          <TextField label={t("maint.issue")} value={form.title} onChange={(e) => set({ title: e.target.value })} required autoFocus={!request} />
          <TextField label={t("maint.details")} value={form.description} onChange={(e) => set({ description: e.target.value })} multiline minRows={2} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("maint.category")} value={form.category} onChange={(e) => set({ category: e.target.value })} sx={{ flex: 1 }}>
              <MenuItem value="">–</MenuItem>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select label={t("maint.priority")} value={form.priority} onChange={(e) => set({ priority: e.target.value as Priority })} sx={{ flex: 1 }}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{t(`maint.priority.${p}`)}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField select label={t("maint.assignee")} value={form.assignedToId} onChange={(e) => set({ assignedToId: Number(e.target.value) })}>
            <MenuItem value={0}>{t("maint.nobody")}</MenuItem>
            {staff.map((m) => <MenuItem key={m.id} value={m.id}>{m.name} ({t(`role.${m.role}` as any)})</MenuItem>)}
          </TextField>
          {!request && selected?.free && (
            <FormControlLabel control={<Checkbox checked={form.blocksUnit} onChange={(e) => set({ blocksUnit: e.target.checked })} />} label={t("maint.blocks")} />
          )}
          {request && (
            <>
              <TextField select label={t("common.status")} value={form.status} onChange={(e) => set({ status: e.target.value as MaintenanceStatus })}>
                {(Object.keys(MAINTENANCE_STATUS) as MaintenanceStatus[]).map((s) => <MenuItem key={s} value={s}>{t(`maint.status.${s}`)}</MenuItem>)}
              </TextField>
              <TextField label={t("maint.cost")} type="number" value={form.cost} onChange={(e) => set({ cost: e.target.value })}
                InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }} />
              {request.expenseId ? (
                <Typography variant="body2" color="success.main">{t("maint.expenseLinked")}</Typography>
              ) : form.status === "DONE" && !!form.cost && (
                <FormControlLabel control={<Checkbox checked={form.createExpense} onChange={(e) => set({ createExpense: e.target.checked })} />} label={t("maint.createExpense")} />
              )}
              {request.photos.length > 0 && <Photos ids={request.photos.map((p) => p.id)} />}
            </>
          )}
          <Button variant="outlined" component="label" startIcon={<PhotoCameraOutlined />} sx={{ alignSelf: "flex-start" }}>
            {files.length ? `${t("maint.photos")}: ${files.length}` : t("maint.addPhotos")}
            <input hidden type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 4))} />
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        {request?.status === "NEW" && (
          <IconButton aria-label="Delete request" onClick={() => remove.mutate()} sx={{ mr: "auto" }}><DeleteOutline /></IconButton>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending || !form.title.trim() || (!request && !selected)} onClick={() => save.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Thumbnails fetched with the auth header (files are never public). */
const Photos = ({ ids }: { ids: number[] }) => {
  const [urls, setUrls] = useState<{ id: number; url: string }[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all(ids.map(async (id) => ({ id, url: await documentApi.blobUrl(id) }))).then((u) => alive && setUrls(u)).catch(() => {});
    return () => {
      alive = false;
      setUrls((u) => { u.forEach((x) => URL.revokeObjectURL(x.url)); return []; });
    };
  }, [ids.join(",")]);
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {urls.map((u, i) => (
        <Box key={u.id} component="img" src={u.url} alt={`Photo ${i + 1}`} onClick={() => documentApi.open(u.id)}
          sx={{ width: 88, height: 88, objectFit: "cover", borderRadius: 1.5, border: 1, borderColor: "divider", cursor: "pointer" }} />
      ))}
    </Stack>
  );
};
