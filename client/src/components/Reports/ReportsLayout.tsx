import React from 'react';
import { Box, Paper, List, ListItem, ListItemIcon, ListItemText, Divider, Typography, Grid } from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Description as ContractIcon,
    Factory as ProductionIcon,
    PrecisionManufacturing as MachineIcon, // Machine
    Engineering as OperatorIcon, // Master
    ContentCut as ClippingIcon,
    LocalShipping as GatePassIcon,
    AttachMoney as BillingIcon
} from '@mui/icons-material';

interface ReportsLayoutProps {
    children: React.ReactNode;
    activeCategory: string;
    onCategoryChange: (category: string) => void;
}

const REPORT_CATEGORIES = [
    { id: 'executive', label: 'Executive Summary', icon: <DashboardIcon /> },
    { id: 'contracts', label: 'Contracts', icon: <ContractIcon /> },
    { id: 'production', label: 'Production', icon: <ProductionIcon /> },
    { id: 'machines', label: 'Machines', icon: <MachineIcon /> },
    { id: 'operators', label: 'Operators (Masters)', icon: <OperatorIcon /> },
    { id: 'clipping', label: 'Clipping', icon: <ClippingIcon /> },
    { id: 'gatepass', label: 'Gate Pass', icon: <GatePassIcon /> },
    { id: 'billing', label: 'Billing & Rates', icon: <BillingIcon /> },
];

const ReportsLayout: React.FC<ReportsLayoutProps> = ({ children, activeCategory, onCategoryChange }) => {
    return (
        <Box sx={{ flexGrow: 1, p: 3, height: '100%' }}>
            <Grid container spacing={3} sx={{ height: '100%' }}>
                {/* Sidebar */}
                <Grid item xs={12} md={2.5}>
                    <Paper elevation={2} sx={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
                        <Box p={2}>
                            <Typography variant="h6" fontWeight="bold" color="primary">Reports Hub</Typography>
                        </Box>
                        <Divider />
                        <List component="nav">
                            {REPORT_CATEGORIES.map((item) => (
                                <ListItem
                                    button
                                    key={item.id}
                                    selected={activeCategory === item.id}
                                    onClick={() => onCategoryChange(item.id)}
                                    sx={{
                                        '&.Mui-selected': { bgcolor: '#e3f2fd', borderRight: '3px solid #1976d2' },
                                        '&:hover': { bgcolor: '#f5f5f5' }
                                    }}
                                >
                                    <ListItemIcon sx={{ color: activeCategory === item.id ? '#1976d2' : 'inherit' }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: activeCategory === item.id ? 'bold' : 'medium' }} />
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>

                {/* Main Content */}
                <Grid item xs={12} md={9.5}>
                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {children}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ReportsLayout;
