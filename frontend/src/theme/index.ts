import { createTheme, alpha } from "@mui/material/styles";

/** "Sabuj Ledger" tokens, matching the approved mockups. */
export const tokens = {
  green: "#0B5D46",
  greenDark: "#08402F",
  marigold: "#E8A317",
  ink: "#10231C",
  inkRaised: "#1A3329",
  inkBorder: "#2A4A3D",
  inkText: "#C7D6CF",
  inkMuted: "#8FA89C",
  paper: "#F4F5F2",
  text: "#15211C",
  muted: "#55615B",
  border: "#DDE2DE",
  rowLine: "#EEF1EF",
  inputBorder: "#C9D2CC",
};

/** Status chip colours (background / text), as in the mockups. */
export const CHIP = {
  ok: { bg: "#E3F0EA", fg: "#0B5D46" },
  warning: { bg: "#FBEFD9", fg: "#8A5200" },
  error: { bg: "#FDECEA", fg: "#B42318" },
  info: { bg: "#E6EEFF", fg: "#1D4ED8" },
  muted: { bg: "#EEF1EF", fg: "#55615B" },
} as const;

const heading = '"Manrope", "Hind Siliguri", sans-serif';

export const theme = createTheme({
  palette: {
    primary: { main: tokens.green, dark: tokens.greenDark, light: "#2F7D64", contrastText: "#fff" },
    secondary: { main: tokens.marigold, contrastText: tokens.ink },
    success: { main: CHIP.ok.fg },
    warning: { main: "#B26A00" },
    error: { main: CHIP.error.fg },
    info: { main: CHIP.info.fg },
    text: { primary: tokens.text, secondary: tokens.muted },
    divider: tokens.border,
    background: { default: tokens.paper, paper: "#ffffff" },
  },
  typography: {
    fontFamily: '"Hind Siliguri", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: heading, fontWeight: 800 },
    h2: { fontFamily: heading, fontWeight: 800 },
    h3: { fontFamily: heading, fontWeight: 800 },
    h4: { fontFamily: heading, fontWeight: 800, letterSpacing: "-0.01em" },
    h5: { fontFamily: heading, fontWeight: 700 },
    h6: { fontFamily: heading, fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", borderRadius: 10, minHeight: 40 }, outlined: { borderColor: tokens.inputBorder } },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", fullWidth: true },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 10 }, notchedOutline: { borderColor: tokens.inputBorder } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" }, outlined: { borderColor: tokens.border } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: 14, borderColor: tokens.border } },
    },
    MuiTableContainer: {
      styleOverrides: { root: { border: `1px solid ${tokens.border}`, borderRadius: 14, backgroundColor: "#fff" } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            color: tokens.muted,
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            borderBottomColor: tokens.border,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: { root: { borderColor: tokens.rowLine } },
    },
    MuiTableRow: {
      styleOverrides: { root: { "&.MuiTableRow-hover:hover": { backgroundColor: alpha(tokens.green, 0.03) } } },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 999 },
        // tinted chips like the mockups instead of solid fills
        colorSuccess: { backgroundColor: CHIP.ok.bg, color: CHIP.ok.fg },
        colorWarning: { backgroundColor: CHIP.warning.bg, color: CHIP.warning.fg },
        colorError: { backgroundColor: CHIP.error.bg, color: CHIP.error.fg },
        colorInfo: { backgroundColor: CHIP.info.bg, color: CHIP.info.fg },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 14 } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontFamily: heading, fontWeight: 700, fontSize: 18 } },
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
