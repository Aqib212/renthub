import { useRef, useState } from "react";
import { Box, Button, Card, CardContent, Chip, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { DeleteOutline, DescriptionOutlined, UploadFileOutlined } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { DOCUMENT_KINDS, documentApi, type DocumentKind, type DocumentLink } from "@/api/documents";
import { useCurrentMembership } from "@/store/authStore";
import { useT } from "@/i18n";
import { apiError, formatDate } from "@/utils/format";
import { CHIP } from "@/theme";

const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

/** The document vault for one tenant, unit or agreement: list, open, upload and delete. */
export const DocumentsCard = ({ link, defaultKind = "OTHER" }: { link: DocumentLink; defaultKind?: DocumentKind }) => {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const role = useCurrentMembership()?.role;
  const canWrite = role === "OWNER" || role === "MANAGER";
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<DocumentKind>(defaultKind);
  const [expiresAt, setExpiresAt] = useState("");
  const key = ["documents", link];

  const { data: docs = [] } = useQuery({ queryKey: key, queryFn: () => documentApi.list(link) });
  const upload = useMutation({
    mutationFn: () => documentApi.upload(file!, { ...link, kind, expiresAt: expiresAt || undefined }),
    onSuccess: () => {
      toast.success(t("doc.uploaded"));
      setFile(null);
      setExpiresAt("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => documentApi.remove(id),
    onSuccess: () => { toast.success(t("doc.deleted")); qc.invalidateQueries({ queryKey: ["documents"] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const open = (id: number) => documentApi.open(id).catch((e) => toast.error(apiError(e)));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>{t("doc.title")}</Typography>
        {!docs.length && <Typography color="text.secondary" fontSize={14} sx={{ mb: 1 }}>{t("doc.empty")}</Typography>}
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
          {docs.map((d) => {
            const left = d.expiresAt ? daysUntil(d.expiresAt) : null;
            const tone = left === null ? null : left < 0 ? CHIP.error : left <= 30 ? CHIP.warning : null;
            return (
              <Stack key={d.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
                <DescriptionOutlined fontSize="small" color="action" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Button variant="text" size="small" onClick={() => open(d.id)} sx={{ p: 0, minHeight: 0, justifyContent: "flex-start", maxWidth: "100%" }}>
                    <Typography noWrap fontSize={14} fontWeight={600}>{d.name}</Typography>
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {DOCUMENT_KINDS[d.kind]} · {formatDate(d.createdAt, lang)}
                    {d.expiresAt && ` · ${t("doc.expires")} ${formatDate(d.expiresAt, lang)}`}
                  </Typography>
                </Box>
                {tone && left !== null && (
                  <Chip size="small" sx={{ bgcolor: tone.bg, color: tone.fg }} label={left < 0 ? t("doc.expired") : t("doc.expiresIn", { days: left })} />
                )}
                {canWrite && (
                  <Tooltip title={t("doc.confirmDelete")}>
                    <IconButton size="small" aria-label={`Delete ${d.name}`} onClick={() => window.confirm(t("doc.confirmDelete")) && remove.mutate(d.id)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            );
          })}
        </Stack>
        {canWrite && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }} alignItems={{ sm: "center" }}>
            <Button variant="outlined" size="small" startIcon={<UploadFileOutlined />} component="label" sx={{ flexShrink: 0 }}>
              {file ? file.name.slice(0, 24) : t("doc.upload")}
              <input ref={fileRef} hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Button>
            <TextField select size="small" label={t("doc.kind")} value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} sx={{ minWidth: 150 }}>
              {(Object.keys(DOCUMENT_KINDS) as DocumentKind[]).map((k) => <MenuItem key={k} value={k}>{DOCUMENT_KINDS[k]}</MenuItem>)}
            </TextField>
            <TextField size="small" type="date" label={t("doc.expires")} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button variant="contained" size="small" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>{t("doc.upload")}</Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
