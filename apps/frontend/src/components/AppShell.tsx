import { useState, type ReactNode } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import GroupIcon from "@mui/icons-material/Group";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", to: "/", icon: <DashboardIcon /> },
  { label: "Bills", to: "/bills", icon: <ReceiptLongIcon /> },
  { label: "Vendors", to: "/vendors", icon: <StorefrontIcon /> },
  { label: "Team", to: "/team", icon: <GroupIcon />, adminOnly: true },
  { label: "Activity", to: "/activity", icon: <HistoryIcon />, adminOnly: true },
  { label: "Settings", to: "/settings", icon: <SettingsIcon />, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          Payables
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => (
          <ListItemButton
            key={item.to}
            component={Link}
            to={item.to}
            selected={location.pathname === item.to}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Avatar sx={{ width: 32, height: 32 }}>
            {user?.name?.charAt(0).toUpperCase() ?? "?"}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {user?.email}
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={logout}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      {/* Mobile top bar with the hamburger toggle. */}
      <AppBar
        position="fixed"
        sx={{ display: { md: "none" }, zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Payables
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        aria-label="Main navigation"
      >
        {/* Temporary drawer on mobile. */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>
        {/* Permanent sidebar on md+. */}
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        {/* Spacer to clear the mobile AppBar. */}
        <Toolbar sx={{ display: { md: "none" } }} />
        <Box sx={{ p: { xs: 2, md: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
