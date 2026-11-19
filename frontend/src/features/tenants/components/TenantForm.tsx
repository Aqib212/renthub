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
  Typography,
  Divider,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import type { TenantFormData } from "@/types/tenant";
import type { ChangeEvent } from "react";

const schema = yup.object({
  firstName: yup.string().required("First name is required").max(100),
  lastName: yup.string().required("Last name is required").max(100),
  phone: yup.string().max(20).optional().default(""),
  email: yup.string().email().max(255).optional().default(""),
  nid: yup.string().max(50).optional().default(""),
  passport: yup.string().max(50).optional().default(""),
  drivingLicense: yup.string().max(50).optional().default(""),
  occupation: yup.string().max(100).optional().default(""),
  office: yup.string().max(255).optional().default(""),
  emergencyContact: yup.string().max(20).optional().default(""),
  presentAddress: yup.string().optional().default(""),
  permanentAddress: yup.string().optional().default(""),
  moveInDate: yup.string().optional().default(""),
  moveOutDate: yup.string().optional().default(""),
  members: yup.number().typeError("Must be a number").integer().min(1).default(1),
  status: yup.string().oneOf(["ACTIVE", "FORMER"]).default("ACTIVE"),
});

interface TenantFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TenantFormData) => Promise<void>;
  initialData?: TenantFormData;
  title: string;
}

export const TenantForm = ({ open, onClose, onSubmit, initialData, title }: TenantFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormData>({
    resolver: yupResolver(schema) as any,
    defaultValues: initialData || {
      firstName: "", lastName: "", phone: "", email: "", nid: "",
      passport: "", drivingLicense: "", occupation: "", office: "",
      emergencyContact: "", presentAddress: "", permanentAddress: "",
      moveInDate: "", moveOutDate: "", members: 1, status: "ACTIVE",
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFormSubmit = (data: TenantFormData) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.main" }}>Personal Information</Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="First Name" {...register("firstName")} error={!!errors.firstName} helperText={errors.firstName?.message} />
            <TextField label="Last Name" {...register("lastName")} error={!!errors.lastName} helperText={errors.lastName?.message} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Phone" {...register("phone")} error={!!errors.phone} helperText={errors.phone?.message} />
            <TextField label="Email" {...register("email")} error={!!errors.email} helperText={errors.email?.message} />
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.main" }}>Documents</Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="NID Number" {...register("nid")} error={!!errors.nid} helperText={errors.nid?.message} />
            <TextField label="Passport Number" {...register("passport")} error={!!errors.passport} helperText={errors.passport?.message} />
            <TextField label="Driving License" {...register("drivingLicense")} error={!!errors.drivingLicense} helperText={errors.drivingLicense?.message} />
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.main" }}>Occupation & Contact</Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Occupation" {...register("occupation")} error={!!errors.occupation} helperText={errors.occupation?.message} />
            <TextField label="Office" {...register("office")} error={!!errors.office} helperText={errors.office?.message} />
          </Box>
          <TextField label="Emergency Contact" {...register("emergencyContact")} error={!!errors.emergencyContact} helperText={errors.emergencyContact?.message} sx={{ mb: 2 }} />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.main" }}>Address</Typography>
          <TextField label="Present Address" {...register("presentAddress")} error={!!errors.presentAddress} helperText={errors.presentAddress?.message} multiline rows={2} sx={{ mb: 2 }} />
          <TextField label="Permanent Address" {...register("permanentAddress")} error={!!errors.permanentAddress} helperText={errors.permanentAddress?.message} multiline rows={2} sx={{ mb: 2 }} />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.main" }}>Tenancy</Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField label="Move In Date" type="date" {...register("moveInDate")} InputLabelProps={{ shrink: true }} error={!!errors.moveInDate} helperText={errors.moveInDate?.message} />
            <TextField label="Move Out Date" type="date" {...register("moveOutDate")} InputLabelProps={{ shrink: true }} error={!!errors.moveOutDate} helperText={errors.moveOutDate?.message} />
            <TextField label="People living" type="number" {...register("members")} error={!!errors.members}
              helperText={errors.members?.message || "For per-person bills"} sx={{ maxWidth: 160 }} />
            <TextField select label="Status" {...register("status")} defaultValue="ACTIVE" sx={{ minWidth: 140 }}>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="FORMER">Former</MenuItem>
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

