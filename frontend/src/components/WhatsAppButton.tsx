import { useState } from "react";
import { Button, IconButton, Tooltip } from "@mui/material";
import { WhatsApp } from "@mui/icons-material";
import toast from "react-hot-toast";
import client from "@/api/client";
import { apiError } from "@/utils/format";

/**
 * "Send on WhatsApp": opens wa.me with the same text the SMS would carry (free; staff send it from their own phone).
 * `path` is the share-text endpoint, e.g. /invoices/12/share-text or /payments/34/share-text.
 */
export const WhatsAppButton = ({ path, icon, disabled }: { path: string; icon?: boolean; disabled?: boolean }) => {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    // open the tab first (inside the click), then point it at wa.me: popup blockers allow that
    const tab = window.open("", "_blank");
    setBusy(true);
    try {
      const { phone, text } = (await client.get(path)).data.data as { phone: string | null; text: string };
      const url = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) {
      tab?.close();
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return icon ? (
    <Tooltip title="Send on WhatsApp">
      <span>
        <IconButton size="small" aria-label="Send on WhatsApp" onClick={open} disabled={busy || disabled} sx={{ color: "#128C7E" }}><WhatsApp fontSize="small" /></IconButton>
      </span>
    </Tooltip>
  ) : (
    <Button startIcon={<WhatsApp />} onClick={open} disabled={busy || disabled} sx={{ color: "#128C7E" }}>WhatsApp</Button>
  );
};
