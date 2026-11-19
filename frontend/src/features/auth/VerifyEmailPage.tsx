import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate } from "react-router-dom";
import { Box, Card, CardContent, Typography, TextField, Alert } from "@mui/material";
import { LoadingButton } from "@mui/lab";
import toast from "react-hot-toast";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

const schema = yup.object({
  otp: yup
    .string()
    .length(6, "OTP must be 6 digits")
    .matches(/^\d+$/, "OTP must contain only digits")
    .required("OTP is required"),
});

type FormData = yup.InferType<typeof schema>;

export const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: yupResolver(schema) });

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setError("");
    try {
      await authApi.verifyEmail(user.email, data.otp);
      setUser({ ...user, emailVerified: true });
      toast.success("Email verified successfully!");
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Verification failed");
    }
  };

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await authApi.resendOtp(user.email);
      toast.success("New OTP sent");
    } catch {
      toast.error("Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  if (!user) return null;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <Card sx={{ width: "100%", maxWidth: 440, mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 1, textAlign: "center" }}>Verify Email</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
            Enter the 6-digit OTP sent to {user.email}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="OTP"
              {...register("otp")}
              error={!!errors.otp}
              helperText={errors.otp?.message}
              inputProps={{ maxLength: 6, style: { textAlign: "center", letterSpacing: 8, fontSize: "1.5rem" } }}
              sx={{ mb: 3 }}
            />
            <LoadingButton type="submit" variant="contained" fullWidth size="large" loading={isSubmitting}>
              Verify Email
            </LoadingButton>
          </Box>

          <Box sx={{ mt: 2, textAlign: "center" }}>
            <LoadingButton variant="text" loading={resending} onClick={handleResend}>
              Resend OTP
            </LoadingButton>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
