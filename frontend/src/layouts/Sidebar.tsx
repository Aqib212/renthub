import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Typography, ButtonBase, Menu, MenuItem } from "@mui/material";
import {
  SpaceDashboardOutlined,
  BusinessOutlined,
  LayersOutlined,
  ApartmentOutlined,
  PeopleOutline,
  ReceiptLongOutlined,
  PaymentsOutlined,
  AccountBalanceWalletOutlined,
  AssessmentOutlined,
  TuneOutlined,
  EditCalendarOutlined,
  BadgeOutlined,
  GridViewOutlined,
  HandshakeOutlined, BuildOutlined, HistoryOutlined, LocalTaxiOutlined, TodayOutlined, EventNoteOutlined,
  SettingsOutlined,
  SavingsOutlined,
  SmsOutlined,
  UnfoldMore,
  Check,
} from "@mui/icons-material";
import { useAuthStore, useCurrentMembership } from "@/store/authStore";
import type { OrgRole } from "@/types";
import { tokens } from "@/theme";
import { useT, type MessageKey } from "@/i18n";

export const DRAWER_WIDTH = 256;

type NavItem = { label: MessageKey; icon: JSX.Element; path: string; roles?: OrgRole[] };

// Groups follow the mockups. `roles` hides items a role can't use (the API enforces it too). Labels are i18n keys.
const groups: { label: MessageKey; items: NavItem[] }[] = [
  { label: "nav.overview", items: [{ label: "nav.dashboard", icon: <SpaceDashboardOutlined />, path: "/dashboard" }] },
  {
    label: "nav.property",
    items: [
      { label: "nav.buildings", icon: <BusinessOutlined />, path: "/buildings" },
      { label: "nav.unitsBoard", icon: <GridViewOutlined />, path: "/units" },
      { label: "nav.floors", icon: <LayersOutlined />, path: "/floors" },
      { label: "nav.unitsList", icon: <ApartmentOutlined />, path: "/flats" },
      { label: "nav.tenants", icon: <PeopleOutline />, path: "/tenants" },
      { label: "nav.agreements", icon: <HandshakeOutlined />, path: "/agreements" },
      { label: "nav.maintenance", icon: <BuildOutlined />, path: "/maintenance" },
    ],
  },
  {
    label: "nav.fleet",
    items: [
      { label: "nav.vehicles", icon: <LocalTaxiOutlined />, path: "/vehicles" },
      { label: "nav.jama", icon: <TodayOutlined />, path: "/jama" },
      { label: "nav.bookings", icon: <EventNoteOutlined />, path: "/bookings" },
    ],
  },
  {
    label: "nav.billing",
    items: [
      { label: "nav.monthlyBilling", icon: <EditCalendarOutlined />, path: "/billing" },
      { label: "nav.invoices", icon: <ReceiptLongOutlined />, path: "/invoices" },
      { label: "nav.billTypes", icon: <TuneOutlined />, path: "/bill-types" },
    ],
  },
  {
    label: "nav.money",
    items: [
      { label: "nav.collections", icon: <PaymentsOutlined />, path: "/payments" },
      { label: "nav.cashHandover", icon: <SavingsOutlined />, path: "/cash-handover" },
      { label: "nav.expenses", icon: <AccountBalanceWalletOutlined />, path: "/expenses" },
      { label: "nav.reports", icon: <AssessmentOutlined />, path: "/reports", roles: ["OWNER", "MANAGER", "ACCOUNTANT"] },
    ],
  },
  {
    label: "nav.admin",
    items: [
      { label: "nav.messages", icon: <SmsOutlined />, path: "/messages", roles: ["OWNER", "MANAGER", "ACCOUNTANT"] },
      { label: "nav.staff", icon: <BadgeOutlined />, path: "/staff", roles: ["OWNER"] },
      { label: "nav.activity", icon: <HistoryOutlined />, path: "/activity", roles: ["OWNER"] },
      { label: "nav.settings", icon: <SettingsOutlined />, path: "/settings", roles: ["OWNER"] },
    ],
  },
];

/** Shows the workspace in use; with more than one membership it switches between them. */
const OrgSwitcher = () => {
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const current = useCurrentMembership();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const many = (user?.memberships?.length ?? 0) > 1;

  return (
    <>
      <ButtonBase
        onClick={(e) => many && setAnchor(e.currentTarget)}
        aria-haspopup={many ? "menu" : undefined}
        aria-label={many ? "Switch organisation" : undefined}
        sx={{ display: "flex", alignItems: "center", gap: 1, textAlign: "left", bgcolor: tokens.inkRaised, border: `1px solid ${tokens.inkBorder}`, borderRadius: "10px", px: 1.5, py: 1.25, minHeight: 48, cursor: many ? "pointer" : "default" }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }}>{current?.orgName ?? (user ? `${user.firstName} ${user.lastName}` : "RentHub")}</Typography>
          <Typography sx={{ fontSize: 12, color: "#9DB5AA" }}>{current ? t(`role.${current.role}`) : ""}</Typography>
        </Box>
        {many && <UnfoldMore sx={{ fontSize: 18, color: "#9DB5AA" }} />}
      </ButtonBase>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {user?.memberships?.map((m) => (
          <MenuItem
            key={m.orgId}
            selected={m.orgId === current?.orgId}
            onClick={() => {
              setAnchor(null);
              if (m.orgId === current?.orgId) return;
              setCurrentOrg(m.orgId);
              qc.clear(); // cached data belongs to the previous workspace
              navigate("/dashboard");
            }}
          >
            <Box sx={{ flex: 1, pr: 2 }}>
              <Typography fontWeight={600} fontSize={14}>{m.orgName}</Typography>
              <Typography variant="caption" color="text.secondary">{t(`role.${m.role}`)}</Typography>
            </Box>
            {m.orgId === current?.orgId && <Check fontSize="small" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const membership = useCurrentMembership();
  const role = membership?.role;
  const visible = groups
    // staff limited to some buildings see no vehicles (the API hides them too)
    .filter((g) => !(membership?.limited && g.label === "nav.fleet"))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (role && i.roles.includes(role))) }))
    .filter((g) => g.items.length);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1, bgcolor: tokens.ink, color: "#fff", px: 1.5, py: 2.5 }}>
      <ButtonBase
        onClick={() => { navigate("/dashboard"); onNavigate?.(); }}
        sx={{ justifyContent: "flex-start", gap: 1.25, px: 1.25, pb: 1.25, borderRadius: 2 }}
      >
        <Box sx={{ width: 34, height: 34, borderRadius: "9px", bgcolor: tokens.marigold, color: tokens.ink, display: "grid", placeItems: "center", font: "800 17px Manrope, sans-serif" }}>
          R
        </Box>
        <Typography sx={{ font: "800 19px Manrope, sans-serif" }}>RentHub</Typography>
      </ButtonBase>

      <OrgSwitcher />

      <Box component="nav" aria-label="Main" sx={{ overflowY: "auto", flex: 1 }}>
        {visible.map((g) => (
          <List key={g.label} dense disablePadding sx={{ mb: 0.5 }}>
            <Typography component="div" sx={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.inkMuted, px: 1.5, pt: 1.25, pb: 0.5 }}>
              {t(g.label)}
            </Typography>
            {g.items.map((item) => {
              const selected = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <ListItemButton
                  key={item.path}
                  selected={selected}
                  onClick={() => { navigate(item.path); onNavigate?.(); }}
                  sx={{
                    minHeight: 44,
                    borderRadius: "8px",
                    color: tokens.inkText,
                    "&:hover": { bgcolor: tokens.inkRaised, color: "#fff" },
                    "& .MuiListItemIcon-root": { color: "inherit" },
                    "&.Mui-selected, &.Mui-selected:hover": { bgcolor: tokens.marigold, color: tokens.ink },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34, "& svg": { fontSize: 19 } }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={t(item.label)} primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 600 : 400 }} />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>
    </Box>
  );
};

/** Permanent sidebar on desktop; a temporary drawer opened from the top bar below `md`. */
export const Sidebar = ({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) => {
  const paper = { width: DRAWER_WIDTH, boxSizing: "border-box" as const, border: 0, bgcolor: tokens.ink };
  return (
    <Box sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0, displayPrint: "none" }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": paper }}
      >
        <SidebarContent onNavigate={onClose} />
      </Drawer>
      <Drawer variant="permanent" open sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": paper }}>
        <SidebarContent />
      </Drawer>
    </Box>
  );
};
