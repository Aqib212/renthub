import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Grid, TextField, Typography, FormControlLabel, Switch } from "@mui/material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { orgApi } from "@/api/org";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { apiError } from "@/utils/format";

const clauseList = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);

export const SettingsPage = () => {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const { data: org } = useQuery({ queryKey: ["org-current"], queryFn: orgApi.current });
  const [form, setForm] = useState({ name: "", dueDay: 10, noticeMonths: 2, clauses: "", portal: true, payInfo: "" });

  useEffect(() => {
    if (org) setForm({ name: org.name, dueDay: org.settings.dueDay, noticeMonths: org.settings.noticeMonths, clauses: (org.settings.agreementClauses ?? []).join("\n"),
      portal: org.settings.portal?.enabled !== false, payInfo: org.settings.payInfo ?? "" });
  }, [org]);

  const save = useMutation({
    mutationFn: () => orgApi.update({ name: form.name, settings: { dueDay: form.dueDay, noticeMonths: form.noticeMonths, agreementClauses: clauseList(form.clauses), portal: { enabled: form.portal }, payInfo: form.payInfo } }),
    onSuccess: async () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["org-current"] });
      // the organisation name also shows in the sidebar switcher
      const res = await authApi.getProfile();
      setUser(res.data.data);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const dirty = !!org && (form.name !== org.name || form.dueDay !== org.settings.dueDay || form.noticeMonths !== org.settings.noticeMonths
    || clauseList(form.clauses).join("\n") !== (org.settings.agreementClauses ?? []).join("\n")
    || form.portal !== (org.settings.portal?.enabled !== false) || form.payInfo !== (org.settings.payInfo ?? ""));

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Rules that apply to every building in this workspace." />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2.5 }}>
              <Typography variant="h6" sx={{ fontSize: 17 }}>Organisation</Typography>
              <TextField label="Name on invoices" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" } }}>
                <TextField
                  label="Rent due by (day of month)" type="number" value={form.dueDay}
                  inputProps={{ min: 1, max: 28 }}
                  helperText="Rent is billed in advance; DNCC guidance says by the 10th."
                  onChange={(e) => setForm({ ...form, dueDay: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })}
                />
                <TextField
                  label="Notice period (months)" type="number" value={form.noticeMonths}
                  inputProps={{ min: 1, max: 6 }}
                  helperText="Either side ends a tenancy with this much notice (usually 2)."
                  onChange={(e) => setForm({ ...form, noticeMonths: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })}
                />
              </Box>
              <TextField
                label="Default extra conditions for new agreements" multiline minRows={3} value={form.clauses}
                helperText="One per line. Copied into each new agreement deed after the standard DNCC conditions; editable per agreement."
                onChange={(e) => setForm({ ...form, clauses: e.target.value })}
              />
              <Typography variant="h6" sx={{ fontSize: 17, mt: 1 }}>Tenant portal</Typography>
              <FormControlLabel
                control={<Switch checked={form.portal} onChange={(e) => setForm({ ...form, portal: e.target.checked })} />}
                label="Tenants can log in at /portal with their phone number (SMS code) to see bills, receipts and report repairs"
              />
              <TextField
                label="How tenants pay you" multiline minRows={2} value={form.payInfo}
                placeholder={"bKash (personal): 01XXXXXXXXX\nDBBL A/C 123.456.789, Hasan Properties"}
                helperText={'Shown in the portal next to "I have paid".'}
                onChange={(e) => setForm({ ...form, payInfo: e.target.value })}
              />
              <Box>
                <Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontSize: 17, mb: 1 }}>Plan</Typography>
              <Typography color="text.secondary">{org?.plan ?? "–"}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
