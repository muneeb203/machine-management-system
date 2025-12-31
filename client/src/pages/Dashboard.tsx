import React from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
} from '@mui/material';
import {
  PrecisionManufacturing,
  Assignment,
  AttachMoney,
  Inventory,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import axios from 'axios';

// Simple axios instance for API calls
const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface DashboardStats {
  totalMachines: number;
  activeMachines: number;
  todayProduction: number;
  pendingBilling: number;
  activeContracts: number;
}

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="overline">
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value.toLocaleString()}
          </Typography>
        </Box>
        <Box sx={{ color, fontSize: 40 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const { data: stats, isLoading } = useQuery<DashboardStats>(
    'dashboard-stats',
    async () => {
      const response = await api.get('/api/reports/dashboard');
      return response.data.data;
    }
  );

  if (isLoading) {
    return <Typography>Loading dashboard...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Machines"
            value={stats?.activeMachines || 0}
            icon={<PrecisionManufacturing />}
            color="#1976d2"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Contracts"
            value={stats?.activeContracts || 0}
            icon={<Assignment />}
            color="#2e7d32"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Today's Production"
            value={stats?.todayProduction || 0}
            icon={<Inventory />}
            color="#ed6c02"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Billing"
            value={stats?.pendingBilling || 0}
            icon={<AttachMoney />}
            color="#d32f2f"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Typography color="textSecondary">
              Production tracking and billing updates will appear here.
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography color="textSecondary">
              Common tasks and shortcuts will be available here.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;