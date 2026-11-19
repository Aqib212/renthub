import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Skeleton, Alert, Stack } from "@mui/material";
import { ArrowBack, EditOutlined, PaymentsOutlined } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { invoiceApi } from "@/api/invoice";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaymentFormDialog } from "@/features/payments/components/PaymentFormDialog";
import { InvoiceDocument, InvoicePrintStyles } from "./components/InvoiceDocument";
import { InvoiceActions } from "./components/InvoiceActions";
import { InvoiceEditDialog } from "./components/InvoiceEditDialog";

export const InvoiceViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const invoiceId = Number(id);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => invoiceApi.getById(invoiceId),
  });

  return (
    <Box>
      <InvoicePrintStyles />
      <Box sx={{ displayPrint: "none" }}>
        <PageHeader
          title={invoice ? invoice.invoiceNo : "Invoice"}
          subtitle={invoice ? `${invoice.tenant?.name ?? "No tenant"} · Flat ${invoice.flat.name}` : undefined}
          actions={
            <>
              <Button startIcon={<ArrowBack />} onClick={() => navigate("/invoices")}>Back</Button>
              {invoice && (
                <>
                  <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>
                  {!invoice.carriedForward && invoice.dueAmount > 0 && (
                    <Button variant="outlined" startIcon={<PaymentsOutlined />} onClick={() => setPayOpen(true)}>Record payment</Button>
                  )}
                  <InvoiceActions invoice={invoice} />
                </>
              )}
            </>
          }
        />
      </Box>

      {isLoading && <Skeleton variant="rounded" height={900} sx={{ maxWidth: 794, mx: "auto" }} />}
      {error && <Alert severity="error">Invoice not found.</Alert>}
      {invoice && (
        <Stack alignItems="center">
          <InvoiceDocument invoice={invoice} />
        </Stack>
      )}

      {invoice && editOpen && <InvoiceEditDialog invoice={invoice} onClose={() => setEditOpen(false)} />}
      <PaymentFormDialog open={payOpen} onClose={() => setPayOpen(false)} preselectedInvoiceId={invoiceId} />
    </Box>
  );
};
