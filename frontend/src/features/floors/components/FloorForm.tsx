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
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import type { FloorFormData } from "@/types/floor";

const schema = yup.object({
  name: yup.string().required("Floor name is required").max(100),
  description: yup.string().optional().default(""),
});

interface FloorFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FloorFormData) => Promise<void>;
  initialData?: FloorFormData;
  title: string;
}

export const FloorForm = ({ open, onClose, onSubmit, initialData, title }: FloorFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FloorFormData>({
    resolver: yupResolver(schema) as any,
    defaultValues: initialData || { name: "", description: "" },
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
          <TextField label="Floor Name" {...register("name")} error={!!errors.name} helperText={errors.name?.message} sx={{ mb: 2 }} />
          <TextField label="Description" {...register("description")} error={!!errors.description} helperText={errors.description?.message} multiline rows={3} />
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
