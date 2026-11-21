import { useEffect, useState } from "react";
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { PrintOutlined } from "@mui/icons-material";
import type { AgreementDetail } from "@/api/agreement";
import { translate, type Lang, type MessageKey } from "@/i18n";
import { formatBDT, formatDate, toBnDigits } from "@/utils/format";

export type DeedBuilding = { name: string; address: string | null; holdingNumber: string | null } | null | undefined;

/**
 * Printable house-rent agreement (chukti-patra) in Bangla or English, filled from the agreement.
 * Standard clauses follow the DNCC guideline; the agreement's extra clauses are printed after them.
 * Used by the staff app and the tenant portal.
 */
export const AgreementDeed = ({ a, building, landlordName }: {
  a: Pick<AgreementDetail, "tenant" | "deposits" | "noticeDays" | "currentRate" | "bankOnly" | "dueDay" | "terms" | "unit" | "startDate" | "endDate">;
  building: DeedBuilding;
  landlordName: string;
}) => {
  const [lang, setLang] = useState<Lang>(a.tenant.lang === "EN" ? "en" : "bn");
  useEffect(() => setLang(a.tenant.lang === "EN" ? "en" : "bn"), [a.tenant.lang]);
  const t = (k: MessageKey, v?: Record<string, string | number>) => translate(lang, k, v);
  const n = (x: string | number) => (lang === "bn" ? toBnDigits(x) : String(x));
  const tenant = a.tenant;
  const received = a.deposits.filter((d) => d.type === "RECEIVED").reduce((s, d) => s + Number(d.amount), 0);
  const months = Math.round(a.noticeDays / 30);
  const rent = formatBDT(a.currentRate, lang);
  const standard = (["deed.c1", "deed.c2", "deed.c3", "deed.c4", "deed.c5", "deed.c6", "deed.c7", ...(a.bankOnly ? ["deed.c8"] : []), "deed.c9"] as MessageKey[])
    .map((k) => t(k, { rent, day: n(a.dueDay), months: n(months) }));
  const extra = a.terms?.clauses ?? [];
  const premises = a.unit ? [a.unit.name, a.unit.floorName, building?.name ?? a.unit.building.name, building?.address].filter(Boolean).join(", ") : "";

  const row = (k: MessageKey, v: string) => (
    <tr key={k}><td style={{ width: "36%" }}>{t(k)}</td><td>{v || " "}</td></tr>
  );

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, displayPrint: "none" }}>
        <ToggleButtonGroup exclusive size="small" value={lang} onChange={(_, v) => v && setLang(v)} aria-label="Language">
          <ToggleButton value="bn">বাংলা</ToggleButton>
          <ToggleButton value="en">English</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => window.print()}>{t("deed.print")}</Button>
        <Typography variant="body2" color="text.secondary">{t("deed.stampNote")}</Typography>
      </Stack>

      <Box
        lang={lang}
        sx={{
          bgcolor: "#fff", color: "#000", maxWidth: 800, mx: "auto", p: { xs: 2, sm: 5 }, border: 1, borderColor: "divider",
          "@media print": { border: 0, p: 0, maxWidth: "none" },
          fontSize: 14, lineHeight: 1.7,
          "& table": { width: "100%", borderCollapse: "collapse", mb: 2 },
          "& td": { border: "1px solid #999", p: "5px 8px", verticalAlign: "top" },
          "& h2": { fontSize: 15, fontWeight: 700, mt: 2.5, mb: 1 },
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: 22, textAlign: "center" }}>{t("deed.title")}</Typography>
        <Typography sx={{ textAlign: "center", mb: 2 }}>{t("deed.subtitle")}</Typography>
        <Typography sx={{ textAlign: "right", mb: 1 }}>{t("deed.date")}: {formatDate(a.startDate, lang)}</Typography>

        <h2>{t("deed.landlord")}</h2>
        <table><tbody>
          {row("deed.nameAddress", landlordName)}
          {row("deed.phone", "")}
        </tbody></table>

        <h2>{t("deed.tenant")}</h2>
        <table><tbody>
          {row("deed.nameAddress", [`${tenant.firstName} ${tenant.lastName}`, tenant.permanentAddress].filter(Boolean).join(", "))}
          {row("deed.nid", n(tenant.nid ?? ""))}
          {row("deed.phone", n(tenant.phone ?? ""))}
        </tbody></table>

        <h2>{t("deed.terms")}</h2>
        <table><tbody>
          {row("deed.premises", premises)}
          {row("deed.holding", n(building?.holdingNumber ?? ""))}
          {row("deed.rent", rent)}
          {row("deed.dueDay", t("deed.dueDayValue", { day: n(a.dueDay) }))}
          {row("deed.start", formatDate(a.startDate, lang))}
          {row("deed.end", a.endDate ? formatDate(a.endDate, lang) : t("deed.open"))}
          {row("deed.deposit", formatBDT(received, lang))}
          {row("deed.notice", t("deed.noticeValue", { months: n(months) }))}
        </tbody></table>

        <h2>{t("deed.clausesTitle")}</h2>
        <Box component="ol" sx={{ pl: 3, m: 0, "& li": { mb: 0.75 } }}>
          {[...standard, ...extra].map((c, i) => (
            <li key={i} value={i + 1} style={{ listStyle: lang === "bn" ? "none" : undefined }}>
              {lang === "bn" && <span>{toBnDigits(i + 1)}. </span>}{c}
            </li>
          ))}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, mt: 7 }}>
          {(["deed.signLandlord", "deed.signTenant"] as MessageKey[]).map((k) => (
            <Box key={k} sx={{ borderTop: "1px solid #000", pt: 0.5, textAlign: "center" }}>{t(k)}</Box>
          ))}
          {[1, 2].map((w) => (
            <Box key={w} sx={{ borderTop: "1px solid #000", pt: 0.5, mt: 3 }}>
              {t("deed.witness", { n: n(w) })}<br />{t("deed.nameAddress")}:
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};
