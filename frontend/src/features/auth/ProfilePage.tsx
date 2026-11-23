import { useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Grid, IconButton, InputAdornment, Stack, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { CheckCircle, ErrorOutline, Visibility, VisibilityOff } from "@mui/icons-material";
import toast from "react-hot-toast";
import { authApi } from "@/api/client";
import { useAuthStore, useCurrentMembership } from "@/store/authStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { apiError } from "@/utils/format";
import { CHIP } from "@/theme";

const PHONE = /^(\+?88)?01[3-9]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG = (p: string) => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);

export const ProfilePage = () => {
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const support = useAuthStore((s) => !!s.support);
  const membership = useCurrentMembership();
  const [emailOpen, setEmailOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  if (!user) return null;

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <PageHeader title={t("acct.title")} subtitle={t("acct.subtitle")} />
      {support && <Alert severity="warning" sx={{ mb: 2 }}>{t("acct.support")}</Alert>}

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
          <Avatar src={user.avatar || undefined} sx={{ width: 64, height: 64, bgcolor: "primary.main", fontSize: 24, fontWeight: 700 }}>
            {user.firstName[0]}{user.lastName[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="h6" sx={{ fontSize: 20 }}>{user.firstName} {user.lastName}</Typography>
            <Typography color="text.secondary" fontSize={14}>{user.email}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {membership && <Chip size="small" label={`${t(`role.${membership.role}` as MessageKey)} · ${membership.orgName}`} sx={{ bgcolor: CHIP.ok.bg, color: CHIP.ok.fg, fontWeight: 600 }} />}
              {user.role === "SUPER_ADMIN" && <Chip size="small" label="RentHub admin" sx={{ bgcolor: CHIP.info.bg, color: CHIP.info.fg, fontWeight: 600 }} />}
              <Chip
                size="small"
                icon={user.emailVerified ? <CheckCircle /> : <ErrorOutline />}
                label={user.emailVerified ? t("acct.verified") : t("acct.unverified")}
                sx={user.emailVerified
                  ? { bgcolor: CHIP.ok.bg, color: CHIP.ok.fg, "& .MuiChip-icon": { color: CHIP.ok.fg } }
                  : { bgcolor: CHIP.warning.bg, color: CHIP.warning.fg, "& .MuiChip-icon": { color: CHIP.warning.fg } }}
              />
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}><PersonalCard disabled={support} /></Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Typography variant="h6" sx={{ fontSize: 17 }}>{t("acct.security")}</Typography>
              <Row label={t("acct.email")} value={user.email} action={<Button size="small" variant="outlined" disabled={support} onClick={() => setEmailOpen(true)}>{t("acct.change")}</Button>} />
              <Divider />
              <Row label={t("acct.password")} value="••••••••" action={<Button size="small" variant="outlined" disabled={support} onClick={() => setPwOpen(true)}>{t("acct.change")}</Button>} />
              <Typography fontSize={13} color="text.secondary">{t("acct.pwNote")}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <EmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} />
      <PasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </Box>
  );
};

const Row = ({ label, value, action }: { label: string; value: string; action: React.ReactNode }) => (
  <Stack direction="row" alignItems="center" spacing={2}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography fontSize={13} color="text.secondary">{label}</Typography>
      <Typography fontWeight={600} noWrap title={value}>{value}</Typography>
    </Box>
    {action}
  </Stack>
);

const PersonalCard = ({ disabled }: { disabled: boolean }) => {
  const { t } = useT();
  const { user, setUser } = useAuthStore();
  const initial = { firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", phone: user?.phone ?? "" };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(initial), [user?.firstName, user?.lastName, user?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const errs = {
    firstName: !form.firstName.trim() ? t("acct.required") : "",
    lastName: !form.lastName.trim() ? t("acct.required") : "",
    phone: form.phone.trim() && !PHONE.test(form.phone.trim()) ? t("acct.badPhone") : "",
  };
  const dirty = form.firstName !== initial.firstName || form.lastName !== initial.lastName || form.phone !== initial.phone;
  const valid = !errs.firstName && !errs.lastName && !errs.phone;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || !valid) return;
    setError(""); setBusy(true);
    try {
      const r = await authApi.updateProfile({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() });
      setUser(r.data.data);
      toast.success(t("acct.saved"));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent component="form" onSubmit={submit} noValidate sx={{ display: "grid", gap: 2 }}>
        <Typography variant="h6" sx={{ fontSize: 17 }}>{t("acct.personal")}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label={t("acct.firstName")} value={form.firstName} onChange={set("firstName")} disabled={disabled}
            error={!!errs.firstName} helperText={errs.firstName || " "} />
          <TextField label={t("acct.lastName")} value={form.lastName} onChange={set("lastName")} disabled={disabled}
            error={!!errs.lastName} helperText={errs.lastName || " "} />
        </Stack>
        <TextField label={t("acct.phone")} value={form.phone} onChange={set("phone")} disabled={disabled} inputMode="tel" placeholder="01XXXXXXXXX"
          error={!!errs.phone} helperText={errs.phone || t("acct.phoneHint")} />
        <Stack direction="row" justifyContent="flex-end">
          <Button type="submit" variant="contained" disabled={disabled || !dirty || !valid || busy}>{t("acct.save")}</Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

const EmailDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useT();
  const setUser = useAuthStore((s) => s.setUser);
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [step, setStep] = useState<1 | 2>(1);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setStep(1); setNewEmail(""); setPassword(""); setOtp(""); setError(""); } }, [open]);

  const send = async () => {
    setError(""); setBusy(true);
    try {
      await authApi.requestEmailChange({ newEmail: newEmail.trim(), password });
      setStep(2); setOtp("");
    } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setError(""); setBusy(true);
    try {
      const r = await authApi.confirmEmailChange(otp);
      setUser(r.data.data);
      toast.success(t("acct.emailChanged", { email: r.data.data.email }));
      onClose();
    } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };

  const okEmail = EMAIL.test(newEmail.trim());
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={phone}>
      <form onSubmit={(e) => { e.preventDefault(); if (step === 1 ? okEmail && password : otp.length === 6) (step === 1 ? send : confirm)(); }}>
        <DialogTitle>{t("acct.emailTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {step === 1 ? (
              <>
                <TextField label={t("acct.newEmail")} type="email" autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  error={!!newEmail && !okEmail} helperText={newEmail && !okEmail ? t("acct.badEmail") : " "} />
                <TextField label={t("acct.currentPw")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </>
            ) : (
              <>
                <Typography fontSize={14}>{t("acct.codeSent", { email: newEmail.trim().toLowerCase() })}</Typography>
                <TextField label={t("acct.code")} autoFocus value={otp} inputMode="numeric" autoComplete="one-time-code"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputProps={{ style: { letterSpacing: "0.4em", fontSize: 22, textAlign: "center" } }} />
                <Button size="small" onClick={send} disabled={busy} sx={{ justifySelf: "start", alignSelf: "flex-start" }}>{t("acct.resend")}</Button>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t("acct.cancel")}</Button>
          {step === 1
            ? <Button type="submit" variant="contained" disabled={busy || !okEmail || !password}>{t("acct.sendCode")}</Button>
            : <Button type="submit" variant="contained" disabled={busy || otp.length !== 6}>{t("acct.confirm")}</Button>}
        </DialogActions>
      </form>
    </Dialog>
  );
};

const PasswordDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useT();
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm({ current: "", next: "", again: "" }); setError(""); setShow(false); } }, [open]);

  const weak = !!form.next && !STRONG(form.next);
  const mismatch = !!form.again && form.again !== form.next;
  const ok = !!form.current && STRONG(form.next) && form.again === form.next;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setError(""); setBusy(true);
    try {
      await authApi.changePassword({ currentPassword: form.current, newPassword: form.next });
      toast.success(t("acct.pwDone"));
      useAuthStore.getState().logout();
    } catch (err) { setError(apiError(err)); setBusy(false); }
  };

  const type = show ? "text" : "password";
  const eye = { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShow((v) => !v)} edge="end">{show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={phone}>
      <form onSubmit={submit}>
        <DialogTitle>{t("acct.pwTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label={t("acct.currentPw")} type={type} autoFocus autoComplete="current-password" value={form.current} onChange={set("current")} InputProps={eye} />
            <TextField label={t("acct.newPw")} type={type} autoComplete="new-password" value={form.next} onChange={set("next")}
              error={weak} helperText={weak ? t("acct.pwWeak") : t("acct.pwRules")} />
            <TextField label={t("acct.confirmPw")} type={type} autoComplete="new-password" value={form.again} onChange={set("again")}
              error={mismatch} helperText={mismatch ? t("acct.pwMismatch") : t("acct.pwNote")} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t("acct.cancel")}</Button>
          <Button type="submit" variant="contained" disabled={busy || !ok}>{t("acct.pwTitle")}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
