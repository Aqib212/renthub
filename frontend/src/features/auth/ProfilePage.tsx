import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Typography,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  IconButton,
  Alert,
  Divider,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import toast from "react-hot-toast";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

const profileSchema = yup.object({
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  phone: yup.string().matches(/^(\+?88)?01[3-9]\d{8}$/, "Invalid phone number").notRequired(),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required("Current password is required"),
  newPassword: yup
    .string()
    .min(8, "Must be at least 8 characters")
    .matches(/[A-Z]/, "Must contain an uppercase letter")
    .matches(/[a-z]/, "Must contain a lowercase letter")
    .matches(/[0-9]/, "Must contain a number")
    .required("New password is required"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("newPassword")], "Passwords must match")
    .required("Please confirm your password"),
});

type ProfileFormData = yup.InferType<typeof profileSchema>;
type PasswordFormData = yup.InferType<typeof passwordSchema>;

export const ProfilePage = () => {
  const { user, setUser } = useAuthStore();
  const [error, setError] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: yupResolver(passwordSchema),
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
    setError("");
    try {
      const response = await authApi.updateProfile(data);
      setUser(response.data.data);
      toast.success("Profile updated");
    } catch (err: any) {
      setError(err.response?.data?.message || "Update failed");
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setError("");
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed. Please login again.");
      setPasswordDialogOpen(false);
      passwordForm.reset();
      useAuthStore.getState().logout();
    } catch (err: any) {
      setError(err.response?.data?.message || "Password change failed");
    }
  };

  if (!user) return null;

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>My Profile</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
            <Avatar src={user.avatar || undefined} sx={{ width: 80, height: 80, bgcolor: "primary.main", fontSize: 32 }}>
              {user.firstName[0]}{user.lastName[0]}
            </Avatar>
            <Box>
              <Typography variant="h6">{user.firstName} {user.lastName}</Typography>
              <Typography variant="body2" color="text.secondary">{user.email}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user.role.replace("_", " ")} | {user.status}
                {user.emailVerified ? " | Email Verified" : " | Email Not Verified"}
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={profileForm.handleSubmit(onProfileSubmit)} noValidate>
            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <TextField label="First Name" {...profileForm.register("firstName")} error={!!profileForm.formState.errors.firstName} helperText={profileForm.formState.errors.firstName?.message} />
              <TextField label="Last Name" {...profileForm.register("lastName")} error={!!profileForm.formState.errors.lastName} helperText={profileForm.formState.errors.lastName?.message} />
            </Box>
            <TextField label="Phone" {...profileForm.register("phone")} error={!!profileForm.formState.errors.phone} helperText={profileForm.formState.errors.phone?.message} sx={{ mb: 2 }} />
            <TextField label="Email" value={user.email} disabled sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", gap: 2 }}>
              <LoadingButton type="submit" variant="contained" loading={profileForm.formState.isSubmitting}>
                Save Changes
              </LoadingButton>
              <Button variant="outlined" onClick={() => setPasswordDialogOpen(true)}>Change Password</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <Box component="form" onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} noValidate>
          <DialogContent>
            <TextField
              label="Current Password"
              type={showPassword ? "text" : "password"}
              {...passwordForm.register("currentPassword")}
              error={!!passwordForm.formState.errors.currentPassword}
              helperText={passwordForm.formState.errors.currentPassword?.message}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="New Password"
              type={showPassword ? "text" : "password"}
              {...passwordForm.register("newPassword")}
              error={!!passwordForm.formState.errors.newPassword}
              helperText={passwordForm.formState.errors.newPassword?.message}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Confirm New Password"
              type={showPassword ? "text" : "password"}
              {...passwordForm.register("confirmPassword")}
              error={!!passwordForm.formState.errors.confirmPassword}
              helperText={passwordForm.formState.errors.confirmPassword?.message}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
            <LoadingButton type="submit" variant="contained" loading={passwordForm.formState.isSubmitting}>
              Change Password
            </LoadingButton>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};
