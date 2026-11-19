import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, Button, Tooltip, Chip, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputLabel, FormControl,
} from "@mui/material";
import { Add, Edit, Delete, Apartment } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import toast from "react-hot-toast";
import { floorApi } from "@/api/floor";
import { buildingApi } from "@/api/building";
import { FloorDeleteDialog } from "./components/FloorDeleteDialog";
import type { Floor, FloorFormData } from "@/types/floor";
import type { Building } from "@/types/building";

import { PageHeader } from "@/components/ui/PageHeader";
export const AllFloorsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingFloor, setEditingFloor] = useState<Floor & { buildingId: number } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFloor, setDeletingFloor] = useState<Floor & { buildingId: number } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [newFloorName, setNewFloorName] = useState("");
  const [newFloorDesc, setNewFloorDesc] = useState("");

  const { data: floors = [], isLoading } = useQuery({
    queryKey: ["floors", "all"],
    queryFn: async () => {
      const res = await floorApi.getAllForOwner();
      return res.data.data as (Floor & { _count?: { flats: number }; building: { name: string } })[];
    },
  });

  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings", "all"],
    queryFn: async () => {
      const res = await buildingApi.getAll({ limit: 100 });
      return res.data.data as Building[];
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ buildingId, data }: { buildingId: number; data: FloorFormData }) =>
      floorApi.create(buildingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors", "all"] });
      toast.success("Floor created");
      setAddDialogOpen(false);
      setSelectedBuildingId("");
      setNewFloorName("");
      setNewFloorDesc("");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ buildingId, id, data }: { buildingId: number; id: number; data: Partial<FloorFormData> }) =>
      floorApi.update(buildingId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors", "all"] });
      toast.success("Floor updated");
      setEditingFloor(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ buildingId, id }: { buildingId: number; id: number }) =>
      floorApi.delete(buildingId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors", "all"] });
      toast.success("Floor deleted");
      setDeleteDialogOpen(false);
      setDeletingFloor(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete"),
  });

  const handleAddFloor = () => {
    if (!selectedBuildingId || !newFloorName) return;
    createMutation.mutate({
      buildingId: Number(selectedBuildingId),
      data: { name: newFloorName, description: newFloorDesc || undefined },
    });
  };

  return (
    <Box>
      <PageHeader
        title="All Floors"
        subtitle="Floors across all your buildings."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddDialogOpen(true)}>
          Add Floor
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Building</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Floor Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Flats</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>Loading...</TableCell></TableRow>
              ) : floors.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No floors found</Typography></TableCell></TableRow>
              ) : (
                floors.map((floor: any) => (
                  <TableRow key={floor.id} hover>
                    <TableCell>{floor.building?.name || "—"}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{floor.name}</TableCell>
                    <TableCell>{floor.description || "—"}</TableCell>
                    <TableCell><Chip label={floor._count?.flats ?? 0} size="small" color="primary" variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Flats">
                        <IconButton size="small" color="primary" onClick={() => navigate(`/buildings/${floor.buildingId}/floors/${floor.id}/flats`)}>
                          <Apartment fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditingFloor(floor)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => { setDeletingFloor(floor); setDeleteDialogOpen(true); }}>
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
        <DialogTitle>Add Floor</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Building</InputLabel>
            <Select value={selectedBuildingId} label="Building" onChange={(e) => setSelectedBuildingId(e.target.value)}>
              {buildings.map((b: Building) => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Floor Name" fullWidth value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Description" fullWidth value={newFloorDesc} onChange={(e) => setNewFloorDesc(e.target.value)} multiline rows={3} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <LoadingButton variant="contained" loading={createMutation.isPending} disabled={!selectedBuildingId || !newFloorName} onClick={handleAddFloor}>
            Create
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingFloor} onClose={() => setEditingFloor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Floor</DialogTitle>
        <DialogContent>
          <TextField label="Floor Name" fullWidth value={editingFloor?.name || ""} onChange={(e) => setEditingFloor(prev => prev ? { ...prev, name: e.target.value } : null)} sx={{ mb: 2 }} />
          <TextField label="Description" fullWidth value={editingFloor?.description || ""} onChange={(e) => setEditingFloor(prev => prev ? { ...prev, description: e.target.value } : null)} multiline rows={3} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingFloor(null)}>Cancel</Button>
          <LoadingButton variant="contained" loading={updateMutation.isPending} onClick={() => {
            if (editingFloor) updateMutation.mutate({
              buildingId: editingFloor.buildingId,
              id: editingFloor.id,
              data: { name: editingFloor.name, description: editingFloor.description || undefined },
            });
          }}>
            Update
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <FloorDeleteDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingFloor(null); }}
        onConfirm={async () => {
          if (deletingFloor) deleteMutation.mutate({ buildingId: deletingFloor.buildingId, id: deletingFloor.id });
        }}
        floorName={deletingFloor?.name || ""}
      />
    </Box>
  );
};