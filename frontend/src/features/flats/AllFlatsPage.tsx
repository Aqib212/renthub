import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, Button, Tooltip, Chip, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputLabel, FormControl,
} from "@mui/material";
import { Add, Edit, Delete, People, ElectricalServices } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import toast from "react-hot-toast";
import { flatApi } from "@/api/flat";
import { floorApi } from "@/api/floor";
import { FlatDeleteDialog } from "./components/FlatDeleteDialog";
import type { Flat, FlatFormData } from "@/types/flat";

import { PageHeader } from "@/components/ui/PageHeader";
const STATUS_COLORS: Record<string, "success" | "error" | "warning"> = {
  OCCUPIED: "success", VACANT: "error", UNDER_MAINTENANCE: "warning",
};

export const AllFlatsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingFlat, setEditingFlat] = useState<(Flat & { floorId: number; floor?: { name: string; buildingId: number }; buildingId?: number }) | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFlat, setDeletingFlat] = useState<(Flat & { floorId: number }) | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [formData, setFormData] = useState<FlatFormData>({
    name: "", flatNumber: "", bedrooms: 0, bathrooms: 0, kitchens: 1, balconies: 0, rent: 0, advance: 0, status: "VACANT",
  });

  const { data: flats = [], isLoading } = useQuery({
    queryKey: ["flats", "all"],
    queryFn: async () => {
      const res = await flatApi.getAllForOwner();
      return res.data.data as (Flat & { _count?: { tenants: number }; floor: { name: string; building: { name: string } } })[];
    },
  });

  const { data: floors = [] } = useQuery({
    queryKey: ["floors", "all"],
    queryFn: async () => {
      const res = await floorApi.getAllForOwner();
      return res.data.data as { id: number; name: string; building: { name: string }; buildingId: number }[];
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ floorId, data }: { floorId: number; data: FlatFormData }) => {
      const floor = floors.find((f: any) => f.id === floorId);
      return flatApi.create(floor?.buildingId || 0, floorId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats", "all"] });
      toast.success("Flat created");
      setAddDialogOpen(false);
      setSelectedFloorId("");
      setFormData({ name: "", flatNumber: "", bedrooms: 0, bathrooms: 0, kitchens: 1, balconies: 0, rent: 0, advance: 0, status: "VACANT" });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ buildingId, floorId, id, data }: { buildingId: number; floorId: number; id: number; data: Partial<FlatFormData> }) =>
      flatApi.update(buildingId, floorId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats", "all"] });
      toast.success("Flat updated");
      setEditingFlat(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ buildingId, floorId, id }: { buildingId: number; floorId: number; id: number }) =>
      flatApi.delete(buildingId, floorId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats", "all"] });
      toast.success("Flat deleted");
      setDeleteDialogOpen(false);
      setDeletingFlat(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete"),
  });

  const updateField = (field: keyof FlatFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (v: number | null | undefined) =>
    v != null ? `৳${v.toLocaleString()}` : "—";

  return (
    <Box>
      <PageHeader
        title="All Flats"
        subtitle="Every flat with its rent and status."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddDialogOpen(true)}>
          Add Flat
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Building</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Floor</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Flat Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Bed/Bath</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Rent</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tenants</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
              ) : flats.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No flats found</Typography></TableCell></TableRow>
              ) : (
                flats.map((flat: any) => (
                  <TableRow key={flat.id} hover>
                    <TableCell>{flat.floor?.building?.name || "—"}</TableCell>
                    <TableCell>{flat.floor?.name || "—"}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{flat.name}</TableCell>
                    <TableCell>{flat.bedrooms}/{flat.bathrooms}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(flat.rent)}</TableCell>
                    <TableCell>
                      <Chip label={flat.status.replace("_", " ")} size="small" color={STATUS_COLORS[flat.status] || "default"} />
                    </TableCell>
                    <TableCell><Chip label={flat._count?.tenants ?? 0} size="small" variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Monthly billing">
                        <IconButton size="small" color="primary" onClick={() => navigate("/billing")}>
                          <ElectricalServices fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Tenants">
                        <IconButton size="small" onClick={() => navigate(`/buildings/${flat.floor?.buildingId || flat.buildingId}/floors/${flat.floorId}/flats/${flat.id}/tenants`)}>
                          <People fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditingFlat(flat)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => { setDeletingFlat(flat); setDeleteDialogOpen(true); }}>
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

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Flat</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Floor</InputLabel>
            <Select value={selectedFloorId} label="Floor" onChange={(e) => setSelectedFloorId(e.target.value)}>
              {floors.map((f: any) => (
                <MenuItem key={f.id} value={f.id}>{f.building?.name} / {f.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Flat Name" fullWidth value={formData.name} onChange={(e) => updateField("name", e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Flat Number" fullWidth value={formData.flatNumber} onChange={(e) => updateField("flatNumber", e.target.value)} sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Bedrooms" type="number" value={formData.bedrooms} onChange={(e) => updateField("bedrooms", Number(e.target.value))} />
            <TextField label="Bathrooms" type="number" value={formData.bathrooms} onChange={(e) => updateField("bathrooms", Number(e.target.value))} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Rent (৳)" type="number" value={formData.rent} onChange={(e) => updateField("rent", Number(e.target.value))} />
            <TextField label="Advance (৳)" type="number" value={formData.advance} onChange={(e) => updateField("advance", Number(e.target.value))} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField select label="Status" value={formData.status} onChange={(e) => updateField("status", e.target.value)} sx={{ minWidth: 140 }}>
              <MenuItem value="VACANT">Vacant</MenuItem>
              <MenuItem value="OCCUPIED">Occupied</MenuItem>
              <MenuItem value="UNDER_MAINTENANCE">Maintenance</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <LoadingButton variant="contained" loading={createMutation.isPending} disabled={!selectedFloorId || !formData.name} onClick={() => {
            if (selectedFloorId) createMutation.mutate({ floorId: Number(selectedFloorId), data: formData });
          }}>
            Create
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingFlat} onClose={() => setEditingFlat(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Flat</DialogTitle>
        <DialogContent>
          <TextField label="Flat Name" fullWidth value={editingFlat?.name || ""} onChange={(e) => setEditingFlat(prev => prev ? { ...prev, name: e.target.value } : null)} sx={{ mb: 2 }} />
          <TextField label="Flat Number" fullWidth value={editingFlat?.flatNumber || ""} onChange={(e) => setEditingFlat(prev => prev ? { ...prev, flatNumber: e.target.value } : null)} sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Bedrooms" type="number" value={editingFlat?.bedrooms || 0} onChange={(e) => setEditingFlat(prev => prev ? { ...prev, bedrooms: Number(e.target.value) } : null)} />
            <TextField label="Bathrooms" type="number" value={editingFlat?.bathrooms || 0} onChange={(e) => setEditingFlat(prev => prev ? { ...prev, bathrooms: Number(e.target.value) } : null)} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Rent (৳)" type="number" value={editingFlat?.rent || 0} onChange={(e) => setEditingFlat(prev => prev ? { ...prev, rent: Number(e.target.value) } : null)} />
            <TextField label="Advance (৳)" type="number" value={editingFlat?.advance ?? 0} onChange={(e) => setEditingFlat(prev => prev ? { ...prev, advance: Number(e.target.value) } : null)} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField select label="Status" value={editingFlat?.status || "VACANT"} onChange={(e) => setEditingFlat(prev => prev ? { ...prev, status: e.target.value as any } : null)} sx={{ minWidth: 140 }}>
              <MenuItem value="VACANT">Vacant</MenuItem>
              <MenuItem value="OCCUPIED">Occupied</MenuItem>
              <MenuItem value="UNDER_MAINTENANCE">Maintenance</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingFlat(null)}>Cancel</Button>
          <LoadingButton variant="contained" loading={updateMutation.isPending} onClick={() => {
            if (editingFlat) {
              const bId = editingFlat.floor?.buildingId || editingFlat.buildingId || 0;
              updateMutation.mutate({
                buildingId: bId,
                floorId: editingFlat.floorId,
                id: editingFlat.id,
                data: { name: editingFlat.name, bedrooms: editingFlat.bedrooms, bathrooms: editingFlat.bathrooms, rent: editingFlat.rent, advance: editingFlat.advance ?? 0, status: editingFlat.status as any },
              });
            }
          }}>
            Update
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <FlatDeleteDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingFlat(null); }}
        onConfirm={async () => {
          if (deletingFlat) {
            const f = flats.find((x: any) => x.id === deletingFlat.id) as any;
            deleteMutation.mutate({ buildingId: f?.floor?.buildingId || 0, floorId: deletingFlat.floorId, id: deletingFlat.id });
          }
        }}
        flatName={deletingFlat?.name || ""}
      />
    </Box>
  );
};