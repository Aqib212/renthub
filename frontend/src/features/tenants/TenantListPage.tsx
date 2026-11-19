import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Button,
  Tooltip,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from "@mui/material";
import { Add, Edit, Delete, ArrowBack, Visibility, Close } from "@mui/icons-material";
import toast from "react-hot-toast";
import { tenantApi } from "@/api/tenant";
import { buildingApi } from "@/api/building";
import { TenantForm } from "./components/TenantForm";
import { TenantDeleteDialog } from "./components/TenantDeleteDialog";
import type { Tenant, TenantFormData } from "@/types/tenant";
import dayjs from "dayjs";

export const TenantListPage = () => {
  const { buildingId, floorId, flatId } = useParams<{ buildingId: string; floorId: string; flatId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const agreementRef = useRef<HTMLInputElement>(null);

  const { data: building } = useQuery({
    queryKey: ["building", buildingId],
    queryFn: async () => { const r = await buildingApi.getById(Number(buildingId!)); return r.data.data; },
    enabled: !!buildingId,
  });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants", buildingId, floorId, flatId],
    queryFn: async () => { const r = await tenantApi.getAll(Number(buildingId!), Number(floorId!), Number(flatId!)); return r.data.data as Tenant[]; },
    enabled: !!buildingId && !!floorId && !!flatId,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => tenantApi.create(Number(buildingId!), Number(floorId!), Number(flatId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", buildingId, floorId, flatId] });
      toast.success("Tenant created");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      tenantApi.update(Number(buildingId!), Number(floorId!), Number(flatId!), id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", buildingId, floorId, flatId] });
      toast.success("Tenant updated");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tenantApi.delete(Number(buildingId!), Number(floorId!), Number(flatId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", buildingId, floorId, flatId] });
      toast.success("Tenant deleted");
      setDeleteDialogOpen(false);
      setDeletingTenant(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete"),
  });

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditingTenant(null);
    setPhotoFile(null);
    setAgreementFile(null);
  }, []);

  const buildFormData = (data: TenantFormData): FormData => {
    const fd = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== "") fd.append(key, String(value));
    });
    if (photoFile) fd.append("photo", photoFile);
    if (agreementFile) fd.append("agreementDoc", agreementFile);
    return fd;
  };

  const handleFormSubmit = async (data: TenantFormData) => {
    if (editingTenant) {
      updateMutation.mutate({ id: editingTenant.id, data: buildFormData(data) });
    } else {
      createMutation.mutate(buildFormData(data));
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Tooltip title="Back to Flats">
          <IconButton onClick={() => navigate(`/buildings/${buildingId}/floors/${floorId}/flats`)} size="small">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Tenants — {building?.name || "..."}
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)}>
          Add Tenant
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Tenant</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>NID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Occupation</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Move In</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
              ) : tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No tenants in this flat</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: "primary.main" }}>
                          {tenant.firstName[0]}{tenant.lastName[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{tenant.firstName} {tenant.lastName}</Typography>
                          {tenant.email && <Typography variant="caption" color="text.secondary">{tenant.email}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{tenant.phone || "—"}</TableCell>
                    <TableCell>{tenant.nid || "—"}</TableCell>
                    <TableCell>{tenant.occupation || "—"}</TableCell>
                    <TableCell>
                      <Chip label={tenant.status} size="small" color={tenant.status === "ACTIVE" ? "success" : "default"} />
                    </TableCell>
                    <TableCell>{tenant.moveInDate ? dayjs(tenant.moveInDate).format("DD/MM/YYYY") : "—"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => setViewingTenant(tenant)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditingTenant(tenant); setFormOpen(true); }}>
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

      <TenantForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        title={editingTenant ? "Edit Tenant" : "Add Tenant"}
        initialData={editingTenant ? {
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
        } : undefined}
      />

      <TenantDeleteDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingTenant(null); }}
        onConfirm={async () => { if (deletingTenant) deleteMutation.mutate(deletingTenant.id); }}
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
        <DialogActions>
          <Button onClick={() => setViewingTenant(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
