import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { PrintOutlined } from "@mui/icons-material";
import { receiptApi } from "@/api/collections";
import { translate, type Lang } from "@/i18n";
import { ReceiptDocument } from "./ReceiptDocument";

/** What the tenant opens from the receipt SMS. No login; Bangla unless they chose English. */
export const PublicReceiptPage = () => {
  const { token = "" } = useParams();
  const { data: r, isLoading, error } = useQuery({ queryKey: ["public-receipt", token], queryFn: () => receiptApi.getShared(token), retry: false });
  const [chosen, setChosen] = useState<Lang | null>(null);
  const lang: Lang = chosen ?? (r?.lang === "EN" ? "en" : "bn");

  return (
    <Box lang={lang} sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 2, sm: 5 }, px: { xs: 1.5, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ maxWidth: 620, mx: "auto", mb: 2, displayPrint: "none" }}>
        <Typography sx={{ fontFamily: "Manrope, sans-serif", fontWeight: 800 }}>RentHub</Typography>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup exclusive size="small" value={lang} onChange={(_, v) => v && setChosen(v)} aria-label="Language">
            <ToggleButton value="bn">বাংলা</ToggleButton>
            <ToggleButton value="en">English</ToggleButton>
          </ToggleButtonGroup>
          {r && <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>{translate(lang, "common.print")}</Button>}
        </Stack>
      </Stack>
      {isLoading && <Box sx={{ textAlign: "center", py: 10 }}><CircularProgress /></Box>}
      {error && (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6">{translate(lang, "rcp.notFound")}</Typography>
          <Typography color="text.secondary">{translate(lang, "inv.badLink")}</Typography>
        </Box>
      )}
      {r && <ReceiptDocument receipt={r} lang={lang} />}
    </Box>
  );
};
