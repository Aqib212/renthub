import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import type { BuildingFormData } from "@/types/building";

const schema = yup.object({
  name: yup.string().required("Building name is required").max(200),
  holdingNumber: yup.string().max(100).optional().default(""),
  address: yup.string().optional().default(""),
  ward: yup.string().max(50).optional().default(""),
  area: yup.string().max(100).optional().default(""),
  district: yup.string().max(100).optional().default(""),
  description: yup.string().optional().default(""),
});

interface BuildingFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BuildingFormData) => Promise<void>;
  initialData?: BuildingFormData;
  title: string;
}

export const BuildingForm = ({ open, onClose, onSubmit, initialData, title }: BuildingFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BuildingFormData>({
    resolver: yupResolver(schema) as any,
    defaultValues: initialData || {
      name: "",
      holdingNumber: "",
      address: "",
      ward: "",
      area: "",
      district: "",
      description: "",
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          <TextField label="Building Name" {...register("name")} error={!!errors.name} helperText={errors.name?.message} sx={{ mb: 2 }} />
          <TextField label="Holding Number" {...register("holdingNumber")} error={!!errors.holdingNumber} helperText={errors.holdingNumber?.message} sx={{ mb: 2 }} />
          <TextField label="Address" {...register("address")} error={!!errors.address} helperText={errors.address?.message} multiline rows={2} sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField label="Ward" {...register("ward")} error={!!errors.ward} helperText={errors.ward?.message} sx={{ mb: 2 }} />
            <TextField label="Area" {...register("area")} error={!!errors.area} helperText={errors.area?.message} sx={{ mb: 2 }} />
            <TextField label="District" {...register("district")} error={!!errors.district} helperText={errors.district?.message} sx={{ mb: 2 }} />
          </Box>
          <TextField label="Description" {...register("description")} error={!!errors.description} helperText={errors.description?.message} multiline rows={3} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {initialData ? "Update" : "Create"}
          </LoadingButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

