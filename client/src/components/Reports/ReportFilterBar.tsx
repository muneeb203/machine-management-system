import React from 'react';
import { Box, Paper, TextField, Button, Grid, MenuItem } from '@mui/material';
import { Refresh, Download } from '@mui/icons-material';

interface ReportFilterBarProps {
    startDate: string;
    endDate: string;
    onFilterChange: (filters: { startDate: string, endDate: string }) => void;
    onRefresh: () => void;
    showRefresh?: boolean;
}

const ReportFilterBar: React.FC<ReportFilterBarProps> = ({ startDate, endDate, onFilterChange, onRefresh, showRefresh = true }) => {

    // Quick Helpers for Date Presets (Implementation can be expanded later)

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                    <TextField
                        label="From Date"
                        type="date"
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={startDate}
                        onChange={(e) => onFilterChange({ startDate: e.target.value, endDate })}
                    />
                </Grid>
                <Grid item xs={12} md={3}>
                    <TextField
                        label="To Date"
                        type="date"
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={endDate}
                        onChange={(e) => onFilterChange({ startDate, endDate: e.target.value })}
                    />
                </Grid>
                <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {showRefresh && (
                        <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={onRefresh}
                        >
                            Refresh
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<Download />}
                        disabled // Disabled until export implemented
                    >
                        Export
                    </Button>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ReportFilterBar;
