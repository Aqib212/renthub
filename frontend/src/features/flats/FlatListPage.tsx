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
import { Add, Edit, Delete, ArrowBack, People, ElectricalServices } from "@mui/icons-material";
import toast from "react-hot-toast";
import { flatApi } from "@/api/flat";
import { buildingApi } from "@/api/building";
import { FlatForm } from "./components/FlatForm";
import { FlatDeleteDialog } from "./components/FlatDeleteDialog";
import type { Flat, FlatFormData } from "@/types/flat";

const STATUS_COLORS: Record<string, "success" | "error" | "warning"> = {
  OCCUPIED: "success",
  VACANT: "error",
  UNDER_MAINTENANCE: "warning",
};

export const FlatListPage = () => {
  const { buildingId, floorId } = useParams<{ buildingId: string; floorId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingFlat, setEditingFlat] = useState<Flat | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFlat, setDeletingFlat] = useState<Flat | null>(null);

  const { data: building } = useQuery({
    queryKey: ["building", buildingId],
    queryFn: async () => {
      const res = await buildingApi.getById(Number(buildingId!));
      return res.data.data;
    },
    enabled: !!buildingId,
  });

  const { data: flats = [], isLoading } = useQuery({
    queryKey: ["flats", buildingId, floorId],
    queryFn: async () => {
      const res = await flatApi.getAll(Number(buildingId!), Number(floorId!));
      return res.data.data as (Flat & { _count?: { tenants: number } })[];
    },
    enabled: !!buildingId && !!floorId,
  });

  const createMutation = useMutation({
    mutationFn: (data: FlatFormData) => flatApi.create(Number(buildingId!), Number(floorId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats", buildingId, floorId] });
      toast.success("Flat created");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FlatFormData> }) =>
      flatApi.update(Number(buildingId!), Number(floorId!), id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats", buildingId, floorId] });
      toast.success("Flat updated");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => flatApi.delete(Number(buildingId!), Number(floorId!), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats", buildingId, floorId] });
      toast.success("Flat deleted");
      setDeleteDialogOpen(false);
      setDeletingFlat(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete"),
  });

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditingFlat(null);
  }, []);

  const handleFormSubmit = async (formData: FlatFormData) => {
    if (editingFlat) {
      updateMutation.mutate({ id: editingFlat.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (v: number | null | undefined) =>
    v != null ? `৳${v.toLocaleString()}` : "—";

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Tooltip title="Back to Floors">
          <IconButton onClick={() => navigate(`/buildings/${buildingId}/floors`)} size="small">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Flats — {building?.name || "..."}
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)}>
          Add Flat
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Bed/Bath</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Area</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Rent</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tenants</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>Loading...</TableCell>
                </TableRow>
              ) : flats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No flats in this floor</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                flats.map((flat: any) => (
                  <TableRow key={flat.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {flat.name}
                      {flat.flatNumber && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>({flat.flatNumber})</Typography>}
                    </TableCell>
                    <TableCell>{flat.bedrooms}/{flat.bathrooms}</TableCell>
                    <TableCell>{flat.area ? `${flat.area} sqft` : "—"}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(flat.rent)}</TableCell>
                    <TableCell>
                      <Chip
                        label={flat.status.replace("_", " ")}
                        size="small"
                        color={STATUS_COLORS[flat.status] || "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={flat._count?.tenants ?? flat.totalTenants ?? 0} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Monthly billing">
                        <IconButton size="small" color="primary" onClick={() => navigate("/billing")}>
                          <ElectricalServices fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Tenants">
                        <IconButton size="small" onClick={() => navigate(`/buildings/${buildingId}/floors/${floorId}/flats/${flat.id}/tenants`)}>
                          <People fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditingFlat(flat); setFormOpen(true); }}>
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

      <FlatForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        title={editingFlat ? "Edit Flat" : "Add Flat"}
        initialData={editingFlat ? {
          name: editingFlat.name,
          flatNumber: editingFlat.flatNumber || "",
          bedrooms: editingFlat.bedrooms,
          bathrooms: editingFlat.bathrooms,
          kitchens: editingFlat.kitchens,
          balconies: editingFlat.balconies,
          area: editingFlat.area || undefined,
          rent: editingFlat.rent,
          advance: editingFlat.advance ?? 0,
          securityDeposit: editingFlat.securityDeposit || undefined,
          sanctionedLoad: editingFlat.sanctionedLoad ?? undefined,
          status: editingFlat.status,
        } : undefined}
      />

      <FlatDeleteDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingFlat(null); }}
        onConfirm={async () => { if (deletingFlat) deleteMutation.mutate(deletingFlat.id); }}
        flatName={deletingFlat?.name || ""}
      />
    </Box>
  );
};
