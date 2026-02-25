import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import {
  Grid,
  Box,
  Typography,
  Button,
  Container,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import api from '../apiClient';

// Components
import { KPICard } from '../components/Analytics/KPICard';
import { SimpleLineChart, SimpleBarChart, SimplePieChart } from '../components/Analytics/Charts';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import ContractSnapshot from '../components/Dashboard/ContractSnapshot';
import QuickActions from '../components/Dashboard/QuickActions';

// Icons for KPIs
import {
  PrecisionManufacturing,
  Assignment,
  Inventory,
  AttachMoney,
  Speed,
  AccessTime
} from '@mui/icons-material';

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // 1. Fetch KPIs
  const { data: kpis, refetch: refetchKpis, isLoading: kpiLoading } = useQuery('dashboard-kpis', async () => {
    const res = await api.get('/api/dashboard/kpis');
    return res.data;
  }, { refetchInterval: 60000 }); // Auto-refresh every 60s

  // 2. Fetch Production Trend
  const { data: trendData, refetch: refetchTrend } = useQuery('dashboard-trend', async () => {
    const res = await api.get('/api/dashboard/production-trend');
    // Format for charts if needed, but endpoint returns standard array
    return res.data;
  });

  // 3. Fetch Machine Stats
  const { data: machineStats, refetch: refetchMachines } = useQuery('dashboard-machines', async () => {
    const res = await api.get('/api/dashboard/machine-stats');
    return res.data;
  });

  // 4. Fetch Contract Progress
  const { data: contracts, refetch: refetchContracts } = useQuery('dashboard-contracts', async () => {
    const res = await api.get('/api/dashboard/contract-progress');
    return res.data;
  });

  // 5. Fetch Activity
  const { data: activity, refetch: refetchActivity } = useQuery('dashboard-activity', async () => {
    const res = await api.get('/api/dashboard/recent-activity');
    return res.data;
  });

  const handleRefresh = () => {
    refetchKpis();
    refetchTrend();
    refetchMachines();
    refetchContracts();
    refetchActivity();
    setLastRefreshed(new Date());
  };

  // Transform Trend Data for Charts
  // Stacked Bar needs: name, Morning, Night
  const shiftChartData = trendData?.map((d: any) => ({
    name: new Date(d.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
    Morning: d.morning,
    Night: d.night
  })) || [];

  // Line Chart: Total Stitches
  const lineChartData = trendData?.map((d: any) => ({
    name: new Date(d.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
    Stitches: d.total
  })) || [];

  // Machine Bar Data
  const machineBarData = machineStats?.topMachines?.map((m: any) => ({
    name: `#${m.MachineNumber}`,
    Stitches: m.stitches
  })) || [];

  // Machine Pie Data
  const machinePieData = machineStats?.statusPie || [];

  if (kpiLoading) return <Typography sx={{ p: 4 }}>Loading Dashboard...</Typography>;

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Executive Dashboard
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Overview of Production, Contracts, and Machinery
          </Typography>
        </Box>
        <Box display="flex" alignItems="center">
          <Typography variant="caption" color="textSecondary" sx={{ mr: 2 }}>
            Updated: {lastRefreshed.toLocaleTimeString()}
          </Typography>
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>


      {/* Quick Actions (Moved to Top) */}
      <QuickActions />

      {/* Row 1: KPI Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard title="Active Machines" value={kpis?.activeMachines || 0} icon={<PrecisionManufacturing />} color={theme.palette.primary.main} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard title="Active Contracts" value={kpis?.activeContracts || 0} icon={<Assignment />} color={theme.palette.success.main} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard title="Today's Production" value={kpis?.todayProduction || 0} icon={<Inventory />} color={theme.palette.warning.main} showTrend={false} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard title="Pending Billing" value={kpis?.pendingBilling || '-'} icon={<AttachMoney />} color={theme.palette.error.main} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard title="Utilization" value={`${kpis?.utilization || 0}%`} icon={<Speed />} color={theme.palette.info.main} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard title="Last Activity" value={kpis?.recentActivity ? new Date(kpis.recentActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'} icon={<AccessTime />} color="gray" />
        </Grid>
      </Grid>

      {/* Row 2: Production Trend & Machine Stats */}
      <Grid container spacing={3} mb={3}>
        {/* Left: Production Trends (Line + Stacked Bar) */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <SimpleLineChart
                title="Daily Production Trend (30 Days)"
                data={lineChartData}
                xKey="name" // Added xKey
                lines={[{ key: 'Stitches', color: theme.palette.primary.main }]}
                height={300}
              />
            </Grid>
            {/* Shift wise if needed, or maybe just Line is enough. Requirement said Shift Stacked too. */}
            <Grid item xs={12}>
              <SimpleBarChart
                title="Shift-wise Production"
                data={shiftChartData}
                xKey="name" // Added xKey
                bars={[
                  { key: 'Morning', color: '#ffc107', stackId: 'a' },
                  { key: 'Night', color: '#3f51b5', stackId: 'a' }
                ]}
                height={250}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Right: Machine Stats */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={3} direction="column">
            <Grid item>
              <SimpleBarChart
                title="Top 10 Machines (Volume)"
                data={machineBarData}
                xKey="name" // Added xKey
                bars={[{ key: 'Stitches', color: theme.palette.secondary.main }]}
                // layout="vertical" removed as not supported by SimpleBarChart yet without generic prop update
                height={300}
              />
            </Grid>
            <Grid item>
              <SimplePieChart
                title="Machine Status Distribution"
                data={machinePieData}
                dataKey="value" // Added dataKey
                nameKey="name" // Added nameKey
                height={250}
                colors={[theme.palette.success.main, theme.palette.error.main, theme.palette.warning.main]}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Row 3: Contracts & Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <ContractSnapshot contracts={contracts || []} />
        </Grid>
        <Grid item xs={12} md={4}>
          <ActivityFeed activities={activity || []} />
        </Grid>
      </Grid>

      {/* Row 4: Bottom Area (Activity & Quick Actions was suggested Bottom Row) */}
      {/* Re-aligning to match Plan: 
          Row 3 Link: Contract (Table) Left | Operators/Clipping Right
          Row 4: Recent Activity | Quick Actions
      */}

    </Container>
  );
};

export default Dashboard;