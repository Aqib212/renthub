import { useParams } from "react-router-dom";
import { Box, Button, CircularProgress, Typography, Stack } from "@mui/material";
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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 2, sm: 5 }, px: { xs: 1.5, sm: 3 } }}>
      <InvoicePrintStyles />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ maxWidth: 794, mx: "auto", mb: 2, displayPrint: "none" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HomeWork color="primary" />
          <Typography sx={{ fontWeight: 700 }}>RentHub</Typography>
        </Stack>
        {invoice && <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>Print / Save PDF</Button>}
      </Stack>
      {isLoading && <Box sx={{ textAlign: "center", py: 10 }}><CircularProgress /></Box>}
      {error && (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6">Invoice not found</Typography>
          <Typography color="text.secondary">This link is invalid. Please ask your house owner for a new one.</Typography>
        </Box>
      )}
      {invoice && <InvoiceDocument invoice={invoice} />}
    </Box>
  );
};
