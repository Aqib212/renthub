import { useState, useCallback } from "react";
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
} from "@mui/material";
import { Add, Edit, Delete, ArrowBack, Apartment } from "@mui/icons-material";
import toast from "react-hot-toast";
import { floorApi } from "@/api/floor";
import { buildingApi } from "@/api/building";
import { FloorForm } from "./components/FloorForm";
import { FloorDeleteDialog } from "./components/FloorDeleteDialog";
import type { Floor, FloorFormData } from "@/types/floor";

export const FloorListPage = () => {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFloor, setDeletingFloor] = useState<Floor | null>(null);

  const { data: building } = useQuery({
    queryKey: ["building", buildingId],
    queryFn: async () => {
      const res = await buildingApi.getById(Number(buildingId!));
      return res.data.data;
    },
    enabled: !!buildingId,
  });

  const { data: floors = [], isLoading } = useQuery({
    queryKey: ["floors", buildingId],
    queryFn: async () => {
      const res = await floorApi.getAll(Number(buildingId!));
      return res.data.data as (Floor & { _count?: { flats: number } })[];
    },
    enabled: !!buildingId,
  });

  const createMutation = useMutation({
    mutationFn: (data: FloorFormData) => floorApi.create(Number(buildingId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors", buildingId] });
      toast.success("Floor created");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FloorFormData> }) =>
      floorApi.update(Number(buildingId!), id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors", buildingId] });
      toast.success("Floor updated");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => floorApi.delete(Number(buildingId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors", buildingId] });
      toast.success("Floor deleted");
      setDeleteDialogOpen(false);
      setDeletingFloor(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete"),
  });

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditingFloor(null);
  }, []);

  const handleFormSubmit = async (formData: FloorFormData) => {
    if (editingFloor) {
      updateMutation.mutate({ id: editingFloor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Tooltip title="Back to Buildings">
          <IconButton onClick={() => navigate("/buildings")} size="small">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Floors — {building?.name || "..."}
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)}>
          Add Floor
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Floor Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Flats</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>Loading...</TableCell>
                </TableRow>
              ) : floors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No floors in this building</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                floors.map((floor: any) => (
                  <TableRow key={floor.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{floor.name}</TableCell>
                    <TableCell>{floor.description || "—"}</TableCell>
                    <TableCell>
                      <Chip label={floor._count?.flats ?? floor.totalFlats ?? 0} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Flats">
                        <IconButton size="small" color="primary" onClick={() => navigate(`/buildings/${buildingId}/floors/${floor.id}/flats`)}>
                          <Apartment fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditingFloor(floor); setFormOpen(true); }}>
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

      <FloorForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        title={editingFloor ? "Edit Floor" : "Add Floor"}
        initialData={editingFloor ? { name: editingFloor.name, description: editingFloor.description || "" } : undefined}
      />

      <FloorDeleteDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingFloor(null); }}
        onConfirm={async () => { if (deletingFloor) deleteMutation.mutate(deletingFloor.id); }}
        floorName={deletingFloor?.name || ""}
      />
    </Box>
  );
};
