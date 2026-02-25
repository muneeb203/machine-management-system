import React, { useState } from 'react';
import { useQuery } from 'react-query';
import {
    Grid, Paper, Typography, Box, Card, CardContent, CircularProgress, Alert, Button, Stack
} from '@mui/material';
import {
    Download, TableChart, GridOn
} from '@mui/icons-material';
import {
    DataGrid, GridColDef, GridValueFormatterParams, GridRenderCellParams, GridToolbar
} from '@mui/x-data-grid';

import ReportsLayout from '../../components/Reports/ReportsLayout';
import ReportFilterBar from '../../components/Reports/ReportFilterBar';
import api from '../../apiClient';
import { exportToPDF, exportToExcel } from '../../utils/exportUtils';

const Reports: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState('executive');
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days default
        endDate: new Date().toISOString().split('T')[0]
    });

    const [factoryDetails, setFactoryDetails] = useState<any>(null);

    // Filter states for specific reports
    const [clippingFilters, setClippingFilters] = useState({ vendorId: null, status: '' });
    const [gatepassFilters, setGatepassFilters] = useState({ type: 'all' });

    // Fetch Factory Details for Exports
    React.useEffect(() => {
        api.get('/api/settings/factory').then(res => setFactoryDetails(res.data.data)).catch(console.error);
    }, []);

    // --- 1. Executive Summary Data ---
    const { data: kpis, isLoading: kpiLoading, error: kpiError, refetch: refetchKPIs } = useQuery(
        ['report-kpi', filters],
        () => api.get('/api/reports/kpi', { params: filters }).then(res => res.data.data),
        {
            enabled: activeCategory === 'executive',
            keepPreviousData: true
        }
    );

    // --- 2. Contract Progress Data ---
    const { data: contractProgress, isLoading: contractLoading, error: contractError, refetch: refetchContracts } = useQuery(
        ['report-contract-progress', filters],
        () => api.get('/api/reports/contract-progress').then(res => res.data.data),
        {
            enabled: activeCategory === 'contracts'
        }
    );

    // --- 3. Production Trend Data ---
    const { data: productionTrends, isLoading: productionLoading, error: productionError, refetch: refetchProduction } = useQuery(
        ['report-production-trend', filters],
        () => api.get('/api/reports/production-trend', { params: filters }).then(res => res.data.data),
        {
            enabled: activeCategory === 'production'
        }
    );

    // --- 4. Machine Performance Data ---
    const { data: machinePerformance, isLoading: machineLoading, error: machineError, refetch: refetchMachine } = useQuery(
        ['report-machine-performance', filters],
        () => api.get('/api/reports/machine-performance', { params: filters }).then(res => res.data.data),
        { enabled: activeCategory === 'machines' }
    );

    // --- 5. Operator Performance Data ---
    const { data: operatorPerformance, isLoading: operatorLoading, error: operatorError, refetch: refetchOperator } = useQuery(
        ['report-operator-performance', filters],
        () => api.get('/api/reports/operator-performance', { params: filters }).then(res => res.data.data),
        { enabled: activeCategory === 'operators' }
    );

    // --- 6. Clipping Reports Data ---
    const { data: clippingData, isLoading: clippingLoading, error: clippingError, refetch: refetchClipping } = useQuery(
        ['report-clipping', filters, clippingFilters],
        () => api.get('/api/reports/clipping', { params: { ...filters, ...clippingFilters } }).then(res => res.data.data),
        { enabled: activeCategory === 'clipping' }
    );

    // --- 7. Gatepass Reports Data ---
    const { data: gatepassData, isLoading: gatepassLoading, error: gatepassError, refetch: refetchGatepass } = useQuery(
        ['report-gatepass', filters, gatepassFilters],
        () => api.get('/api/reports/gatepass', { params: { ...filters, ...gatepassFilters } }).then(res => res.data.data),
        { enabled: activeCategory === 'gatepass' }
    );

    const handleRefresh = () => {
        if (activeCategory === 'executive') refetchKPIs();
        if (activeCategory === 'contracts') refetchContracts();
        if (activeCategory === 'production') refetchProduction();
        if (activeCategory === 'machines') refetchMachine();
        if (activeCategory === 'operators') refetchOperator();
        if (activeCategory === 'production') refetchProduction();
        if (activeCategory === 'machines') refetchMachine();
        if (activeCategory === 'operators') refetchOperator();
        if (activeCategory === 'clipping') refetchClipping();
        if (activeCategory === 'gatepass') refetchGatepass();
    };

    // --- Renderers ---

    const renderExecutiveSummary = () => {
        if (kpiLoading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
        if (kpiError) return <Alert severity="error">Failed to load Report Data.</Alert>;

        return (
            <Box>
                <Grid container spacing={3}>
                    {/* KPI Cards */}
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card sx={{ bgcolor: '#e3f2fd' }}>
                            <CardContent>
                                <Typography color="textSecondary" variant="caption" gutterBottom>Active Contracts</Typography>
                                <Typography variant="h4" fontWeight="bold" color="primary">{kpis?.activeContracts}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" variant="caption" gutterBottom>Planned Stitches</Typography>
                                <Typography variant="h6" fontWeight="bold">{(kpis?.plannedStitches || 0).toLocaleString()}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" variant="caption" gutterBottom>Completed Stitches (Range)</Typography>
                                <Typography variant="h6" fontWeight="bold" color="success.main">{(kpis?.completedStitches || 0).toLocaleString()}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" variant="caption" gutterBottom>Remaining (Active)</Typography>
                                <Typography variant="h6" fontWeight="bold" color="warning.main">{(kpis?.remainingStitches || 0).toLocaleString()}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" variant="caption" gutterBottom>Machine Utilization</Typography>
                                <Typography variant="h4" fontWeight="bold">{kpis?.machineUtilization}%</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

            </Box>
        );
    };

    const renderContractProgress = () => {
        if (contractLoading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
        if (contractError) return <Alert severity="error">Failed to load Contract Data.</Alert>;

        const columns: GridColDef[] = [
            { field: 'ContractNumber', headerName: 'Contract #', width: 120 },
            {
                field: 'Collection',
                headerName: 'Collection Name',
                width: 200,
                valueFormatter: (params: GridValueFormatterParams) => params.value || '-'
            },
            {
                field: 'planned_stitches', headerName: 'Planned Stitches', width: 180, type: 'number',
                valueFormatter: (params: GridValueFormatterParams) => params.value?.toLocaleString()
            },
            {
                field: 'used_stitches', headerName: 'Used Stitches', width: 180, type: 'number',
                valueFormatter: (params: GridValueFormatterParams) => params.value?.toLocaleString()
            },
            {
                field: 'progress', headerName: '% Completion', width: 150,
                renderCell: (params: GridRenderCellParams) => (
                    <Box sx={{ width: '100%', mr: 1 }}>
                        <Typography variant="body2">{params.value}%</Typography>
                        <Box sx={{ width: '100%', bgcolor: '#e0e0e0', height: 6, borderRadius: 1 }}>
                            <Box sx={{ width: `${Math.min(params.value, 100)}%`, bgcolor: params.value >= 100 ? 'success.main' : 'primary.main', height: '100%', borderRadius: 1 }} />
                        </Box>
                    </Box>
                )
            },
        ];

        const handleExportPDF = () => {
            const exportCols = columns.map(c => ({ header: c.headerName || '', dataKey: c.field }));
            exportToPDF(exportCols, contractProgress, 'Contract Progress Report', factoryDetails);
        };

        const handleExportExcel = () => {
            exportToExcel(contractProgress, 'Contract Progress Report', factoryDetails);
        };

        return (
            <Box>
                <Box display="flex" justifyContent="flex-end" mb={2}>
                    <Stack direction="row" spacing={2}>
                        <Button startIcon={<Download />} variant="outlined" onClick={handleExportPDF}>Export PDF</Button>
                        <Button startIcon={<GridOn />} variant="outlined" onClick={handleExportExcel}>Export Excel</Button>
                    </Stack>
                </Box>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Paper sx={{ height: 600, width: '100%' }}>
                            <DataGrid
                                rows={contractProgress || []}
                                columns={columns}
                                getRowId={(row: any) => `${row.ContractID}-${row.Collection || 'default'}`}
                                initialState={{
                                    pagination: {
                                        paginationModel: { pageSize: 20, page: 0 },
                                    },
                                }}
                                pageSizeOptions={[20, 50, 100]}
                                disableRowSelectionOnClick
                                slots={{ toolbar: GridToolbar }}
                            />
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        );
    };

    const renderProductionTrends = () => {
        if (productionLoading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
        if (productionError) return <Alert severity="error">Failed to load Production Data.</Alert>;

        const columns: GridColDef[] = [
            { field: 'ProductionDate', headerName: 'Date', width: 150, valueFormatter: (params) => new Date(params.value).toLocaleDateString() },
            { field: 'morning', headerName: 'Morning Shift', width: 150, type: 'number', valueFormatter: (params) => params.value?.toLocaleString() },
            { field: 'night', headerName: 'Night Shift', width: 150, type: 'number', valueFormatter: (params) => params.value?.toLocaleString() },
            { field: 'total', headerName: 'Total Stitches', width: 180, type: 'number', valueFormatter: (params) => params.value?.toLocaleString() },
        ];

        const handleExportPDF = () => {
            const exportCols = columns.map(c => ({ header: c.headerName || '', dataKey: c.field }));
            exportToPDF(exportCols, productionTrends, 'Production Trend Report', factoryDetails);
        };

        const handleExportExcel = () => {
            exportToExcel(productionTrends, 'Production Trend Report', factoryDetails);
        };

        return (
            <Box>
                <Box display="flex" justifyContent="flex-end" mb={2}>
                    <Stack direction="row" spacing={2}>
                        <Button startIcon={<Download />} variant="outlined" onClick={handleExportPDF}>Export PDF</Button>
                        <Button startIcon={<GridOn />} variant="outlined" onClick={handleExportExcel}>Export Excel</Button>
                    </Stack>
                </Box>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Paper sx={{ height: 600, width: '100%' }}>
                            <DataGrid
                                rows={productionTrends || []}
                                columns={columns}
                                getRowId={(row: any) => row.ProductionDate}
                                initialState={{
                                    pagination: {
                                        paginationModel: { pageSize: 20, page: 0 },
                                    },
                                }}
                                pageSizeOptions={[20, 50, 100]}
                                disableRowSelectionOnClick
                                slots={{ toolbar: GridToolbar }}
                            />
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        );
    };

    const renderMachinePerformance = () => {
        if (machineLoading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
        if (machineError) return <Alert severity="error">Failed to load Machine Data.</Alert>;

        const columns: GridColDef[] = [
            { field: 'MachineNumber', headerName: 'Machine #', width: 150 },
            { field: 'total_stitches', headerName: 'Total Stitches', width: 200, type: 'number', valueFormatter: (params) => params.value?.toLocaleString() }
        ];

        const handleExportPDF = () => {
            const exportCols = columns.map(c => ({ header: c.headerName || '', dataKey: c.field }));
            exportToPDF(exportCols, machinePerformance, 'Machine Performance Report', factoryDetails);
        };

        const handleExportExcel = () => {
            exportToExcel(machinePerformance, 'Machine Performance Report', factoryDetails);
        };

        return (
            <Box>
                <Box display="flex" justifyContent="flex-end" mb={2}>
                    <Stack direction="row" spacing={2}>
                        <Button startIcon={<Download />} variant="outlined" onClick={handleExportPDF}>Export PDF</Button>
                        <Button startIcon={<GridOn />} variant="outlined" onClick={handleExportExcel}>Export Excel</Button>
                    </Stack>
                </Box>
                <Paper sx={{ height: 600, width: '100%' }}>
                    <DataGrid
                        rows={machinePerformance || []}
                        columns={columns}
                        getRowId={(row: any) => row.MachineNumber}
                        initialState={{
                            pagination: {
                                paginationModel: { pageSize: 20, page: 0 },
                            },
                        }}
                        pageSizeOptions={[20, 50, 100]}
                        disableRowSelectionOnClick
                        slots={{ toolbar: GridToolbar }}
                    />
                </Paper>
            </Box>
        );
    };

    const renderOperatorPerformance = () => {
        if (operatorLoading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
        if (operatorError) return <Alert severity="error">Failed to load Operator Data.</Alert>;

        const operatorColumns: GridColDef[] = [
            { field: 'OperatorName', headerName: 'Operator Name', width: 200 },
            {
                field: 'total_stitches', headerName: 'Total Stitches', width: 180, type: 'number',
                valueFormatter: (params: GridValueFormatterParams) => params.value?.toLocaleString()
            },
            { field: 'entry_count', headerName: 'Entries', width: 120, type: 'number' },
        ];

        const handleExportPDF = () => {
            const exportCols = operatorColumns.map(c => ({ header: c.headerName || '', dataKey: c.field }));
            exportToPDF(exportCols, operatorPerformance, 'Operator Performance Report', factoryDetails);
        };

        const handleExportExcel = () => {
            exportToExcel(operatorPerformance, 'Operator Performance Report', factoryDetails);
        };

        return (
            <Box>
                <Box display="flex" justifyContent="flex-end" mb={2}>
                    <Stack direction="row" spacing={2}>
                        <Button startIcon={<Download />} variant="outlined" onClick={handleExportPDF}>Export PDF</Button>
                        <Button startIcon={<GridOn />} variant="outlined" onClick={handleExportExcel}>Export Excel</Button>
                    </Stack>
                </Box>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Paper sx={{ height: 600, width: '100%' }}>
                            <DataGrid
                                rows={operatorPerformance || []}
                                columns={operatorColumns}
                                getRowId={(row: any) => row.OperatorName}
                                initialState={{
                                    pagination: {
                                        paginationModel: { pageSize: 20, page: 0 },
                                    },
                                }}
                                pageSizeOptions={[20, 50, 100]}
                                disableRowSelectionOnClick
                                slots={{ toolbar: GridToolbar }}
                            />
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        );
    };

    const renderClippingReports = () => {
        if (clippingLoading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
        if (clippingError) return <Alert severity="error">Failed to load Clipping Data.</Alert>;

        const columns: GridColDef[] = [
            { field: 'ClippingID', headerName: 'ID', width: 70 },
            { field: 'VendorName', headerName: 'Vendor', width: 150 },
            { field: 'ContactNumber', headerName: 'Contact', width: 120 },
            { field: 'Description', headerName: 'Item', width: 200 },
            { field: 'QuantitySent', headerName: 'Qty Sent', width: 100, type: 'number' },
            { field: 'QuantityReceived', headerName: 'Qty Recv', width: 100, type: 'number' },
            { field: 'PendingQuantity', headerName: 'Pending', width: 100, type: 'number' },
            { field: 'Status', headerName: 'Status', width: 120 },
            { field: 'DateSent', headerName: 'Sent Date', width: 120, valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : '-' },
        ];

        const handleExportPDF = () => {
            const exportCols = columns.map(c => ({ header: c.headerName || '', dataKey: c.field }));
            exportToPDF(exportCols, clippingData, 'Clipping Report', factoryDetails);
        };
        const handleExportExcel = () => exportToExcel(clippingData, 'Clipping Report', factoryDetails);

        return (
            <Box>
                <Box display="flex" justifyContent="flex-end" mb={2}>
                    <Stack direction="row" spacing={2}>
                        <Button startIcon={<Download />} variant="outlined" onClick={handleExportPDF}>Export PDF</Button>
                        <Button startIcon={<GridOn />} variant="outlined" onClick={handleExportExcel}>Export Excel</Button>
                    </Stack>
                </Box>
                <Paper sx={{ height: 600, width: '100%' }}>
                    <DataGrid
                        rows={clippingData || []}
                        columns={columns}
                        getRowId={(row: any) => row.ClippingItemID}
                        initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
                        pageSizeOptions={[20, 50, 100]}
                        disableRowSelectionOnClick
                        slots={{ toolbar: GridToolbar }}
                    />
                </Paper>
            </Box>
        );
    };

    const renderGatepassReports = () => {
        if (gatepassLoading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
        if (gatepassError) return <Alert severity="error">Failed to load Gatepass Data.</Alert>;

        const columns: GridColDef[] = [
            { field: 'PassNumber', headerName: 'Pass #', width: 100 },
            {
                field: 'Type', headerName: 'Type', width: 100, renderCell: (p) => (
                    <Typography color={p.value === 'Inward' ? 'success.main' : 'warning.main'} fontWeight="bold">{p.value}</Typography>
                )
            },
            { field: 'PassDate', headerName: 'Date', width: 120, valueFormatter: (p) => p.value ? new Date(p.value).toLocaleDateString() : '-' },
            { field: 'CarrierName', headerName: 'Carrier', width: 150 },
            { field: 'ContractNo', headerName: 'Contract', width: 120 },
            { field: 'ItemDescription', headerName: 'Item', width: 200 },
            { field: 'Quantity', headerName: 'Qty', width: 100, type: 'number' },
            { field: 'Unit', headerName: 'Unit', width: 80 },
            { field: 'Status', headerName: 'Status', width: 120 },
        ];

        const handleExportPDF = () => {
            const exportCols = columns.map(c => ({ header: c.headerName || '', dataKey: c.field }));
            exportToPDF(exportCols, gatepassData, 'Gatepass Report', factoryDetails);
        };
        const handleExportExcel = () => exportToExcel(gatepassData, 'Gatepass Report', factoryDetails);

        return (
            <Box>
                <Box display="flex" justifyContent="space-between" mb={2} alignItems="center">
                    <Stack direction="row" spacing={1}>
                        <Button variant={gatepassFilters.type === 'all' ? 'contained' : 'outlined'} onClick={() => setGatepassFilters({ type: 'all' })}>All</Button>
                        <Button variant={gatepassFilters.type === 'Inward' ? 'contained' : 'outlined'} color="success" onClick={() => setGatepassFilters({ type: 'Inward' })}>Inward</Button>
                        <Button variant={gatepassFilters.type === 'Outward' ? 'contained' : 'outlined'} color="warning" onClick={() => setGatepassFilters({ type: 'Outward' })}>Outward</Button>
                    </Stack>
                    <Stack direction="row" spacing={2}>
                        <Button startIcon={<Download />} variant="outlined" onClick={handleExportPDF}>Export PDF</Button>
                        <Button startIcon={<GridOn />} variant="outlined" onClick={handleExportExcel}>Export Excel</Button>
                    </Stack>
                </Box>
                <Paper sx={{ height: 600, width: '100%' }}>
                    <DataGrid
                        rows={gatepassData || []}
                        columns={columns}
                        getRowId={(row: any) => `${row.GatePassID}-${Math.random()}`} // Fallback ID
                        initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
                        pageSizeOptions={[20, 50, 100]}
                        disableRowSelectionOnClick
                        slots={{ toolbar: GridToolbar }}
                    />
                </Paper>
            </Box>
        );
    };

    const renderContent = () => {
        switch (activeCategory) {
            case 'executive': return renderExecutiveSummary();
            case 'contracts': return renderContractProgress();
            case 'production': return renderProductionTrends();
            case 'machines': return renderMachinePerformance();
            case 'operators': return renderOperatorPerformance();
            case 'clipping': return renderClippingReports();
            case 'gatepass': return renderGatepassReports();
            default: return (
                <Box p={4} textAlign="center">
                    <Typography variant="h6" color="textSecondary">Report "{activeCategory}" is coming soon.</Typography>
                </Box>
            );
        }
    };

    return (
        <ReportsLayout activeCategory={activeCategory} onCategoryChange={setActiveCategory} >
            <Box mb={2}>
                <Typography variant="h5" fontWeight="bold">
                    {activeCategory === 'executive' ? 'Executive Summary' : activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1) + ' Report'}
                </Typography>
                <Typography variant="body2" color="textSecondary">Snapshot of key performance indicators.</Typography>
            </Box>

            <ReportFilterBar
                startDate={filters.startDate}
                endDate={filters.endDate}
                onFilterChange={setFilters}
                onRefresh={handleRefresh}
            />

            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {renderContent()}
            </Box>
        </ReportsLayout >
    );
};

export default Reports;
