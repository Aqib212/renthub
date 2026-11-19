import { Alert, AlertTitle } from "@mui/material";
import { WarningAmberOutlined } from "@mui/icons-material";
import toast from "react-hot-toast";

/** Rent-rule warnings from the API (DNCC / Rent Act / NBR). They inform; nothing was blocked. */
export const WarningsAlert = ({ warnings }: { warnings: string[] }) =>
  warnings.length ? (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <AlertTitle>Check before you continue</AlertTitle>
      {warnings.map((w) => <div key={w}>{w}</div>)}
    </Alert>
  ) : null;

export const toastWarnings = (warnings: string[] | undefined) =>
  warnings?.forEach((w) => toast(w, { icon: <WarningAmberOutlined fontSize="small" sx={{ color: "#8A5200" }} />, duration: 7000 }));
