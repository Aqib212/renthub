import { Navigate, Outlet } from "react-router-dom";
import { Alert, Box, AppBar, Button, Toolbar, Typography, IconButton, Avatar, Menu, MenuItem, Tooltip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useT, useUiStore } from "@/i18n";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api/client";
import { Sidebar } from "./Sidebar";
import { Menu as MenuIcon } from "@mui/icons-material";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

export const DashboardLayout = () => {
  const { user, logout, setUser, support, endSupport } = useAuthStore();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const setLang = useUiStore((s) => s.setLang);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // refresh workspace memberships once per load (sessions saved before phase 1 have none)
  useEffect(() => {
    if (support) return; // the support view must not overwrite the super-admin's own profile
    authApi.getProfile().then((r) => setUser(r.data.data)).catch(() => {});
  }, [setUser, support]);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // proceed with logout even if API fails
    }
    logout();
    toast.success("Logged out");
    navigate("/login");
  };

  // the platform super-admin has no workspace of their own: the console is home
  if (user?.role === "SUPER_ADMIN" && !support && !user.memberships?.length) return <Navigate to="/admin" replace />;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper", displayPrint: "none" }}
        >
          <Toolbar>
            <IconButton edge="start" aria-label="Open menu" onClick={() => setMobileOpen(true)} sx={{ mr: 1, display: { md: "none" } }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="body1" sx={{ flexGrow: 1, fontWeight: 600 }}>
              {t("top.welcome", { name: user?.firstName ?? "" })}
            </Typography>

            <ToggleButtonGroup
              exclusive size="small" value={lang} onChange={(_, v) => v && setLang(v)}
              aria-label={t("top.language")} sx={{ mr: 1.5, "& .MuiToggleButton-root": { px: 1.25, py: 0.25 } }}
            >
              <ToggleButton value="bn" lang="bn">বাংলা</ToggleButton>
              <ToggleButton value="en" lang="en">EN</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Account">
              <IconButton onClick={handleMenu} size="small">
                <Avatar
                  src={user?.avatar || undefined}
                  sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 14 }}
                >
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              onClick={handleClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
              <MenuItem onClick={() => navigate("/profile")}>{t("top.profile")}</MenuItem>
              <MenuItem onClick={handleLogout}>{t("top.logout")}</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        {support && (
          <Alert
            severity="warning" variant="filled" square
            sx={{ position: "sticky", top: 64, zIndex: 2, displayPrint: "none", "& .MuiAlert-message": { flexGrow: 1 } }}
            action={<Button color="inherit" size="small" onClick={() => { endSupport(); qc.clear(); navigate("/admin"); }}>Exit</Button>}
          >
            Support view of <b>{support.orgName}</b>: read-only, logged in the owner&apos;s Activity.
          </Alert>
        )}

        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3.5 }, bgcolor: "background.default", maxWidth: 1440, width: "100%", mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
