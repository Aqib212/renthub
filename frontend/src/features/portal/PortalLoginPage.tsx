import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { portalApi } from "@/api/portal";
import { usePortalStore } from "@/store/portalStore";
import { useT, useUiStore } from "@/i18n";
import { apiError } from "@/utils/format";
import { tokens } from "@/theme";

/** Phone → SMS code → logged in. No password: the landlord's records are the account. */
export const PortalLoginPage = () => {
  const { t, lang } = useT();
  const setLang = useUiStore((s) => s.setLang);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { accessToken, setSession } = usePortalStore();
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!wait) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const send = useMutation({
    mutationFn: () => portalApi.requestOtp(phone, lang === "bn" ? "BN" : "EN"),
    onSuccess: () => { setStep("code"); setWait(60); setError(""); },
    onError: (e) => setError(apiError(e)),
  });
  const verify = useMutation({
    mutationFn: () => portalApi.verifyOtp(phone, code),
    onSuccess: (s) => { setSession(s); navigate("/portal", { replace: true }); },
    onError: (e) => setError(apiError(e)),
  });

  if (accessToken) return <Navigate to="/portal" replace />;

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", bgcolor: "background.default", px: 2 }}>
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: tokens.green }}>RentHub</Typography>
          <ToggleButtonGroup exclusive size="small" value={lang} onChange={(_, v) => v && setLang(v)} aria-label={t("top.language")}>
            <ToggleButton value="bn">বাংলা</ToggleButton>
            <ToggleButton value="en">EN</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ fontSize: 22, mb: 1 }}>{t("portal.loginTitle")}</Typography>
            {step === "phone" ? (
              <Box component="form" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
                <Typography color="text.secondary" fontSize={14} sx={{ mb: 2 }}>{t("portal.loginHelp")}</Typography>
                <TextField
                  fullWidth autoFocus label={t("portal.phone")} placeholder="01XXXXXXXXX" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputProps={{ inputMode: "tel", autoComplete: "tel" }}
                />
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 2 }} disabled={send.isPending || phone.replace(/\D/g, "").length < 11}>
                  {t("portal.sendCode")}
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={(e) => { e.preventDefault(); verify.mutate(); }}>
                <Typography color="text.secondary" fontSize={14} sx={{ mb: 2 }}>{t("portal.codeSent", { phone })}</Typography>
                <TextField
                  fullWidth autoFocus label={t("portal.code")} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputProps={{ inputMode: "numeric", autoComplete: "one-time-code", pattern: "\\d{6}", style: { letterSpacing: 8, fontSize: 22, textAlign: "center" } }}
                />
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 2 }} disabled={verify.isPending || code.length !== 6}>
                  {t("portal.verify")}
                </Button>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                  <Button size="small" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>{t("portal.changeNumber")}</Button>
                  <Button size="small" disabled={wait > 0 || send.isPending} onClick={() => send.mutate()}>
                    {wait > 0 ? t("portal.resendIn", { s: wait }) : t("portal.resend")}
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
