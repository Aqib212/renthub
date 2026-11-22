import { useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography, Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { translate, type Lang } from "@/i18n";
import { PrintOutlined, HomeWork, PaymentsOutlined } from "@mui/icons-material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiError, formatBDT } from "@/utils/format";
import { invoiceApi } from "@/api/invoice";
import { InvoiceDocument, InvoicePrintStyles } from "./components/InvoiceDocument";

/** What the tenant sees when they open the shared link. No login needed. */
export const PublicInvoicePage = () => {
  const { token = "" } = useParams();
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["public-invoice", token],
    queryFn: () => invoiceApi.getShared(token),
    retry: false,
  });
  const [chosen, setChosen] = useState<Lang | null>(null);
  const [params] = useSearchParams();
  const back = params.get("pay"); // failed / cancelled, when the gateway sends the tenant back
  const pay = useMutation({ mutationFn: () => invoiceApi.payOnline(token), onSuccess: ({ url }) => { window.location.href = url; } });
  // the tenant's language (Bangla unless set to English), switchable here
  const lang: Lang = chosen ?? ((invoice?.tenant as any)?.lang === "EN" ? "en" : "bn");

  return (
    <Box lang={lang} sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 2, sm: 5 }, px: { xs: 1.5, sm: 3 } }}>
      <InvoicePrintStyles />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ maxWidth: 794, mx: "auto", mb: 2, displayPrint: "none" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HomeWork color="primary" />
          <Typography sx={{ fontWeight: 700 }}>RentHub</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup exclusive size="small" value={lang} onChange={(_, v) => v && setChosen(v)} aria-label="Language">
            <ToggleButton value="bn">বাংলা</ToggleButton>
            <ToggleButton value="en">English</ToggleButton>
          </ToggleButtonGroup>
          {invoice && <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>{translate(lang, "common.print")}</Button>}
        </Stack>
      </Stack>
      {isLoading && <Box sx={{ textAlign: "center", py: 10 }}><CircularProgress /></Box>}
      {error && (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6">{translate(lang, "inv.notFound")}</Typography>
          <Typography color="text.secondary">{translate(lang, "inv.badLink")}</Typography>
        </Box>
      )}
      {invoice && (back === "failed" || back === "cancelled") && (
        <Alert severity="warning" sx={{ maxWidth: 794, mx: "auto", mb: 2, displayPrint: "none" }}>{translate(lang, back === "failed" ? "pay.failed" : "pay.cancelled")}</Alert>
      )}
      {invoice?.canPayOnline && Number(invoice.dueAmount) > 0 && (
        <Box sx={{ maxWidth: 794, mx: "auto", mb: 2, displayPrint: "none" }}>
          <Button fullWidth size="large" variant="contained" startIcon={<PaymentsOutlined />} onClick={() => pay.mutate()} disabled={pay.isPending}>
            {translate(lang, "pay.button", { amount: formatBDT(Number(invoice.dueAmount), lang) })}
          </Button>
          <Typography fontSize={12} color="text.secondary" textAlign="center" sx={{ mt: 0.75 }}>{translate(lang, "pay.hint")}</Typography>
          {pay.isError && <Alert severity="error" sx={{ mt: 1 }}>{apiError(pay.error)}</Alert>}
        </Box>
      )}
      {invoice && <InvoiceDocument invoice={invoice} lang={lang} />}
    </Box>
  );
};
