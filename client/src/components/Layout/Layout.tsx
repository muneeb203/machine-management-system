import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Assignment,
  PrecisionManufacturing,
  AttachMoney,
  Inventory2,
  Assessment,
  AdminPanelSettings,
  Logout,
  People,
  MonetizationOn,
  Settings,
  Engineering,
  Schedule,
  FactCheck,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Role-based menu items according to specifications
  const getMenuItems = () => {
    const baseItems = [
      { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard', roles: ['admin', 'operator', 'programmer'] },
    ];

    const moduleItems = [
      // Contract Management Module
      {
        text: 'Contract Management',
        icon: <Assignment />,
        path: '/contracts',
        roles: ['admin', 'operator'],
        adminAccess: 'Create, edit, approve, close contracts',
        operatorAccess: 'View-only active contracts'
      },

      // Machine Management Module
      {
        text: 'Machine Management',
        icon: <PrecisionManufacturing />,
        path: '/machines',
        roles: ['admin', 'operator'],
        adminAccess: 'Add/edit machines and status',
        operatorAccess: 'View machine list'
      },

      // Daily Production Entry Module
      {
        text: 'Daily Production',
        icon: <Engineering />,
        path: '/production',
        roles: ['admin', 'operator'],
        adminAccess: 'Edit entries, approve backdated data',
        operatorAccess: 'Enter same-day production only'
      },

      // Billing Automation Module
      {
        text: 'Billing & Invoicing',
        icon: <AttachMoney />,
        path: '/billing',
        roles: ['admin', 'operator'],
        adminAccess: 'Approve, export billing',
        operatorAccess: 'View-only summaries'
      },

      // Gate Pass & Inventory Module
      {
        text: 'Gate Pass & Inventory',
        icon: <Inventory2 />,
        path: '/gate-passes',
        roles: ['admin', 'operator'],
        adminAccess: 'Create/finalize gate passes',
        operatorAccess: 'View-only'
      },

      // Reports & Dashboard Module
      {
        text: 'Reports & Analytics',
        icon: <Assessment />,
        path: '/reports',
        roles: ['admin', 'operator'],
        adminAccess: 'Full reporting & exports',
        operatorAccess: 'Limited dashboards'
      },
    ];

    // Admin-only modules
    const adminItems = [
      { text: 'Rate & Pricing', icon: <MonetizationOn />, path: '/admin/rates', roles: ['admin'] },
      { text: 'User Management', icon: <People />, path: '/admin/users', roles: ['admin'] },
      { text: 'System Admin', icon: <AdminPanelSettings />, path: '/admin', roles: ['admin'] },
    ];

    // Programmer-specific items
    const programmerItems = [
      { text: 'Programmer Scheduling', icon: <Schedule />, path: '/programming', roles: ['admin', 'programmer'] },
    ];

    const allItems = [...baseItems, ...moduleItems];

    if (user?.role === 'admin') {
      allItems.push(...adminItems, ...programmerItems);
    } else if (user?.role === 'programmer') {
      allItems.push(...programmerItems);
    }

    return allItems.filter(item => item.roles.includes(user?.role || ''));
  };

  const menuItems = getMenuItems();

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'operator': return 'primary';
      case 'programmer': return 'secondary';
      default: return 'default';
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
            Embroidery ERP
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Production Management System
          </Typography>
        </Box>
      </Toolbar>

      <Divider />

      {/* User Info */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {user?.username}
        </Typography>
        <Chip
          label={user?.role?.toUpperCase()}
          size="small"
          color={getRoleColor(user?.role || '')}
          sx={{ mt: 1 }}
        />
      </Box>

      <Divider />

      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontSize: '0.9rem' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mt: 2 }} />

      {/* Role-based access info */}
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold' }}>
          Access Level: {user?.role === 'admin' ? 'Full System Control' :
            user?.role === 'operator' ? 'Production Operations' :
              'Programming & Scheduling'}
        </Typography>
      </Box>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Embroidery Factory ERP'}
          </Typography>

          {/* Current date and time */}
          <Typography variant="body2" sx={{ mr: 2 }}>
            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
          </Typography>

          <Button
            color="inherit"
            onClick={logout}
            startIcon={<Logout />}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;