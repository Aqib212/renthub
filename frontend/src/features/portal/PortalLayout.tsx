import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppBar, BottomNavigation, BottomNavigationAction, Box, Button, Paper, ToggleButton, ToggleButtonGroup, Toolbar, Typography } from "@mui/material";
import { HomeOutlined, ReceiptLongOutlined, BuildOutlined, DescriptionOutlined } from "@mui/icons-material";
import { portalApi } from "@/api/portal";
import { usePortalStore } from "@/store/portalStore";
import { useT, useUiStore } from "@/i18n";
import { tokens } from "@/theme";

/** The tenant's data, shared by every portal page. */
export const usePortalHome = () => useQuery({ queryKey: ["portal", "home"], queryFn: portalApi.home });

/** Live tenancy first; pages that need one agreement use this unless the tenant picks another. */
export const useMainTenancy = () => {
  const { data } = usePortalHome();
  return data?.tenancies[0] ?? null;
};

export const monthLabel = (month: number, year: number, lang: "en" | "bn") =>
  new Date(year, month - 1, 1).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { month: "long", year: "numeric" });

const NAV = [
  { path: "/portal", label: "portal.nav.home", icon: <HomeOutlined /> },
  { path: "/portal/bills", label: "portal.nav.bills", icon: <ReceiptLongOutlined /> },
  { path: "/portal/repairs", label: "portal.nav.repairs", icon: <BuildOutlined /> },
  { path: "/portal/agreement", label: "portal.nav.me", icon: <DescriptionOutlined /> },
] as const;

/** Mobile-first shell for tenants: top bar, bottom navigation, installable as a PWA. */
export const PortalLayout = () => {
  // logged in on this device (the access token itself is refreshed from the cookie on demand)
  const token = usePortalStore((s) => s.phone);
  const logout = usePortalStore((s) => s.logout);
  const { t, lang } = useT();
  const setLang = useUiStore((s) => s.setLang);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data } = useQuery({ queryKey: ["portal", "home"], queryFn: portalApi.home, enabled: !!token });

  // first visit on this device: use the language the landlord set for the tenant
  useEffect(() => {
    if (!data) return;
    try {
      if (!localStorage.getItem("renthub-portal-lang")) {
        setLang(data.lang === "EN" ? "en" : "bn");
        localStorage.setItem("renthub-portal-lang", "1");
      }
    } catch { /* private mode: keep the current language */ }
  }, [data?.lang]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/portal" }).catch(() => {});
  }, []);

  if (!token) return <Navigate to="/portal/login" replace />;
  const current = [...NAV].reverse().find((n) => pathname === n.path || pathname.startsWith(n.path + "/"))?.path ?? "/portal";
  const orgName = data?.tenancies[0]?.org.name;

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", pb: "72px" }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: tokens.ink, displayPrint: "none" }}>
        <Toolbar sx={{ gap: 1, minHeight: 56 }}>
          <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 16 }} noWrap>{orgName ?? t("portal.brand")}</Typography>
          <ToggleButtonGroup exclusive size="small" value={lang} onChange={(_, v) => v && setLang(v)} aria-label={t("top.language")}
            sx={{ "& .MuiToggleButton-root": { color: "rgba(255,255,255,.75)", borderColor: "rgba(255,255,255,.3)", py: 0.25, px: 1 }, "& .Mui-selected": { color: "#fff !important", bgcolor: "rgba(255,255,255,.15) !important" } }}>
            <ToggleButton value="bn">বাংলা</ToggleButton>
            <ToggleButton value="en">EN</ToggleButton>
          </ToggleButtonGroup>
          <Button color="inherit" size="small" onClick={() => { portalApi.logout(); logout(); navigate("/portal/login"); }}>{t("portal.logout")}</Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ maxWidth: 640, mx: "auto", px: 2, py: 2 }}>
        <Outlet />
      </Box>
      <Paper elevation={8} sx={{ position: "fixed", left: 0, right: 0, bottom: 0, displayPrint: "none", pb: "env(safe-area-inset-bottom)" }}>
        <BottomNavigation showLabels value={current} onChange={(_, v) => navigate(v)}>
          {NAV.map((n) => <BottomNavigationAction key={n.path} value={n.path} label={t(n.label)} icon={n.icon} />)}
        </BottomNavigation>
      </Paper>
    </Box>
  );
};
