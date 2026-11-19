import { useLocation, useNavigate } from "react-router-dom";
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Typography, ListSubheader } from "@mui/material";
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
  HomeWork,
} from "@mui/icons-material";

export const DRAWER_WIDTH = 248;

const groups = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", icon: <SpaceDashboardOutlined />, path: "/dashboard" }],
  },
  {
    label: "Billing",
    items: [
      { label: "Monthly Billing", icon: <EditCalendarOutlined />, path: "/billing" },
      { label: "Invoices", icon: <ReceiptLongOutlined />, path: "/invoices" },
      { label: "Payments", icon: <PaymentsOutlined />, path: "/payments" },
      { label: "Bill Types", icon: <TuneOutlined />, path: "/bill-types" },
    ],
  },
  {
    label: "Property",
    items: [
      { label: "Buildings", icon: <BusinessOutlined />, path: "/buildings" },
      { label: "Floors", icon: <LayersOutlined />, path: "/floors" },
      { label: "Flats", icon: <ApartmentOutlined />, path: "/flats" },
      { label: "Tenants", icon: <PeopleOutline />, path: "/tenants" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Expenses", icon: <AccountBalanceWalletOutlined />, path: "/expenses" },
      { label: "Reports", icon: <AssessmentOutlined />, path: "/reports" },
    ],
  },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        displayPrint: "none",
        "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", borderRight: "1px solid", borderColor: "divider" },
      }}
    >
      <Box sx={{ px: 2.5, py: 2.25, display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: "primary.main", color: "#fff", display: "grid", placeItems: "center" }}>
          <HomeWork fontSize="small" />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.1 }}>RentHub</Typography>
          <Typography variant="caption" color="text.secondary">Rent & bills in one place</Typography>
        </Box>
      </Box>

      <Box sx={{ overflowY: "auto", pb: 2 }}>
        {groups.map((g) => (
          <List
            key={g.label}
            dense
            sx={{ px: 1.5, py: 0.5 }}
            subheader={
              <ListSubheader disableSticky sx={{ lineHeight: "32px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", bgcolor: "transparent" }}>
                {g.label}
              </ListSubheader>
            }
          >
            {g.items.map((item) => {
              const selected = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <ListItemButton
                  key={item.path}
                  selected={selected}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.25,
                    py: 0.9,
                    color: "text.primary",
                    "&.Mui-selected": {
                      bgcolor: "rgba(15,118,110,0.09)",
                      color: "primary.dark",
                      "&:hover": { bgcolor: "rgba(15,118,110,0.14)" },
                      "& .MuiListItemIcon-root": { color: "primary.main" },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: "text.secondary", "& svg": { fontSize: 20 } }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 600 : 500 }} />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>
    </Drawer>
  );
};
