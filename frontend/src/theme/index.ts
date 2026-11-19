import { createTheme, alpha } from "@mui/material/styles";

const slate = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  500: "#64748b",
  700: "#334155",
  900: "#0f172a",
};

export const theme = createTheme({
  palette: {
    primary: { main: "#0f766e", light: "#14b8a6", dark: "#115e59", contrastText: "#fff" },
    secondary: { main: "#4f46e5", light: "#818cf8", dark: "#3730a3" },
    success: { main: "#16a34a" },
    warning: { main: "#d97706" },
    error: { main: "#dc2626" },
    info: { main: "#2563eb" },
    text: { primary: slate[900], secondary: slate[500] },
    divider: slate[200],
    background: { default: slate[50], paper: "#ffffff" },
    grey: slate as any,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", borderRadius: 8 } },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", fullWidth: true },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" }, outlined: { borderColor: slate[200] } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: 12, borderColor: slate[200] } },
    },
    MuiTableContainer: {
      styleOverrides: { root: { border: `1px solid ${slate[200]}`, borderRadius: 12 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: slate[50],
            color: slate[500],
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: { root: { borderColor: slate[100] } },
    },
    MuiTableRow: {
      styleOverrides: { root: { "&.MuiTableRow-hover:hover": { backgroundColor: alpha("#0f766e", 0.03) } } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 14 } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 700, fontSize: 18 } },
    },
  },
});

/** Invoice status → palette colour key + label. */
export const INVOICE_STATUS: Record<string, { color: "warning" | "success" | "info" | "error"; label: string }> = {
  PENDING: { color: "warning", label: "Pending" },
  PAID: { color: "success", label: "Paid" },
  PARTIALLY_PAID: { color: "info", label: "Partial" },
  OVERDUE: { color: "error", label: "Overdue" },
};
