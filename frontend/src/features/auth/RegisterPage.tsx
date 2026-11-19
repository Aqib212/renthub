import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  Alert,
  MenuItem,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import toast from "react-hot-toast";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

const schema = yup.object({
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phone: yup.string().matches(/^(\+?88)?01[3-9]\d{8}$/, "Invalid Bangladeshi phone number").notRequired(),
  password: yup
    .string()
    .min(8, "Must be at least 8 characters")
    .matches(/[A-Z]/, "Must contain an uppercase letter")
    .matches(/[a-z]/, "Must contain a lowercase letter")
    .matches(/[0-9]/, "Must contain a number")
    .required("Password is required"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Passwords must match")
    .required("Please confirm your password"),
  role: yup.string().oneOf(["HOUSE_OWNER", "MANAGER", "ACCOUNTANT"]).default("HOUSE_OWNER"),
});

type FormData = yup.InferType<typeof schema>;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: { role: "HOUSE_OWNER" },
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      const response = await authApi.register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
        role: data.role,
      });
      const { user, tokens } = response.data.data;
      setAuth(user, tokens);
      toast.success("Registration successful! Please verify your email.");
      navigate("/verify-email");
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default", py: 4 }}>
      <Card sx={{ width: "100%", maxWidth: 520, mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 1, textAlign: "center" }}>Create Account</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
            Register for your RentHub account
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="First Name" {...register("firstName")} error={!!errors.firstName} helperText={errors.firstName?.message} sx={{ mb: 2 }} />
              <TextField label="Last Name" {...register("lastName")} error={!!errors.lastName} helperText={errors.lastName?.message} sx={{ mb: 2 }} />
            </Box>
            <TextField label="Email" {...register("email")} error={!!errors.email} helperText={errors.email?.message} sx={{ mb: 2 }} />
            <TextField label="Phone (Optional)" {...register("phone")} error={!!errors.phone} helperText={errors.phone?.message} placeholder="017XXXXXXXX" sx={{ mb: 2 }} />
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              {...register("password")}
              error={!!errors.password}
              helperText={errors.password?.message}
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
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              {...register("confirmPassword")}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              sx={{ mb: 2 }}
            />
            <TextField select label="Account Type" {...register("role")} defaultValue="HOUSE_OWNER" sx={{ mb: 3 }}>
              <MenuItem value="HOUSE_OWNER">House Owner</MenuItem>
              <MenuItem value="MANAGER">Manager</MenuItem>
              <MenuItem value="ACCOUNTANT">Accountant</MenuItem>
            </TextField>

            <LoadingButton type="submit" variant="contained" fullWidth size="large" loading={isSubmitting}>
              Create Account
            </LoadingButton>

            <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
              Already have an account?{" "}
              <Link component={RouterLink} to="/login" underline="hover">Sign In</Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
