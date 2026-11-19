import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { LinkOutlined, PrintOutlined } from "@mui/icons-material";
import toast from "react-hot-toast";
import { receiptApi, receiptLink } from "@/api/collections";
import { useT, type Lang } from "@/i18n";
import { apiError } from "@/utils/format";
import { ReceiptDocument } from "./ReceiptDocument";

/** Owner's view of one receipt: print it or copy the tenant's link. */
export const ReceiptViewPage = () => {
  const { id } = useParams();
  const { t } = useT();
  const { data: r } = useQuery({ queryKey: ["receipt", id], queryFn: () => receiptApi.get(id!) });
  const [lang, setLang] = useState<Lang | null>(null);

  if (!r) return <Typography>{t("common.loading")}</Typography>;
  const docLang: Lang = lang ?? (r.lang === "EN" ? "en" : "bn");

  const copy = async () => {
    try {
      const { shareToken } = await receiptApi.share(r.id);
      await navigator.clipboard.writeText(receiptLink(shareToken));
      toast.success(t("common.linkCopied"));
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2, displayPrint: "none" }}>
        <ToggleButtonGroup exclusive size="small" value={docLang} onChange={(_, v) => v && setLang(v)} aria-label="Receipt language">
          <ToggleButton value="bn">বাংলা</ToggleButton>
          <ToggleButton value="en">English</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<LinkOutlined />} onClick={copy}>{t("common.copyLink")}</Button>
          <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>{t("common.print")}</Button>
        </Stack>
      </Stack>
      <ReceiptDocument receipt={r} lang={docLang} />
    </Box>
  );
};
