import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  TextField,
  InputAdornment,
  TablePagination,
  Tooltip,
  Chip,
} from "@mui/material";
import { Add, Edit, Delete, Search, Layers } from "@mui/icons-material";
import toast from "react-hot-toast";
import { buildingApi } from "@/api/building";
import { BuildingForm } from "./components/BuildingForm";
import { BuildingDeleteDialog } from "./components/BuildingDeleteDialog";
import type { Building, BuildingFormData } from "@/types/building";
import { useDebounce } from "@/hooks/useDebounce";

import { PageHeader } from "@/components/ui/PageHeader";
export const BuildingListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [formOpen, setFormOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBuilding, setDeletingBuilding] = useState<Building | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["buildings", page, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      const res = await buildingApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearch || undefined,
      });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (formData: BuildingFormData) => buildingApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Building created");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BuildingFormData> }) => buildingApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Building updated");
      handleFormClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => buildingApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Building deleted");
      setDeleteDialogOpen(false);
      setDeletingBuilding(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete"),
  });

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditingBuilding(null);
  }, []);

  const handleEdit = (building: Building) => {
    setEditingBuilding(building);
    setFormOpen(true);
  };

  const handleDelete = (building: Building) => {
    setDeletingBuilding(building);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (formData: BuildingFormData) => {
    if (editingBuilding) {
      updateMutation.mutate({ id: editingBuilding.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const buildings: Building[] = data?.data || [];
  const total = data?.meta?.total || 0;

  return (
    <Box>
      <PageHeader
        title="Buildings"
        subtitle="Your properties. Building name and address appear on every invoice."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setFormOpen(true)}>
          Add Building
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              placeholder="Search buildings..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Search /></InputAdornment>
                ),
              }}
              sx={{ maxWidth: 360 }}
            />
          </Box>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Holding No.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Area</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>District</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Floors</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>Loading...</TableCell>
                </TableRow>
              ) : buildings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No buildings found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                buildings.map((building) => (
                  <TableRow key={building.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{building.name}</TableCell>
                    <TableCell>{building.holdingNumber || "—"}</TableCell>
                    <TableCell>{building.area || "—"}</TableCell>
                    <TableCell>{building.district || "—"}</TableCell>
                    <TableCell>
                      <Chip label={building.totalFloors} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Floors">
                        <IconButton size="small" color="primary" onClick={() => navigate(`/buildings/${building.id}/floors`)}>
                          <Layers fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(building)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(building)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          />
        </CardContent>
      </Card>

      <BuildingForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        title={editingBuilding ? "Edit Building" : "Add Building"}
        initialData={editingBuilding ? {
          name: editingBuilding.name,
          holdingNumber: editingBuilding.holdingNumber || "",
          address: editingBuilding.address || "",
          ward: editingBuilding.ward || "",
          area: editingBuilding.area || "",
          district: editingBuilding.district || "",
          description: editingBuilding.description || "",
        } : undefined}
      />

      <BuildingDeleteDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingBuilding(null); }}
        onConfirm={async () => { if (deletingBuilding) deleteMutation.mutate(deletingBuilding.id); }}
        buildingName={deletingBuilding?.name || ""}
      />
    </Box>
  );
};
