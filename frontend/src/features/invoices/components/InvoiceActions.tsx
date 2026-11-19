import { Button, Tooltip } from "@mui/material";
import { PrintOutlined, LinkOutlined, WhatsApp } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { invoiceApi } from "@/api/invoice";
import type { InvoiceDetail } from "@/types/invoice";
import { MONTH_NAMES } from "@/types/invoice";
import { formatBDT, apiError } from "@/utils/format";

/** BD mobile "01XXXXXXXXX" → "8801XXXXXXXXX" for wa.me; anything else is passed through as digits. */
const waNumber = (phone?: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.startsWith("01") && d.length === 11 ? `88${d}` : d;
};

export const shareLink = (token: string) => `${window.location.origin}/i/${token}`;

export const InvoiceActions = ({ invoice }: { invoice: InvoiceDetail }) => {
  const qc = useQueryClient();
  const share = useMutation({
    mutationFn: async () => invoice.shareToken ?? (await invoiceApi.share(invoice.id)).shareToken,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", invoice.id] }),
    onError: (e) => toast.error(apiError(e)),
  });

  const copyLink = async () => {
    const link = shareLink(await share.mutateAsync());
    await navigator.clipboard.writeText(link);
    toast.success("Invoice link copied — send it to your tenant");
  };

  const whatsapp = async () => {
    // open the tab synchronously so pop-up blockers allow it, then point it at wa.me
    const tab = window.open("", "_blank");
    const link = shareLink(await share.mutateAsync());
    const text =
      `Assalamu alaikum${invoice.tenant ? ` ${invoice.tenant.name}` : ""}. ` +
      `Your invoice ${invoice.invoiceNo} for ${MONTH_NAMES[invoice.month - 1]} ${invoice.year} (Flat ${invoice.flat.name}) ` +
      `is ready. Amount due: ${formatBDT(invoice.dueAmount)}. View: ${link}`;
    const url = `https://wa.me/${waNumber(invoice.tenant?.phone)}?text=${encodeURIComponent(text)}`;
    if (tab) tab.location.href = url;
    else window.location.href = url;
  };

  return (
    <>
      <Tooltip title="Copy a private link the tenant can open without logging in">
        <Button variant="outlined" startIcon={<LinkOutlined />} onClick={copyLink} disabled={share.isPending}>Copy link</Button>
      </Tooltip>
      <Button variant="outlined" color="success" startIcon={<WhatsApp />} onClick={whatsapp} disabled={share.isPending}>WhatsApp</Button>
      <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>Print / PDF</Button>
    </>
  );
};
