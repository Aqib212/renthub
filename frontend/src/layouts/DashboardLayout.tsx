import { Outlet } from "react-router-dom";
import { Box, AppBar, Toolbar, Typography, IconButton, Avatar, Menu, MenuItem, Tooltip } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api/client";
import { Sidebar } from "./Sidebar";
import toast from "react-hot-toast";

export const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper", displayPrint: "none" }}
        >
          <Toolbar>
            <Typography variant="body1" sx={{ flexGrow: 1, fontWeight: 600 }}>
              Welcome back, {user?.firstName}
            </Typography>

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
              <MenuItem onClick={() => navigate("/profile")}>Profile</MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3.5 }, bgcolor: "background.default", maxWidth: 1440, width: "100%", mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
