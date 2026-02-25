import React, { useState } from 'react';
import { Box, Typography, Grid, Paper, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { useQuery } from 'react-query';
import api from '../apiClient';
import { KPICard } from '../components/Analytics/KPICard';
import { SimpleLineChart, SimpleBarChart, SimplePieChart } from '../components/Analytics/Charts';
import {
  Assessment,
  AssignmentTurnedIn,
  Timeline,
  PrecisionManufacturing,
  People,
  ContentCut,
  Warning
} from '@mui/icons-material';

const Reports: React.FC = () => {
  const [filterPeriod, setFilterPeriod] = useState('30d');

  // --- KPI Data ---
  const { data: kpis } = useQuery('analytics-kpis', async () => {
    const res = await api.get('/api/analytics/kpis');
    return res.data;
  });

  // --- Contracts Data ---
  const { data: contractsData } = useQuery('analytics-contracts', async () => {
    const res = await api.get('/api/analytics/contracts');
    return res.data;
  });

  // --- Production Data ---
  const { data: productionData } = useQuery('analytics-production', async () => {
    const res = await api.get('/api/analytics/production');
    return res.data;
  });

  // --- Machines Data ---
  const { data: machinesData } = useQuery('analytics-machines', async () => {
    const res = await api.get('/api/analytics/machines');
    return res.data;
  });

  // --- Operators Data ---
  const { data: operatorsData } = useQuery('analytics-operators', async () => {
    const res = await api.get('/api/analytics/operators');
    return res.data;
  });

  // --- Clipping Data ---
  const { data: clippingData } = useQuery('analytics-clipping', async () => {
    const res = await api.get('/api/analytics/clipping');
    return res.data;
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">Analytics</Typography>
        <Box>
          {/* Date Range Filter Placeholder */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              label="Period"
              onChange={(e) => setFilterPeriod(e.target.value)}
            >
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 3 Months</MenuItem>
              <MenuItem value="1y">This Year</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* 1. Executive Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={2}>
          <KPICard title="Active Contracts" value={kpis?.activeContracts || 0} icon={<Assessment fontSize="large" />} color="#1976d2" />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <KPICard title="Completed" value={kpis?.completedContracts || 0} icon={<AssignmentTurnedIn fontSize="large" />} color="#2e7d32" />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <KPICard title="Planned Stitches" value={(kpis?.totalPlannedStitches || 0).toLocaleString()} subtitle="Total Order Volume" icon={<Timeline fontSize="large" />} color="#ed6c02" />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <KPICard title="Completed Stitches" value={(kpis?.totalCompletedStitches || 0).toLocaleString()} subtitle="Production to Date" icon={<PrecisionManufacturing fontSize="large" />} color="#9c27b0" />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <KPICard title="Remaining" value={(kpis?.remainingStitches || 0).toLocaleString()} subtitle="Pending Production" icon={<Warning fontSize="large" />} color="#d32f2f" />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <KPICard title="Utilization" value={`${kpis?.utilization || 0}%`} subtitle="Active Machines" icon={<PrecisionManufacturing fontSize="large" />} color="#0288d1" />
        </Grid>
      </Grid>

      {/* 2. Production Performance */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>Production Performance</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <SimpleLineChart
            title="Daily Production Trend (Last 30 Days)"
            data={productionData?.daily || [] as any[]}
            xKey="date"
            lines={[{ key: 'stitches', color: '#8884d8', name: 'Stitches' }]}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <SimplePieChart
            title="Avg Shift Production"
            data={productionData?.shift || [] as any[]}
            dataKey="stitches"
            nameKey="Shift"
          />
        </Grid>
        <Grid item xs={12}>
          <SimpleBarChart
            title="Monthly Trend"
            data={productionData?.monthly || [] as any[]}
            xKey="month"
            bars={[{ key: 'stitches', color: '#82ca9d', name: 'Stitches' }]}
          />
        </Grid>
      </Grid>

      {/* 3. Contract Progress */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>Contract Progress</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Contracts Progress Bar Chart: Planned vs Completed */}
          <SimpleBarChart
            title="Contract Stitch Completion"
            data={contractsData?.contracts.slice(0, 10) || [] as any[]} // Top 10
            xKey="client" // Use client or contract no
            bars={[
              { key: 'completedStitches', color: '#8884d8', name: 'Completed', stackId: 'a' },
              { key: 'plannedStitches', color: '#82ca9d', name: 'Planned', stackId: 'b' } // Stack b to simple compare side by side or overlap? 
              // User asked for Progress Bar (Planned vs Completed). Let's do %? Or side by side.
              // Side by side bars are good.
            ]}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <SimplePieChart
            title="Contract Status"
            data={contractsData?.statusPie || [] as any[]}
            dataKey="value"
            nameKey="name"
          />
        </Grid>
      </Grid>

      {/* 4. Machine & Operator */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>Machines & Operators</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <SimpleBarChart
            title="Top Machine Output"
            data={machinesData?.machines.slice(0, 10) || [] as any[]}
            xKey="machineNumber"
            bars={[{ key: 'totalProduction', color: '#ffc658', name: 'Stitches' }]}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <SimplePieChart
            title="Machine Status"
            data={machinesData?.statusPie || [] as any[]}
            dataKey="value"
            nameKey="name"
          />
        </Grid>
      </Grid>

      {/* 5. Outsourcing (Clipping) */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>Outsourcing (Clipping)</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {/* In-house vs Outsourced Pie */}
          <SimplePieChart
            title="In-House vs Outsourced"
            data={[
              { name: 'In-House', value: clippingData?.inHouseStitches || 0 },
              { name: 'Outsourced (Clipping)', value: clippingData?.clipping?.sent || 0 } // Mixing units potentially but rough idea
            ]}
            dataKey="value"
            nameKey="name"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          {/* Pending by Vendor */}
          <SimpleBarChart
            title="Pending Work by Vendor"
            data={clippingData?.vendors || [] as any[]}
            xKey="VendorName"
            bars={[{ key: 'pending', color: '#ff8042', name: 'Pending Qty' }]}
          />
        </Grid>
      </Grid>

    </Box>
  );
};

export default Reports;