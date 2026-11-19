import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Link as RouterLink } from "react-router-dom";
import { Box, Card, CardContent, TextField, Typography, Link, Alert } from "@mui/material";
import { LoadingButton } from "@mui/lab";
import toast from "react-hot-toast";
import { authApi } from "@/api/client";

const schema = yup.object({
  email: yup.string().email("Invalid email").required("Email is required"),
});

type FormData = yup.InferType<typeof schema>;

export const ForgotPasswordPage = () => {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: yupResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await authApi.forgotPassword(data.email);
      setSent(true);
      toast.success("Reset link sent if the email exists");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <Card sx={{ width: "100%", maxWidth: 440, mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 1, textAlign: "center" }}>Forgot Password</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
            Enter your email to receive a reset link
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {sent && <Alert severity="success" sx={{ mb: 2 }}>If the email exists, a reset link has been sent.</Alert>}

          {!sent && (
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField label="Email" {...register("email")} error={!!errors.email} helperText={errors.email?.message} sx={{ mb: 3 }} />
              <LoadingButton type="submit" variant="contained" fullWidth size="large" loading={isSubmitting}>
                Send Reset Link
              </LoadingButton>
            </Box>
          )}

          <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
            <Link component={RouterLink} to="/login" underline="hover">Back to Sign In</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
