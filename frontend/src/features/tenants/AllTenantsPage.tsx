import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, Button, Tooltip, Chip, Avatar, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputLabel, FormControl,
  Grid,
} from "@mui/material";
import { Add, Edit, Delete, Visibility, Close } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import toast from "react-hot-toast";
import { tenantApi } from "@/api/tenant";
import { flatApi } from "@/api/flat";
import { TenantDeleteDialog } from "./components/TenantDeleteDialog";
import type { Tenant, TenantFormData } from "@/types/tenant";
import dayjs from "dayjs";

import { PageHeader } from "@/components/ui/PageHeader";
import { Link as RouterLink } from "react-router-dom";
import { Link } from "@mui/material";
export const AllTenantsPage = () => {
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedFlatId, setSelectedFlatId] = useState("");
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants", "all"],
    queryFn: async () => {
      const res = await tenantApi.getAllForOwner();
      return res.data.data as (Tenant & { flat: { name: string; floor: { name: string; building: { name: string } } } })[];
    },
  });

  const { data: flats = [] } = useQuery({
    queryKey: ["flats", "all"],
    queryFn: async () => {
      const res = await flatApi.getAllForOwner();
      return res.data.data as { id: number; name: string; floor: { name: string; building: { name: string }; buildingId: number }; floorId: number; buildingId?: number }[];
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ flatId, data }: { flatId: number; data: FormData }) => {
      const flat = flats.find((f: any) => f.id === flatId);
      return tenantApi.create(flat?.floor?.buildingId || 0, flat?.floorId || 0, flatId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", "all"] });
      toast.success("Tenant created");
      setAddDialogOpen(false);
      setSelectedFlatId("");
      setPhotoFile(null);
      setAgreementFile(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ buildingId, floorId, flatId, id, data }: { buildingId: number; floorId: number; flatId: number; id: number; data: FormData }) =>
      tenantApi.update(buildingId, floorId, flatId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", "all"] });
      toast.success("Tenant updated");
      setEditingTenant(null);
      setPhotoFile(null);
      setAgreementFile(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ buildingId, floorId, flatId, id }: { buildingId: number; floorId: number; flatId: number; id: number }) =>
      tenantApi.delete(buildingId, floorId, flatId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", "all"] });
      toast.success("Tenant deleted");
      setDeleteDialogOpen(false);
      setDeletingTenant(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete"),
  });

  const [newTenant, setNewTenant] = useState<TenantFormData>({
    firstName: "", lastName: "", phone: "", email: "", nid: "",
    passport: "", drivingLicense: "", occupation: "", office: "",
    emergencyContact: "", presentAddress: "", permanentAddress: "",
    moveInDate: "", moveOutDate: "", members: 1, status: "ACTIVE",
  });

  const buildFormData = (data: TenantFormData): FormData => {
    const fd = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== "") fd.append(key, String(value));
    });
    if (photoFile) fd.append("photo", photoFile);
    if (agreementFile) fd.append("agreementDoc", agreementFile);
    return fd;
  };

  return (
    <Box>
      <PageHeader
        title="All Tenants"
        subtitle="People renting your flats. Their name and phone appear on invoices."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddDialogOpen(true)}>
          Add Tenant
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Tenant</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Flat</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Building</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Move In</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
              ) : tenants.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No tenants found</Typography></TableCell></TableRow>
              ) : (
                tenants.map((tenant: any) => (
                  <TableRow key={tenant.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: "primary.main" }}>
                          {tenant.firstName[0]}{tenant.lastName[0]}
                        </Avatar>
                        <Box>
                          <Link component={RouterLink} to={`/tenants/${tenant.id}`} variant="body2" sx={{ fontWeight: 600 }}>{tenant.firstName} {tenant.lastName}</Link>
                          {tenant.email && <Typography variant="caption" color="text.secondary">{tenant.email}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{tenant.phone || "—"}</TableCell>
                    <TableCell>{tenant.flat?.name || "—"}</TableCell>
                    <TableCell>{tenant.flat?.floor?.building?.name || "—"}</TableCell>
                    <TableCell><Chip label={tenant.status} size="small" color={tenant.status === "ACTIVE" ? "success" : "default"} /></TableCell>
                    <TableCell>{tenant.moveInDate ? dayjs(tenant.moveInDate).format("DD/MM/YYYY") : "—"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => setViewingTenant(tenant)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditingTenant(tenant)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => { setDeletingTenant(tenant); setDeleteDialogOpen(true); }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Tenant</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Flat</InputLabel>
            <Select value={selectedFlatId} label="Flat" onChange={(e) => setSelectedFlatId(e.target.value)}>
              {flats.map((f: any) => (
                <MenuItem key={f.id} value={f.id}>{f.floor?.building?.name} / {f.floor?.name} / {f.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="First Name" fullWidth value={newTenant.firstName} onChange={(e) => setNewTenant(prev => ({ ...prev, firstName: e.target.value }))} />
            <TextField label="Last Name" fullWidth value={newTenant.lastName} onChange={(e) => setNewTenant(prev => ({ ...prev, lastName: e.target.value }))} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Phone" fullWidth value={newTenant.phone} onChange={(e) => setNewTenant(prev => ({ ...prev, phone: e.target.value }))} />
            <TextField label="Email" fullWidth value={newTenant.email} onChange={(e) => setNewTenant(prev => ({ ...prev, email: e.target.value }))} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="NID" fullWidth value={newTenant.nid} onChange={(e) => setNewTenant(prev => ({ ...prev, nid: e.target.value }))} />
            <TextField label="Occupation" fullWidth value={newTenant.occupation} onChange={(e) => setNewTenant(prev => ({ ...prev, occupation: e.target.value }))} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Move In Date" type="date" value={newTenant.moveInDate} onChange={(e) => setNewTenant(prev => ({ ...prev, moveInDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField label="Move Out Date" type="date" value={newTenant.moveOutDate} onChange={(e) => setNewTenant(prev => ({ ...prev, moveOutDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField label="People living" type="number" value={newTenant.members ?? 1} sx={{ maxWidth: 150 }}
              onChange={(e) => setNewTenant(prev => ({ ...prev, members: Number(e.target.value) || 1 }))} />
            <TextField select label="Status" value={newTenant.status} onChange={(e) => setNewTenant(prev => ({ ...prev, status: e.target.value as any }))} sx={{ minWidth: 140 }}>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="FORMER">Former</MenuItem>
            </TextField>
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <Button variant="outlined" component="label">Photo<input type="file" hidden accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} /></Button>
            <Button variant="outlined" component="label">Agreement<input type="file" hidden accept=".pdf,.doc,.docx" onChange={(e) => setAgreementFile(e.target.files?.[0] || null)} /></Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <LoadingButton variant="contained" loading={createMutation.isPending} disabled={!selectedFlatId || !newTenant.firstName || !newTenant.lastName} onClick={() => {
            if (selectedFlatId) createMutation.mutate({ flatId: Number(selectedFlatId), data: buildFormData(newTenant) });
          }}>
            Create
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingTenant} onClose={() => { setEditingTenant(null); setPhotoFile(null); setAgreementFile(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Edit Tenant</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="First Name" fullWidth value={editingTenant?.firstName || ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, firstName: e.target.value } : null)} />
            <TextField label="Last Name" fullWidth value={editingTenant?.lastName || ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, lastName: e.target.value } : null)} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Phone" fullWidth value={editingTenant?.phone || ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, phone: e.target.value } : null)} />
            <TextField label="Email" fullWidth value={editingTenant?.email || ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, email: e.target.value } : null)} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="NID" fullWidth value={editingTenant?.nid || ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, nid: e.target.value } : null)} />
            <TextField label="Occupation" fullWidth value={editingTenant?.occupation || ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, occupation: e.target.value } : null)} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Move In Date" type="date" value={editingTenant?.moveInDate ? dayjs(editingTenant.moveInDate).format("YYYY-MM-DD") : ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, moveInDate: e.target.value } : null)} InputLabelProps={{ shrink: true }} />
            <TextField label="Move Out Date" type="date" value={editingTenant?.moveOutDate ? dayjs(editingTenant.moveOutDate).format("YYYY-MM-DD") : ""} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, moveOutDate: e.target.value } : null)} InputLabelProps={{ shrink: true }} />
            <TextField label="People living" type="number" value={editingTenant?.members ?? 1} sx={{ maxWidth: 150 }}
              onChange={(e) => setEditingTenant(prev => prev ? { ...prev, members: Number(e.target.value) || 1 } : null)} />
            <TextField select label="Status" value={editingTenant?.status || "ACTIVE"} onChange={(e) => setEditingTenant(prev => prev ? { ...prev, status: e.target.value as any } : null)} sx={{ minWidth: 140 }}>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="FORMER">Former</MenuItem>
            </TextField>
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <Button variant="outlined" component="label">Photo<input type="file" hidden accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} /></Button>
            <Button variant="outlined" component="label">Agreement<input type="file" hidden accept=".pdf,.doc,.docx" onChange={(e) => setAgreementFile(e.target.files?.[0] || null)} /></Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setEditingTenant(null); setPhotoFile(null); setAgreementFile(null); }}>Cancel</Button>
          <LoadingButton variant="contained" loading={updateMutation.isPending} onClick={() => {
            if (editingTenant) {
              const flat = flats.find((f: any) => f.id === editingTenant.flatId) as any;
              const data: TenantFormData = {
                firstName: editingTenant.firstName,
                lastName: editingTenant.lastName,
                phone: editingTenant.phone || "",
                email: editingTenant.email || "",
                nid: editingTenant.nid || "",
                passport: editingTenant.passport || "",
                drivingLicense: editingTenant.drivingLicense || "",
                occupation: editingTenant.occupation || "",
                office: editingTenant.office || "",
                emergencyContact: editingTenant.emergencyContact || "",
                presentAddress: editingTenant.presentAddress || "",
                permanentAddress: editingTenant.permanentAddress || "",
                moveInDate: editingTenant.moveInDate ? dayjs(editingTenant.moveInDate).format("YYYY-MM-DD") : "",
                moveOutDate: editingTenant.moveOutDate ? dayjs(editingTenant.moveOutDate).format("YYYY-MM-DD") : "",
                members: editingTenant.members ?? 1,
                status: editingTenant.status,
              };
              updateMutation.mutate({
                buildingId: flat?.floor?.buildingId || 0,
                floorId: flat?.floorId || 0,
                flatId: editingTenant.flatId ?? 0, // the API finds tenants by id; the flat in the path is only a route prefix
                id: editingTenant.id,
                data: buildFormData(data),
              });
            }
          }}>
            Update
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <TenantDeleteDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingTenant(null); }}
        onConfirm={async () => {
          if (deletingTenant) {
            const flat = flats.find((f: any) => f.id === deletingTenant.flatId) as any;
            deleteMutation.mutate({
              buildingId: flat?.floor?.buildingId || 0,
              floorId: flat?.floorId || 0,
              flatId: deletingTenant.flatId ?? 0,
              id: deletingTenant.id,
            });
          }
        }}
        tenantName={deletingTenant ? `${deletingTenant.firstName} ${deletingTenant.lastName}` : ""}
      />

      <Dialog open={!!viewingTenant} onClose={() => setViewingTenant(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Tenant Details
            <IconButton size="small" onClick={() => setViewingTenant(null)}><Close /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {viewingTenant && (
            <Grid container spacing={2}>
              <Grid item xs={12} sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1 }}>
                <Avatar sx={{ width: 56, height: 56, fontSize: 24, bgcolor: "primary.main" }}>
                  {viewingTenant.firstName[0]}{viewingTenant.lastName[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6">{viewingTenant.firstName} {viewingTenant.lastName}</Typography>
                  <Chip label={viewingTenant.status} size="small" color={viewingTenant.status === "ACTIVE" ? "success" : "default"} />
                </Box>
              </Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Phone</Typography><Typography variant="body2">{viewingTenant.phone || "—"}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Email</Typography><Typography variant="body2">{viewingTenant.email || "—"}</Typography></Grid>
              <Grid item xs={4}><Typography variant="caption" color="text.secondary">NID</Typography><Typography variant="body2">{viewingTenant.nid || "—"}</Typography></Grid>
              <Grid item xs={4}><Typography variant="caption" color="text.secondary">Passport</Typography><Typography variant="body2">{viewingTenant.passport || "—"}</Typography></Grid>
              <Grid item xs={4}><Typography variant="caption" color="text.secondary">Driving License</Typography><Typography variant="body2">{viewingTenant.drivingLicense || "—"}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Occupation</Typography><Typography variant="body2">{viewingTenant.occupation || "—"}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Office</Typography><Typography variant="body2">{viewingTenant.office || "—"}</Typography></Grid>
              <Grid item xs={12}><Typography variant="caption" color="text.secondary">Present Address</Typography><Typography variant="body2">{viewingTenant.presentAddress || "—"}</Typography></Grid>
              <Grid item xs={12}><Typography variant="caption" color="text.secondary">Permanent Address</Typography><Typography variant="body2">{viewingTenant.permanentAddress || "—"}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Move In</Typography><Typography variant="body2">{viewingTenant.moveInDate ? dayjs(viewingTenant.moveInDate).format("DD MMM YYYY") : "—"}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Move Out</Typography><Typography variant="body2">{viewingTenant.moveOutDate ? dayjs(viewingTenant.moveOutDate).format("DD MMM YYYY") : "—"}</Typography></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewingTenant(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
};