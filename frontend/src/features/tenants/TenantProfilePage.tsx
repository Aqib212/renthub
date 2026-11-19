import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Grid, IconButton, Link, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutline, PrintOutlined } from "@mui/icons-material";
import toast from "react-hot-toast";
import api from "@/api/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { agreementApi, AGREEMENT_STATUS, fmtDate } from "@/api/agreement";
import { useCurrentMembership } from "@/store/authStore";
import { apiError, formatBDT } from "@/utils/format";
import type { Tenant } from "@/types/tenant";

type Member = { name: string; relation?: string; age?: number; nid?: string };

/** Tenant profile, household and the DMP CIMS form (Dhaka police tenant registration) ready to print. */
export const TenantProfilePage = () => {
  const { id } = useParams();
  const qc = useQueryClient();
  const org = useCurrentMembership();
  const { data: t } = useQuery({ queryKey: ["tenant", id], queryFn: async () => (await api.get(`/tenants/${id}`)).data.data as Tenant });
  const { data: agreements = [] } = useQuery({ queryKey: ["agreements", "tenant", id], queryFn: () => agreementApi.list({ tenantId: Number(id) }) });
  const [household, setHousehold] = useState<Member[]>([]);
  useEffect(() => setHousehold((t?.household as Member[]) ?? []), [t]);

  const setLang = useMutation({
    mutationFn: (lang: "BN" | "EN") => api.patch(`/tenants/${id}`, { lang }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", id] }),
    onError: (e) => toast.error(apiError(e)),
  });

  const save = useMutation({
    mutationFn: () => api.patch(`/tenants/${id}`, { household: household.filter((m) => m.name.trim()) }),
    onSuccess: () => { toast.success("Household saved"); qc.invalidateQueries({ queryKey: ["tenant", id] }); },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!t) return <Typography>Loading…</Typography>;
  const current = agreements.find((a) => a.status === "ACTIVE" || a.status === "NOTICE");
  const set = (i: number, k: keyof Member, v: string) =>
    setHousehold(household.map((m, j) => (j === i ? { ...m, [k]: k === "age" ? (v ? Number(v) : undefined) : v } : m)));

  return (
    <Box>
      <Box sx={{ displayPrint: "none" }}>
        <PageHeader
          title={`${t.firstName} ${t.lastName}`}
          subtitle={current?.unit ? `${current.unit.building.name} · ${current.unit.name} since ${fmtDate(current.startDate)}` : "No running agreement"}
          actions={<Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>Print CIMS form</Button>}
        />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontSize={17} sx={{ mb: 1.5 }}>Details</Typography>
                <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, m: 0, "& dt": { fontSize: 12, color: "text.secondary" }, "& dd": { m: 0, fontWeight: 600 } }}>
                  <div><dt>Phone</dt><dd>{t.phone ?? "–"}</dd></div>
                  <div><dt>Email</dt><dd>{t.email ?? "–"}</dd></div>
                  <div><dt>NID</dt><dd>{t.nid ?? "–"}</dd></div>
                  <div><dt>Passport</dt><dd>{t.passport ?? "–"}</dd></div>
                  <div><dt>Occupation</dt><dd>{t.occupation ?? "–"}</dd></div>
                  <div><dt>Workplace</dt><dd>{t.office ?? "–"}</dd></div>
                  <div><dt>Emergency contact</dt><dd>{t.emergencyContact ?? "–"}</dd></div>
                  <div><dt>People in household</dt><dd>{t.members}</dd></div>
                  <div><dt>SMS and receipts in</dt><dd>
                    <ToggleButtonGroup exclusive size="small" value={t.lang ?? "BN"} aria-label="Tenant language"
                      onChange={(_, v) => v && setLang.mutate(v)}>
                      <ToggleButton value="BN">বাংলা</ToggleButton>
                      <ToggleButton value="EN">English</ToggleButton>
                    </ToggleButtonGroup>
                  </dd></div>
                  <div style={{ gridColumn: "1 / -1" }}><dt>Permanent address</dt><dd>{t.permanentAddress ?? "–"}</dd></div>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" fontSize={17}>Household (for the CIMS form)</Typography>
                  <Button size="small" startIcon={<AddOutlined />} onClick={() => setHousehold([...household, { name: "" }])}>Add person</Button>
                </Stack>
                <Stack spacing={1}>
                  {!household.length && <Typography color="text.secondary" fontSize={14}>Family members and domestic staff living in the unit.</Typography>}
                  {household.map((m, i) => (
                    <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                      <TextField size="small" label="Name" value={m.name} onChange={(e) => set(i, "name", e.target.value)} sx={{ flex: 2 }} />
                      <TextField size="small" label="Relation" value={m.relation ?? ""} onChange={(e) => set(i, "relation", e.target.value)} sx={{ flex: 1 }} />
                      <TextField size="small" label="Age" type="number" value={m.age ?? ""} onChange={(e) => set(i, "age", e.target.value)} sx={{ width: 90 }} />
                      <TextField size="small" label="NID" value={m.nid ?? ""} onChange={(e) => set(i, "nid", e.target.value)} sx={{ flex: 1 }} />
                      <IconButton aria-label="Remove person" onClick={() => setHousehold(household.filter((_, j) => j !== i))}><DeleteOutline /></IconButton>
                    </Stack>
                  ))}
                </Stack>
                <Button variant="outlined" sx={{ mt: 1.5 }} disabled={save.isPending} onClick={() => save.mutate()}>Save household</Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>Agreements</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Unit</TableCell><TableCell>From – to</TableCell><TableCell align="right">Rent</TableCell><TableCell align="right">Deposit held</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>
                    {agreements.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell><Link component={RouterLink} to={`/agreements/${a.id}`}>{a.unit ? `${a.unit.building.name} · ${a.unit.name}` : "–"}</Link></TableCell>
                        <TableCell>{fmtDate(a.startDate)} – {a.endDate ? fmtDate(a.endDate) : "open"}</TableCell>
                        <TableCell align="right">{formatBDT(a.rate)}</TableCell>
                        <TableCell align="right">{formatBDT(a.depositBalance)}</TableCell>
                        <TableCell><Chip size="small" color={AGREEMENT_STATUS[a.status].color} label={AGREEMENT_STATUS[a.status].label} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Printed only: tenant information for the DMP Citizen Information Management System. Blank lines are filled by hand. */}
      <Box sx={{ display: "none", displayPrint: "block", color: "#000", fontSize: 13, "& td": { border: "1px solid #999", p: "6px 8px", verticalAlign: "top" }, "& table": { width: "100%", borderCollapse: "collapse", mb: 2 } }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, textAlign: "center" }}>Tenant information form (DMP CIMS)</Typography>
        <Typography sx={{ textAlign: "center", mb: 2 }}>To be given to the local police station</Typography>
        <table>
          <tbody>
            {([
              ["Tenant's name", `${t.firstName} ${t.lastName}`],
              ["Father's / husband's name", ""],
              ["Date of birth", ""],
              ["National ID (NID)", t.nid ?? ""],
              ["Passport", t.passport ?? ""],
              ["Mobile", t.phone ?? ""],
              ["Email", t.email ?? ""],
              ["Occupation and workplace", [t.occupation, t.office].filter(Boolean).join(", ")],
              ["Permanent address", t.permanentAddress ?? ""],
              ["Present address (this unit)", current?.unit ? `${current.unit.name}, ${current.unit.floorName}, ${current.unit.building.name}` : ""],
              ["Moved in on", current ? fmtDate(current.startDate) : ""],
              ["Emergency contact", t.emergencyContact ?? ""],
              ["Landlord", org?.orgName ?? ""],
            ] as const).map(([k, v]) => <tr key={k}><td style={{ width: "38%" }}>{k}</td><td>{v || " "}</td></tr>)}
          </tbody>
        </table>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>People living in the unit</Typography>
        <table>
          <tbody>
            <tr><td>Name</td><td>Relation</td><td>Age</td><td>NID</td></tr>
            {[...household, ...Array(Math.max(0, 5 - household.length)).fill({ name: "" })].map((m: Member, i) => (
              <tr key={i}><td>{m.name || " "}</td><td>{m.relation ?? ""}</td><td>{m.age ?? ""}</td><td>{m.nid ?? ""}</td></tr>
            ))}
          </tbody>
        </table>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 6 }}>
          <span>Tenant's signature ____________________</span>
          <span>Landlord's signature ____________________</span>
        </Stack>
      </Box>
    </Box>
  );
};
