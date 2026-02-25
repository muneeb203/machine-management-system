import React, { useState } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    InputAdornment,
    LinearProgress,
    Tooltip // Added
} from '@mui/material';
import {
    Search,
    Visibility,
    Close,
    Assignment,
    FilterList,
    Cancel,
    ExpandMore,
    ExpandLess
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import api from '../apiClient';

// Re-using types from Contracts.tsx or defining locally if not exported
interface AssignedMachine {
    machineId: number;
    machineNumber: string | number;
    masterName: string;
    assignedStitches?: number;
    avgStitchesPerDay?: number;
    repeats?: number;
    estimatedDays?: number;
  }
interface ContractItemData {
    h2hOGP: number | null;
    wteIGP: number | null;
    itemDescription: string;
    fabric: string;
    color: string;
    repeat: number;
    pieces: number;
    motif?: number;
    lace?: number;
    yard: number;
    tilla: number;
    sequence: number;
    collection?: string;
    designNo?: string;
    component?: string;
    stitch?: number;
    ratePerRepeat?: number;
    ratePerStitch?: number;
    calculatedRate?: number;
    totalRate?: number;
    machineGazz?: string;
    machineHead?: string;
    usedStitches?: number;
    usedRepeats?: number;
    assignedMachines?: AssignedMachine[];
}

interface ContractResponse {
    id: number;
    contractNumber: number;
    contractDate: string;
    contractEndDate?: string;
    contractDuration?: number;
    poNumber: string;
    isActive: boolean;
    progress: string;
    items?: ContractItemData[];
    collections?: string;
    designNos?: string;
    components?: string;
    assigned?: boolean;
    progressPercentage?: number;
    totalEstimatedDays?: number;
}

const ContractProgress: React.FC = () => {
    // --- Filters State ---
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
    const [poFilter, setPoFilter] = useState('');
    const [collectionFilter, setCollectionFilter] = useState('');

    // -- Debounce state could be added here for search fields, or just pass directly to query key for simplicity in MVP --

    // --- View State ---
    const [viewContract, setViewContract] = useState<ContractResponse | null>(null);

    // --- Expandable rows: which contracts are expanded, and cached item details ---
    const [expandedContractIds, setExpandedContractIds] = useState<Set<number>>(new Set());
    const [expandedDetailsCache, setExpandedDetailsCache] = useState<Map<number, ContractResponse>>(new Map());
    const [loadingExpandedId, setLoadingExpandedId] = useState<number | null>(null);

    // --- Data Fetching ---
    const { data: contractsData, isLoading } = useQuery(
        ['contracts', statusFilter, poFilter, collectionFilter],
        async () => {
            // Build query params
            const params: any = { limit: 500 };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (poFilter) params.poNumber = poFilter;
            if (collectionFilter) params.collection = collectionFilter;

            const response = await api.get('/api/contracts', { params });
            return response.data?.data || [];
        },
        { keepPreviousData: true }
    );

    // --- Handlers ---
    const handleStatusChange = (event: React.MouseEvent<HTMLElement>, newStatus: 'active' | 'inactive' | 'all' | null) => {
        if (newStatus !== null) {
            setStatusFilter(newStatus);
        }
    };

    const handleOpenView = async (id: number) => {
        try {
            const response = await api.get(`/api/contracts/${id}`);
            const data = response.data?.data || response.data;
            setViewContract(data);
        } catch (err) {
            console.error("Failed to load details", err);
        }
    };

    const toggleExpand = async (contractId: number) => {
        const next = new Set(expandedContractIds);
        if (next.has(contractId)) {
            next.delete(contractId);
            setExpandedContractIds(next);
        } else {
            next.add(contractId);
            setExpandedContractIds(next);
            if (!expandedDetailsCache.has(contractId)) {
                setLoadingExpandedId(contractId);
                try {
                    const response = await api.get(`/api/contracts/${contractId}`);
                    const data = response.data?.data || response.data;
                    setExpandedDetailsCache(prev => new Map(prev).set(contractId, data));
                } catch (err) {
                    console.error("Failed to load item details", err);
                } finally {
                    setLoadingExpandedId(null);
                }
            }
        }
    };

    // Helper: compute item-wise progress for display
    const getItemProgress = (item: ContractItemData) => {
        const stitch = Number(item.stitch || 0);
        const pieces = Number(item.pieces || 0);
        const plannedTotalStitches = stitch * pieces;
        const assignedStitches = (item.assignedMachines || []).reduce((sum, m) => sum + Number(m.assignedStitches || 0), 0);
        const completedStitches = Number(item.usedStitches || 0);
        const pendingStitches = Math.max(0, plannedTotalStitches - completedStitches);
        const itemProgressPct = plannedTotalStitches > 0 ? Math.min(100, (completedStitches / plannedTotalStitches) * 100) : 0;
        return { plannedTotalStitches, assignedStitches, completedStitches, pendingStitches, itemProgressPct };
    };

    // Optional: derive status from progress (0% = Active, 0-100% = In Progress, 100% = Completed)
    const getProgressStatus = (pct: number) => {
        if (pct >= 100) return { label: 'Completed', color: 'success' as const };
        if (pct > 0) return { label: 'In Progress', color: 'info' as const };
        return { label: 'Active', color: 'default' as const };
    };


    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Assignment sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
                Contract Progress
            </Typography>

            {/* --- Filter Bar --- */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    {/* Status Filter */}
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom color="textSecondary">Contract Status</Typography>
                        <ToggleButtonGroup
                            value={statusFilter}
                            exclusive
                            onChange={handleStatusChange}
                            size="small"
                            fullWidth
                            color="primary"
                        >
                            <ToggleButton value="active">Active</ToggleButton>
                            <ToggleButton value="inactive">Inactive</ToggleButton>
                            <ToggleButton value="all">All</ToggleButton>
                        </ToggleButtonGroup>
                    </Grid>

                    {/* PO Search */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            label="Search by PO Number"
                            variant="outlined"
                            size="small"
                            value={poFilter}
                            onChange={(e) => setPoFilter(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><Search color="action" /></InputAdornment>,
                            }}
                        />
                    </Grid>

                    {/* Collection Search */}
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            label="Search by Collection"
                            variant="outlined"
                            size="small"
                            value={collectionFilter}
                            onChange={(e) => setCollectionFilter(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><FilterList color="action" /></InputAdornment>,
                            }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* --- Contracts List --- */}
            <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
                <Table>
                    <TableHead sx={{ bgcolor: 'secondary.main', '& th': { color: 'white', fontWeight: 'bold' } }}>
                        <TableRow>
                            <TableCell padding="checkbox" sx={{ width: 48 }}></TableCell>
                            <TableCell>Contract No</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>PO Number</TableCell>
                            <TableCell>Collection</TableCell>
                            <TableCell>Design No</TableCell>
                            <TableCell>Component</TableCell>
                            <TableCell align="center">Total Estimated Days</TableCell>
                            <TableCell align="center">Days Left</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="center">Assigned</TableCell>
                            <TableCell align="center">Progress (%)</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={13} align="center">Loading...</TableCell></TableRow>
                        ) : contractsData?.length === 0 ? (
                            <TableRow><TableCell colSpan={13} align="center">No contracts found.</TableCell></TableRow>
                        ) : (
                            contractsData?.map((contract: ContractResponse) => (
                                <React.Fragment key={contract.id}>
                                <TableRow hover sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                    <TableCell padding="checkbox">
                                        <IconButton
                                            size="small"
                                            onClick={() => toggleExpand(contract.id)}
                                            disabled={loadingExpandedId === contract.id}
                                            aria-label={expandedContractIds.has(contract.id) ? 'Collapse' : 'Expand'}
                                        >
                                            {loadingExpandedId === contract.id ? (
                                                <Typography variant="caption">...</Typography>
                                            ) : expandedContractIds.has(contract.id) ? (
                                                <ExpandLess />
                                            ) : (
                                                <ExpandMore />
                                            )}
                                        </IconButton>
                                    </TableCell>
                                    <TableCell>#{contract.contractNumber}</TableCell>
                                    <TableCell>{new Date(contract.contractDate).toLocaleDateString()}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{contract.poNumber}</TableCell>
                                    <TableCell>{contract.collections || '-'}</TableCell>
                                    <TableCell>{contract.designNos || '-'}</TableCell>
                                    <TableCell>{contract.components || '-'}</TableCell>
                                    <TableCell align="center">
                                        {contract.totalEstimatedDays != null && contract.totalEstimatedDays > 0
                                            ? Number(contract.totalEstimatedDays).toFixed(2)
                                            : '-'}
                                    </TableCell>
                                    <TableCell align="center">
                                        {(() => {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            const start = new Date(contract.contractDate);
                                            start.setHours(0, 0, 0, 0);
                                            const elapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                            const totalEst = contract.totalEstimatedDays ?? 0;
                                            if (totalEst <= 0) return '-';
                                            const daysLeft = Math.ceil(totalEst) - elapsed;
                                            return (
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={daysLeft < 7 ? 'bold' : 'normal'}
                                                    color={daysLeft < 0 ? 'error.main' : daysLeft < 7 ? 'warning.main' : 'text.primary'}
                                                >
                                                    {daysLeft < 0 ? `${daysLeft} (Overdue)` : daysLeft}
                                                </Typography>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={contract.isActive
                                                ? (() => { const { label } = getProgressStatus(contract.progressPercentage ?? 0); return label; })()
                                                : 'Inactive'}
                                            color={contract.isActive
                                                ? (() => { const { color } = getProgressStatus(contract.progressPercentage ?? 0); return color; })()
                                                : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        {contract.assigned ? (
                                            <Tooltip title="Production has started">
                                                <Assignment color="success" />
                                            </Tooltip>
                                        ) : (
                                            <Tooltip title="No production yet">
                                                <Cancel color="disabled" />
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ minWidth: 100 }}>
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(100, contract.progressPercentage ?? 0)}
                                                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                                                    color={(contract.progressPercentage ?? 0) >= 100 ? 'success' : 'primary'}
                                                />
                                                <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 48 }}>
                                                    {contract.progressPercentage != null ? Number(contract.progressPercentage).toFixed(2) : '0.00'}%
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<Visibility />}
                                            onClick={() => handleOpenView(contract.id)}
                                        >
                                            View Report
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                {/* Expandable item-wise breakdown */}
                                {expandedContractIds.has(contract.id) && (
                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        <TableCell colSpan={13} sx={{ py: 0, borderBottom: 'none', verticalAlign: 'top' }}>
                                            {loadingExpandedId === contract.id ? (
                                                <Box py={3} textAlign="center">
                                                    <Typography color="textSecondary">Loading item details...</Typography>
                                                </Box>
                                            ) : (() => {
                                                const details = expandedDetailsCache.get(contract.id);
                                                const items = details?.items || [];
                                                if (items.length === 0) {
                                                    return (
                                                        <Box py={2} px={2}>
                                                            <Typography color="textSecondary">No items found for this contract.</Typography>
                                                        </Box>
                                                    );
                                                }
                                                return (
                                                    <Box py={2} px={2}>
                                                        <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>Item-wise Progress</Typography>
                                                        <Table size="small" sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                                                            <TableHead>
                                                                <TableRow sx={{ bgcolor: 'grey.100' }}>
                                                                    <TableCell sx={{ fontWeight: 'bold' }}>Design No</TableCell>
                                                                    <TableCell sx={{ fontWeight: 'bold' }}>Component / Item</TableCell>
                                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Planned Total Stitches</TableCell>
                                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Assigned Stitches</TableCell>
                                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Completed Stitches</TableCell>
                                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Pending Stitches</TableCell>
                                                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Item Progress (%)</TableCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {items.map((item, idx) => {
                                                                    const { plannedTotalStitches, assignedStitches, completedStitches, pendingStitches, itemProgressPct } = getItemProgress(item);
                                                                    return (
                                                                        <TableRow key={idx} hover>
                                                                            <TableCell>{item.designNo || '-'}</TableCell>
                                                                            <TableCell>{item.component || item.itemDescription || '-'}</TableCell>
                                                                            <TableCell align="right">{plannedTotalStitches.toLocaleString()}</TableCell>
                                                                            <TableCell align="right">{assignedStitches.toLocaleString()}</TableCell>
                                                                            <TableCell align="right">{completedStitches.toLocaleString()}</TableCell>
                                                                            <TableCell align="right">{pendingStitches.toLocaleString()}</TableCell>
                                                                            <TableCell align="center">
                                                                                <Box display="flex" alignItems="center" gap={1}>
                                                                                    <LinearProgress
                                                                                        variant="determinate"
                                                                                        value={itemProgressPct}
                                                                                        sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                                                                        color={itemProgressPct >= 100 ? 'success' : 'primary'}
                                                                                    />
                                                                                    <Typography variant="body2" fontWeight="medium" sx={{ minWidth: 44 }}>
                                                                                        {itemProgressPct.toFixed(2)}%
                                                                                    </Typography>
                                                                                </Box>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </Box>
                                                );
                                            })()}
                                        </TableCell>
                                    </TableRow>
                                )}
                                </React.Fragment>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>


            {/* --- View Modal (Report Style) --- */}
            <Dialog
                open={!!viewContract}
                onClose={() => setViewContract(null)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        Contract Report #{viewContract?.contractNumber}
                        <Typography variant="caption" display="block" color="inherit" sx={{ opacity: 0.8 }}>
                            PO: {viewContract?.poNumber}
                        </Typography>
                    </Box>
                    <IconButton onClick={() => setViewContract(null)} color="inherit">
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 3 }}>
                    {viewContract && (
                        <Box>
                            {/* Header Info */}
                            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
                                <Grid container spacing={3}>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="caption" color="textSecondary">Start Date</Typography>
                                        <Typography variant="body1" fontWeight="bold">{new Date(viewContract.contractDate).toLocaleDateString()}</Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="caption" color="textSecondary">End Date</Typography>
                                        <Typography variant="body1" fontWeight="bold">
                                            {viewContract.contractEndDate ? new Date(viewContract.contractEndDate).toLocaleDateString() : '-'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="caption" color="textSecondary">Duration</Typography>
                                        <Typography variant="body1">{viewContract.contractDuration || 0} days</Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                        <Typography variant="caption" color="textSecondary">Status</Typography>
                                        <Chip label={viewContract.isActive ? 'Active' : 'Inactive'} color={viewContract.isActive ? 'success' : 'default'} size="small" />
                                    </Grid>

                                    {/* Time Progress */}
                                    <Grid item xs={12}>
                                        <Box mt={1}>
                                            {(() => {
                                                const start = new Date(viewContract.contractDate);
                                                const end = viewContract.contractEndDate ? new Date(viewContract.contractEndDate) : null;
                                                const duration = viewContract.contractDuration || 0;

                                                if (!end || duration <= 0) return null;

                                                const today = new Date();
                                                const elapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                                const percent = Math.min(100, Math.max(0, (elapsed / duration) * 100));
                                                const daysLeft = Math.max(0, duration - elapsed);

                                                return (
                                                    <Box>
                                                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                            <Typography variant="caption" fontWeight="bold">Schedule Progress</Typography>
                                                            <Typography variant="caption">{elapsed} / {duration} Days ({percent.toFixed(0)}%) - {daysLeft} Days Left</Typography>
                                                        </Box>
                                                        <LinearProgress variant="determinate" value={percent} color={percent > 100 ? "error" : "info"} sx={{ height: 8, borderRadius: 4 }} />
                                                    </Box>
                                                );
                                            })()}
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Items Details (Report Grid) */}
                            <Typography variant="h6" gutterBottom sx={{ borderBottom: '2px solid #ddd', pb: 1, mb: 2 }}>Order Details</Typography>

                            {viewContract.items?.map((item, index) => (
                                <Paper key={index} elevation={2} sx={{ mb: 3, p: 2, borderLeft: '5px solid #1976d2' }}>
                                    <Grid container spacing={2}>
                                        {/* Row 1: Item Identity */}
                                        <Grid item xs={12} md={4}>
                                            <Typography variant="subtitle2" color="primary">Item #{index + 1}</Typography>
                                            <Typography variant="h6">{item.itemDescription}</Typography>
                                        </Grid>
                                        <Grid item xs={6} md={4}>
                                            <Typography variant="caption" color="textSecondary">Collection / Design No</Typography>
                                            <Typography variant="body2">{item.collection || '-'} / {item.designNo || '-'}</Typography>
                                        </Grid>
                                        <Grid item xs={6} md={4}>
                                            <Typography variant="caption" color="textSecondary">Fabric / Color</Typography>
                                            <Typography variant="body2">{item.fabric || '-'} / {item.color || '-'}</Typography>
                                        </Grid>

                                        <Grid item xs={12}><Divider /></Grid>

                                        {/* Row 2: Specs */}
                                        <Grid item xs={6} md={2}>
                                            <Typography variant="caption" color="textSecondary">Stitch</Typography>
                                            <Typography variant="body2">{item.stitch || '-'}</Typography>
                                        </Grid>
                                        <Grid item xs={6} md={2}>
                                            <Typography variant="caption" color="textSecondary">Repeat</Typography>
                                            <Typography variant="body2">{item.repeat || '-'}</Typography>
                                        </Grid>
                                        <Grid item xs={6} md={4}>
                                            <Typography variant="caption" color="textSecondary">Production Qty</Typography>
                                            <Typography variant="body2">
                                                Pcs: <b>{item.pieces || 0}</b> | Motif: <b>{item.motif || 0}</b> | Lace: <b>{item.lace || 0}</b> | Yards: <b>{item.yard}</b>
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} md={2}>
                                            <Typography variant="caption" color="textSecondary">Rate / Yard</Typography>
                                            <Typography variant="body2">{item.calculatedRate || '-'}</Typography>
                                        </Grid>
                                        <Grid item xs={6} md={2}>
                                            <Typography variant="caption" color="textSecondary">Total Cost</Typography>
                                            <Typography variant="body1" fontWeight="bold" color="green">{item.totalRate || '-'}</Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            ))}

                            {/* Machine Configuration Section (Separate Box) */}
                            <Typography variant="h6" gutterBottom sx={{ borderBottom: '2px solid #ddd', pb: 1, mb: 2, mt: 4 }}>Machine Configuration</Typography>
                            <Paper variant="outlined" sx={{ p: 0, mb: 3, overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Item Description</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Machine Gazz</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Machine Head</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {viewContract.items?.map((item, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>{item.itemDescription}</TableCell>
                                                <TableCell>{item.machineGazz || '-'}</TableCell>
                                                <TableCell>{item.machineHead || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {(!viewContract.items || viewContract.items.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">No items found</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Paper>

                            {/* Production Progress Section */}
                            <Box sx={{ mt: 4, bgcolor: '#e3f2fd', p: 3, borderRadius: 2, border: '1px solid #90caf9' }}>
                                <Typography variant="h6" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Assignment sx={{ mr: 1 }} />
                                    overall Production Progress
                                </Typography>

                                {(() => {
                                    // Calculate Aggregates
                                    let grandTotalStitch = 0;
                                    let grandUsedStitch = 0;
                                    let grandTotalRepeat = 0;
                                    let grandUsedRepeat = 0;

                                    viewContract.items?.forEach(item => {
                                        const stitch = Number(item.stitch || 0);
                                        const pieces = Number(item.pieces || 0);
                                        grandTotalStitch += (stitch * pieces);

                                        grandUsedStitch += Number(item.usedStitches || 0);
                                        grandTotalRepeat += Number(item.repeat || 0); // Assuming Repeat is Total Repeats? Or Per Piece?
                                        // Validating Repeat Logic:
                                        // Backend doesn't calculate Total Repeats for progress?
                                        // Backend only calculates Stitches Progress.
                                        // Frontend displays Repeats Progress too. 
                                        // If `item.repeat` is Total Repeats, then summing it is correct. 
                                        // If it is Repeats Per Piece, then it should be * Pieces.
                                        // Reviewing ContractItem schema, 'Repeat' usually means Total Repeats for the item line.
                                        // Let's stick to existing logic for Repeat for now unless proven wrong, 
                                        // but Stitches defines the volume/rate usually.
                                        grandUsedRepeat += Number(item.usedRepeats || 0);
                                    });

                                    const stitchPercent = grandTotalStitch > 0 ? Math.min(100, (grandUsedStitch / grandTotalStitch) * 100) : 0;
                                    const repeatPercent = grandTotalRepeat > 0 ? Math.min(100, (grandUsedRepeat / grandTotalRepeat) * 100) : 0;

                                    // Time Calculation
                                    const start = new Date(viewContract.contractDate);
                                    let duration = viewContract.contractDuration || 0;

                                    // Fallback 1: Calculate duration if missing but End Date exists
                                    if (!duration && viewContract.contractEndDate) {
                                        const end = new Date(viewContract.contractEndDate);
                                        const diffTime = Math.abs(end.getTime() - start.getTime());
                                        duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    }

                                    // Fallback 2: Use total estimated days from contract items (ContractItemMachine)
                                    if (!duration && (viewContract.totalEstimatedDays || 0) > 0) {
                                        duration = Math.ceil(Number(viewContract.totalEstimatedDays));
                                    }
                                    if (!duration && viewContract.items?.length) {
                                        const sumFromItems = viewContract.items.reduce((s, item) =>
                                            s + (item.assignedMachines?.reduce((sm, m) => sm + (m.estimatedDays || 0), 0) || 0), 0);
                                        if (sumFromItems > 0) duration = Math.ceil(sumFromItems);
                                    }

                                    const today = new Date();
                                    const elapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                    const daysLeft = Math.max(0, duration - elapsed);
                                    const timePercent = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

                                    // Handle "No Schedule" case
                                    if (duration === 0) {
                                        return (
                                            <Box>
                                                <Grid container spacing={4} sx={{ mt: 1 }}>
                                                    {/* Stitches */}
                                                    <Grid item xs={12} md={4}>
                                                        <Paper elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', borderTop: '4px solid #1976d2' }}>
                                                            <Typography variant="subtitle1" fontWeight="bold">Total Stitches</Typography>
                                                            <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                                                                <Typography variant="h4" color="primary">{stitchPercent.toFixed(1)}%</Typography>
                                                            </Box>
                                                            <LinearProgress variant="determinate" value={stitchPercent} sx={{ height: 10, borderRadius: 5, mb: 1 }} />
                                                            <Typography variant="body2" color="textSecondary">
                                                                {grandUsedStitch.toLocaleString()} / {grandTotalStitch.toLocaleString()}
                                                            </Typography>
                                                            <Typography variant="caption" color="error">
                                                                Remaining: {(grandTotalStitch - grandUsedStitch).toLocaleString()}
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>

                                                    {/* Repeats */}
                                                    <Grid item xs={12} md={4}>
                                                        <Paper elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', borderTop: '4px solid #9c27b0' }}>
                                                            <Typography variant="subtitle1" fontWeight="bold">Total Repeats</Typography>
                                                            <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                                                                <Typography variant="h4" color="secondary">{repeatPercent.toFixed(1)}%</Typography>
                                                            </Box>
                                                            <LinearProgress variant="determinate" value={repeatPercent} color="secondary" sx={{ height: 10, borderRadius: 5, mb: 1 }} />
                                                            <Typography variant="body2" color="textSecondary">
                                                                {grandUsedRepeat.toLocaleString()} / {grandTotalRepeat.toLocaleString()}
                                                            </Typography>
                                                            <Typography variant="caption" color="error">
                                                                Remaining: {(grandTotalRepeat - grandUsedRepeat).toLocaleString()}
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>

                                                    {/* Days (Empty State) */}
                                                    <Grid item xs={12} md={4}>
                                                        <Paper elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', borderTop: '4px solid #757575', bgcolor: '#eeeeee' }}>
                                                            <Typography variant="subtitle1" fontWeight="bold" color="textSecondary">Time Schedule</Typography>
                                                            <Box sx={{ my: 3 }}>
                                                                <Typography variant="body2" color="textSecondary">No Estimated Days set in contract machine assignment</Typography>
                                                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>Edit contract and add Estimated Days per machine in Section 5</Typography>
                                                            </Box>
                                                            <Button size="small" variant="outlined" onClick={() => setViewContract(null)}>Edit Contract</Button>
                                                        </Paper>
                                                    </Grid>
                                                </Grid>

                                                <Divider sx={{ my: 3 }} />
                                                <Typography variant="h6" gutterBottom>Item Breakdown</Typography>

                                                {/* Item Breakdown Rendering (Duplicated for now or extract component? Inline for speed) */}
                                                {
                                                    viewContract.items?.map((item, index) => {
                                                        const stitch = Number(item.stitch || 0);
                                                        const pieces = Number(item.pieces || 0);
                                                        const stitchTotal = stitch * pieces;

                                                        const stitchUsed = item.usedStitches || 0;
                                                        const stitchP = stitchTotal > 0 ? Math.min(100, (stitchUsed / stitchTotal) * 100) : 0;

                                                        const repeatTotal = Number(item.repeat || 0);
                                                        const repeatUsed = item.usedRepeats || 0;
                                                        const repeatP = repeatTotal > 0 ? Math.min(100, (repeatUsed / repeatTotal) * 100) : 0;

                                                        return (
                                                            <Paper key={index} sx={{ mb: 2, p: 2 }}>
                                                                <Typography variant="subtitle2" gutterBottom>Item #{index + 1}: {item.itemDescription}</Typography>
                                                                <Grid container spacing={3}>
                                                                    {/* Stitches */}
                                                                    <Grid item xs={12} md={6}>
                                                                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                                            <Typography variant="caption" fontWeight="bold">Stitches Progress</Typography>
                                                                            <Typography variant="caption">{stitchUsed.toLocaleString()} / {stitchTotal.toLocaleString()} ({stitchP.toFixed(1)}%)</Typography>
                                                                        </Box>
                                                                        <LinearProgress variant="determinate" value={stitchP} color={stitchP >= 100 ? "success" : "primary"} sx={{ height: 8, borderRadius: 4 }} />
                                                                        <Typography variant="caption" color="textSecondary">Remaining: {(stitchTotal - stitchUsed).toLocaleString()}</Typography>
                                                                    </Grid>

                                                                    {/* Repeats */}
                                                                    <Grid item xs={12} md={6}>
                                                                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                                            <Typography variant="caption" fontWeight="bold">Repeats Progress</Typography>
                                                                            <Typography variant="caption">{repeatUsed.toLocaleString()} / {repeatTotal.toLocaleString()} ({repeatP.toFixed(1)}%)</Typography>
                                                                        </Box>
                                                                        <LinearProgress variant="determinate" value={repeatP} color={repeatP >= 100 ? "success" : "secondary"} sx={{ height: 8, borderRadius: 4 }} />
                                                                        <Typography variant="caption" color="textSecondary">Remaining: {(repeatTotal - repeatUsed).toLocaleString()}</Typography>
                                                                    </Grid>
                                                                </Grid>
                                                            </Paper>
                                                        );
                                                    })
                                                }
                                            </Box>
                                        );
                                    }

                                    return (
                                        <Box>
                                            <Grid container spacing={4} sx={{ mt: 1 }}>
                                                {/* Stitches */}
                                                <Grid item xs={12} md={4}>
                                                    <Paper elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', borderTop: '4px solid #1976d2' }}>
                                                        <Typography variant="subtitle1" fontWeight="bold">Total Stitches</Typography>
                                                        <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                                                            <Typography variant="h4" color="primary">{stitchPercent.toFixed(1)}%</Typography>
                                                        </Box>
                                                        <LinearProgress variant="determinate" value={stitchPercent} sx={{ height: 10, borderRadius: 5, mb: 1 }} />
                                                        <Typography variant="body2" color="textSecondary">
                                                            {grandUsedStitch.toLocaleString()} / {grandTotalStitch.toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" color="error">
                                                            Remaining: {(grandTotalStitch - grandUsedStitch).toLocaleString()}
                                                        </Typography>
                                                    </Paper>
                                                </Grid>

                                                {/* Repeats */}
                                                <Grid item xs={12} md={4}>
                                                    <Paper elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', borderTop: '4px solid #9c27b0' }}>
                                                        <Typography variant="subtitle1" fontWeight="bold">Total Repeats</Typography>
                                                        <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                                                            <Typography variant="h4" color="secondary">{repeatPercent.toFixed(1)}%</Typography>
                                                        </Box>
                                                        <LinearProgress variant="determinate" value={repeatPercent} color="secondary" sx={{ height: 10, borderRadius: 5, mb: 1 }} />
                                                        <Typography variant="body2" color="textSecondary">
                                                            {grandUsedRepeat.toLocaleString()} / {grandTotalRepeat.toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" color="error">
                                                            Remaining: {(grandTotalRepeat - grandUsedRepeat).toLocaleString()}
                                                        </Typography>
                                                    </Paper>
                                                </Grid>

                                                {/* Days */}
                                                <Grid item xs={12} md={4}>
                                                    <Paper elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', borderTop: '4px solid #ed6c02' }}>
                                                        <Typography variant="subtitle1" fontWeight="bold">Time Schedule</Typography>
                                                        <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                                                            <Typography variant="h4" color="warning.main">{daysLeft} Days</Typography>
                                                        </Box>
                                                        <Typography variant="body2" display="block" gutterBottom>Remaining</Typography>
                                                        <LinearProgress variant="determinate" value={timePercent} color={timePercent > 100 ? "error" : "warning"} sx={{ height: 10, borderRadius: 5, mb: 1 }} />
                                                        <Typography variant="body2" color="textSecondary">
                                                            {elapsed} / {duration} Days Elapsed ({timePercent.toFixed(0)}%)
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            </Grid>

                                            <Divider sx={{ my: 3 }} />
                                            <Typography variant="h6" gutterBottom>Item Breakdown</Typography>

                                            {/* Detailed Item Progress */}
                                            {
                                                viewContract.items?.map((item, index) => {
                                                    const stitch = Number(item.stitch || 0);
                                                    const pieces = Number(item.pieces || 0);
                                                    const stitchTotal = stitch * pieces;

                                                    const stitchUsed = item.usedStitches || 0;
                                                    const stitchP = stitchTotal > 0 ? Math.min(100, (stitchUsed / stitchTotal) * 100) : 0;

                                                    const repeatTotal = Number(item.repeat || 0);
                                                    const repeatUsed = item.usedRepeats || 0;
                                                    const repeatP = repeatTotal > 0 ? Math.min(100, (repeatUsed / repeatTotal) * 100) : 0;

                                                    return (
                                                        <Paper key={index} sx={{ mb: 2, p: 2 }}>
                                                            <Typography variant="subtitle2" gutterBottom>Item #{index + 1}: {item.itemDescription}</Typography>
                                                            <Grid container spacing={3}>
                                                                {/* Stitches */}
                                                                <Grid item xs={12} md={6}>
                                                                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                                        <Typography variant="caption" fontWeight="bold">Stitches Progress</Typography>
                                                                        <Typography variant="caption">{stitchUsed.toLocaleString()} / {stitchTotal.toLocaleString()} ({stitchP.toFixed(1)}%)</Typography>
                                                                    </Box>
                                                                    <LinearProgress variant="determinate" value={stitchP} color={stitchP >= 100 ? "success" : "primary"} sx={{ height: 8, borderRadius: 4 }} />
                                                                    <Typography variant="caption" color="textSecondary">Remaining: {(stitchTotal - stitchUsed).toLocaleString()}</Typography>
                                                                </Grid>

                                                                {/* Repeats */}
                                                                <Grid item xs={12} md={6}>
                                                                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                                        <Typography variant="caption" fontWeight="bold">Repeats Progress</Typography>
                                                                        <Typography variant="caption">{repeatUsed.toLocaleString()} / {repeatTotal.toLocaleString()} ({repeatP.toFixed(1)}%)</Typography>
                                                                    </Box>
                                                                    <LinearProgress variant="determinate" value={repeatP} color={repeatP >= 100 ? "success" : "secondary"} sx={{ height: 8, borderRadius: 4 }} />
                                                                    <Typography variant="caption" color="textSecondary">Remaining: {(repeatTotal - repeatUsed).toLocaleString()}</Typography>
                                                                </Grid>
                                                            </Grid>
                                                        </Paper>
                                                    );
                                                })
                                            }
                                        </Box>
                                    );
                                })()}
                            </Box>

                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setViewContract(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
};

export default ContractProgress;
