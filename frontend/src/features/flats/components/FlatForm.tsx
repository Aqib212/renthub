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
  MenuItem,
  Box,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import type { FlatFormData } from "@/types/flat";

const schema = yup.object({
  name: yup.string().required("Flat name is required").max(100),
  flatNumber: yup.string().max(50).optional().default(""),
  bedrooms: yup.number().typeError("Must be a number").min(0).default(0),
  bathrooms: yup.number().typeError("Must be a number").min(0).default(0),
  kitchens: yup.number().typeError("Must be a number").min(0).default(1),
  balconies: yup.number().typeError("Must be a number").min(0).default(0),
  area: yup.number().typeError("Must be a number").positive().optional(),
  rent: yup.number().typeError("Must be a number").positive("Rent must be greater than 0").required("Rent is required"),
  advance: yup.number().typeError("Must be a number").min(0).optional(),
  securityDeposit: yup.number().typeError("Must be a number").min(0).optional(),
  sanctionedLoad: yup.number().transform((v, o) => (o === "" ? undefined : v)).typeError("Must be a number").min(0).optional(),
  status: yup.string().oneOf(["VACANT", "OCCUPIED", "NOTICE", "UNDER_MAINTENANCE"]).default("VACANT"),
});

interface FlatFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FlatFormData) => Promise<void>;
  initialData?: FlatFormData;
  title: string;
}

export const FlatForm = ({ open, onClose, onSubmit, initialData, title }: FlatFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FlatFormData>({
    resolver: yupResolver(schema) as any,
    defaultValues: initialData || {
      name: "", flatNumber: "", bedrooms: 0, bathrooms: 0,
      kitchens: 1, balconies: 0, rent: 0,
      status: "VACANT",
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <TextField label="Flat Name" {...register("name")} error={!!errors.name} helperText={errors.name?.message} sx={{ mb: 2 }} />
          <TextField label="Flat Number" {...register("flatNumber")} error={!!errors.flatNumber} helperText={errors.flatNumber?.message} sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Bedrooms" type="number" {...register("bedrooms")} error={!!errors.bedrooms} helperText={errors.bedrooms?.message} />
            <TextField label="Bathrooms" type="number" {...register("bathrooms")} error={!!errors.bathrooms} helperText={errors.bathrooms?.message} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Kitchens" type="number" {...register("kitchens")} error={!!errors.kitchens} helperText={errors.kitchens?.message} />
            <TextField label="Balconies" type="number" {...register("balconies")} error={!!errors.balconies} helperText={errors.balconies?.message} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Area (sq ft)" type="number" {...register("area")} error={!!errors.area} helperText={errors.area?.message} />
            <TextField label="Sanctioned load (kW)" type="number" inputProps={{ step: "any" }} {...register("sanctionedLoad")}
              error={!!errors.sanctionedLoad} helperText={errors.sanctionedLoad?.message || "From the electricity meter; used for the demand charge"} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Asking rent (৳)" type="number" {...register("rent")} error={!!errors.rent} helperText={errors.rent?.message} />
            <TextField label="Asking advance (৳)" type="number" {...register("advance")} error={!!errors.advance} helperText={errors.advance?.message} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Asking security (৳)" type="number" {...register("securityDeposit")} error={!!errors.securityDeposit} helperText={errors.securityDeposit?.message} />
            <TextField select label="Status" {...register("status")} defaultValue="VACANT" sx={{ minWidth: 140 }}>
              <MenuItem value="VACANT">Vacant</MenuItem>
              <MenuItem value="OCCUPIED" disabled>Occupied (from agreement)</MenuItem>
              <MenuItem value="NOTICE" disabled>On notice (from agreement)</MenuItem>
              <MenuItem value="UNDER_MAINTENANCE">Maintenance</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {initialData ? "Update" : "Create"}
          </LoadingButton>
        </DialogActions>
      </form>
    </Dialog>
  );
};
