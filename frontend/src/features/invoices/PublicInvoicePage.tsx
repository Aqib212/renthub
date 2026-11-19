import { useParams } from "react-router-dom";
import { useState } from "react";
import { Box, Button, CircularProgress, Typography, Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { translate, type Lang } from "@/i18n";
import { PrintOutlined, HomeWork } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
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
      {invoice && <InvoiceDocument invoice={invoice} lang={lang} />}
    </Box>
  );
};
