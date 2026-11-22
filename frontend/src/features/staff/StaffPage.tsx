import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, MenuItem,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { PersonAddAlt1Outlined, DeleteOutline, Check, Remove } from "@mui/icons-material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { orgApi, type Member, type StaffRole } from "@/api/org";
import { apiError } from "@/utils/format";
import { buildingApi } from "@/api/building";

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", MANAGER: "Manager", ACCOUNTANT: "Accountant", CARETAKER: "Caretaker" };
const ROLE_HINT: Record<StaffRole, string> = {
  MANAGER: "Runs properties and billing. Can't manage staff or settings.",
  ACCOUNTANT: "Records payments and expenses, reads reports.",
  CARETAKER: "Records cash collected. Sees units, nothing financial beyond that.",
};
const ACTION_LABEL: Record<string, string> = {
  "property:write": "Edit buildings, units, tenants",
  "billing:write": "Billing and invoices",
  "payment:write": "Record payments",
  "expense:write": "Record expenses",
  "report:read": "See reports",
  "staff:manage": "Manage staff",
  "settings:write": "Change settings",
};

const emptyInvite = { firstName: "", lastName: "", email: "", phone: "", role: "CARETAKER" as StaffRole, buildingIds: [] as number[] };

/** "All buildings" (empty) or some of them. A limited member sees only those buildings, and no vehicles. */
const BuildingsPicker = ({ value, onChange, buildings, size, label }: {
  value: number[]; onChange: (ids: number[]) => void; buildings: { id: number; name: string }[]; size?: "small"; label?: string;
}) => (
  <TextField
    select size={size} label={label} value={value}
    SelectProps={{
      multiple: true, displayEmpty: true,
      renderValue: (v) => ((v as number[]).length ? buildings.filter((b) => (v as number[]).includes(b.id)).map((b) => b.name).join(", ") : "All buildings"),
    }}
    InputLabelProps={label ? { shrink: true } : undefined}
    onChange={(e) => onChange((e.target.value as unknown as number[]).map(Number))}
    helperText={label ? (value.length ? "Sees only these buildings (no vehicles)" : "Sees every building and vehicle") : undefined}
  >
    {buildings.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
  </TextField>
);

export const StaffPage = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["org-members"], queryFn: orgApi.members });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings", { limit: 200 }],
    queryFn: async () => {
      const res = await buildingApi.getAll({ limit: 200 });
      return (res.data.data || res.data) as { id: number; name: string }[];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyInvite);
  const refresh = () => qc.invalidateQueries({ queryKey: ["org-members"] });

  const invite = useMutation({
    mutationFn: () => orgApi.invite({ ...form, phone: form.phone || undefined, buildingIds: form.buildingIds.length ? form.buildingIds : null }),
    onSuccess: () => {
      toast.success("Member added. A new account's temporary password is printed in the server console.");
      setOpen(false);
      setForm(emptyInvite);
      refresh();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { role?: StaffRole; isActive?: boolean; buildingIds?: number[] | null } }) => orgApi.updateMember(id, body),
    onSuccess: refresh,
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: (m: Member) => orgApi.removeMember(m.id),
    onSuccess: () => { toast.success("Removed"); refresh(); },
    onError: (e) => toast.error(apiError(e)),
  });

  const actions = data?.permissions[0] ? Object.keys(data.permissions[0].actions) : [];
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Box>
      <PageHeader
        title="Staff & roles"
        subtitle="People who help run your properties. Each role only sees and changes what it needs to."
        actions={<Button variant="contained" startIcon={<PersonAddAlt1Outlined />} onClick={() => setOpen(true)}>Add staff</Button>}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow><TableCell>Person</TableCell><TableCell>Role</TableCell><TableCell>Buildings</TableCell><TableCell>Active</TableCell><TableCell align="right" /></TableRow>
              </TableHead>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>}
                {data?.members.map((m) => {
                  const owner = m.role === "OWNER";
                  return (
                    <TableRow key={m.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{m.user.firstName} {m.user.lastName}</Typography>
                        <Typography variant="body2" color="text.secondary">{m.user.email}{m.user.phone ? ` · ${m.user.phone}` : ""}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>
                        {owner ? (
                          <Chip size="small" color="success" label="Owner" />
                        ) : (
                          <TextField
                            select size="small" value={m.role} aria-label={`Role for ${m.user.firstName}`}
                            onChange={(e) => update.mutate({ id: m.id, body: { role: e.target.value as StaffRole } })}
                          >
                            {(Object.keys(ROLE_HINT) as StaffRole[]).map((r) => <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>)}
                          </TextField>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 170, maxWidth: 260 }}>
                        {owner ? <Typography variant="body2" color="text.secondary">All</Typography> : (
                          <BuildingsPicker size="small" buildings={buildings} value={m.buildingIds ?? []}
                            onChange={(ids) => update.mutate({ id: m.id, body: { buildingIds: ids.length ? ids : null } })} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={m.isActive} disabled={owner}
                          inputProps={{ "aria-label": `${m.user.firstName} active` }}
                          onChange={(e) => update.mutate({ id: m.id, body: { isActive: e.target.checked } })}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {!owner && (
                          <Tooltip title="Remove from this workspace">
                            <IconButton aria-label={`Remove ${m.user.firstName}`} onClick={() => remove.mutate(m)}><DeleteOutline /></IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5, fontSize: 17 }}>What each role can do</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      {data?.permissions.map((p) => <TableCell key={p.role} align="center">{ROLE_LABEL[p.role]}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {actions.map((a) => (
                      <TableRow key={a}>
                        <TableCell>{ACTION_LABEL[a] ?? a}</TableCell>
                        {data!.permissions.map((p) => (
                          <TableCell key={p.role} align="center">
                            {p.actions[a]
                              ? <Check fontSize="small" color="success" aria-label="Allowed" />
                              : <Remove fontSize="small" sx={{ color: "text.disabled" }} aria-label="Not allowed" />}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add staff</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" }, pt: "8px !important" }}>
          <TextField label="First name" value={form.firstName} onChange={set("firstName")} required />
          <TextField label="Last name" value={form.lastName} onChange={set("lastName")} required />
          <TextField label="Email" type="email" value={form.email} onChange={set("email")} required />
          <TextField label="Phone" value={form.phone} onChange={set("phone")} />
          <TextField select label="Role" value={form.role} onChange={set("role")} helperText={ROLE_HINT[form.role]} sx={{ gridColumn: { sm: "1 / -1" } }}>
            {(Object.keys(ROLE_HINT) as StaffRole[]).map((r) => <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>)}
          </TextField>
          {buildings.length > 1 && (
            <Box sx={{ gridColumn: { sm: "1 / -1" }, display: "grid" }}>
              <BuildingsPicker label="Buildings" buildings={buildings} value={form.buildingIds} onChange={(ids) => setForm({ ...form, buildingIds: ids })} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained" disabled={!form.firstName || !form.lastName || !form.email || invite.isPending}
            onClick={() => invite.mutate()}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
