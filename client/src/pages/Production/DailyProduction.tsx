import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Typography,
    Box,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    TextField,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Alert,
    Tooltip,
    LinearProgress,
    Snackbar
} from '@mui/material';
import {
    Engineering,
    Add,
    AddCircle,
    Today,
    NightsStay,
    WbSunny,
    Info,
    Edit as EditIcon,
    Cancel,
    Save
} from '@mui/icons-material';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../../apiClient';
import { useAuth } from '../../contexts/AuthContext';

// Interfaces based on new schema
interface ProductionEntry {
    id: number;
    machine: {
        id: number;
        machineNumber: number;
        masterName: string;
        masterMachineNumber?: number; // Added
    };
    contract: {
        contractNo: number;
        poNumber: string;
    };
    item: {
        id: number;
        description: string;
        color: string;
    };
    shift: string;
    stitches: number;
    repeats: number;
    operatorName: string;
    notes: string;
}

interface ContractItemOption {
    ContractItemID: number;
    ContractNo: number;
    PONumber: string;
    Collection: string; // Collection name
    ItemDescription: string;
    Fabric?: string;    // Fabric type (optional for older data)
    Color: string;
    Stitch: string;     // Total Planned
    Repeat: number;     // Total Planned
    UsedStitches: number; // Already produced
    UsedRepeats: number;  // Already produced
    machinePending?: string; // Per‑machine pending stitches
}

const DailyProduction: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // --- State ---
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const [createGatepassDialog, setCreateGatepassDialog] = useState(false);
    const [savedProductionData, setSavedProductionData] = useState<any>(null);

    const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Form State
    const [newEntry, setNewEntry] = useState({
        machineId: '',
        contractItemId: '',
        shift: '',
        stitches: '',
        repeats: '',
        operatorName: user?.username || '',
        notes: '',
    });


    // Edit State
    const [editEntry, setEditEntry] = useState<any>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Temp Contract State
    const [openTempDialog, setOpenTempDialog] = useState(false);
    const [tempFormData, setTempFormData] = useState({
        contractDate: new Date().toISOString().split('T')[0],
        poNumber: '',
        collection: '',
        itemDescription: 'TEMP ITEM',
        stitch: '',
        pieces: ''
    });

    const queryClient = useQueryClient();

    // --- Data Fetching ---

    // 1. Daily Production
    const { data: dailyProduction, isLoading } = useQuery(
        ['daily-production', selectedDate],
        async () => {
            const response = await api.get(`/api/production/daily/${selectedDate}`);
            return response.data?.data || [];
        }
    );

    // 2. Machines (Active only)
    const { data: machines } = useQuery('machines', async () => {
        const response = await api.get('/api/machines');
        // Filter active machines if needed, passing all for now
        return response.data?.data?.filter((m: any) => m.isActive) || [];
    });

    // 3. Contracts by machine (backend-filtered) - re-fetches when machine changes
    const { data: contractItemsByMachine } = useQuery(
        ['contracts-by-machine', newEntry.machineId],
        async () => {
            const response = await api.get(`/api/production/contracts/by-machine/${newEntry.machineId}`);
            return response.data?.data || [];
        },
        { enabled: !!newEntry.machineId }
    );

    const contractItems = contractItemsByMachine ?? [];

    // --- Helpers for Summary & Validation ---

    const getSelectedContractItem = () => {
        if (!newEntry.contractItemId) return null;
        return contractItems?.find((c: ContractItemOption) => c.ContractItemID === Number(newEntry.contractItemId));
    };

    const selectedItem = getSelectedContractItem();

    // Machine-specific limit parsing
    let machineLimit = null;
    if (selectedItem && newEntry.machineId && selectedItem.machinePending) {
        const mappings = selectedItem.machinePending.split(',');
        const match = mappings.find((m: string) => m.startsWith(`${newEntry.machineId}:`));
        if (match) {
            machineLimit = Number(match.split(':')[1] || 0);
        }
    }

    const maxStitches = selectedItem ? parseFloat(selectedItem.Stitch || '0') : 0;
    const usedStitches = selectedItem ? selectedItem.UsedStitches : 0;
    const remainingGlobal = Math.max(0, maxStitches - usedStitches);

    // If machine limit exists, it's the more restrictive one
    const remainingStitches = machineLimit !== null ? Math.min(remainingGlobal, machineLimit) : remainingGlobal;

    const maxRepeats = selectedItem ? Number(selectedItem.Repeat || 0) : 0;
    const usedRepeats = selectedItem ? selectedItem.UsedRepeats : 0;
    const remainingRepeats = Math.max(0, maxRepeats - usedRepeats);

    // Validation Warnings
    const stitchInput = Number(newEntry.stitches);
    const repeatInput = Number(newEntry.repeats);

    // --- Mutations ---

    const createEntryMutation = useMutation(
        (entry: any) => api.post('/api/production/entry', {
            ...entry,
            productionDate: selectedDate,
            machineId: parseInt(entry.machineId),
            contractItemId: parseInt(entry.contractItemId),
            stitches: parseInt(entry.stitches),
            repeats: entry.repeats ? parseInt(entry.repeats) : 0,
        }),
        {
            onSuccess: (response, variables) => {
                queryClient.invalidateQueries(['daily-production', selectedDate]);
                queryClient.invalidateQueries(['contracts-by-machine', variables.machineId]);
                queryClient.invalidateQueries('workloadSummary'); // Refresh Machine Registry produced/remaining
                
                // Store production data for potential gatepass creation
                const selectedContractItem = contractItems?.find(
                    (c: ContractItemOption) => c.ContractItemID === Number(variables.contractItemId)
                );
                
                setSavedProductionData({
                    productionDate: selectedDate,
                    contractNo: selectedContractItem?.ContractNo,
                    poNumber: selectedContractItem?.PONumber,
                    collection: selectedContractItem?.Collection,
                    itemDescription: selectedContractItem?.ItemDescription,
                    color: selectedContractItem?.Color,
                    stitches: variables.stitches,
                    repeats: variables.repeats,
                    shift: variables.shift,
                    operatorName: variables.operatorName,
                    notes: variables.notes
                });
                
                // Show create gatepass dialog
                setCreateGatepassDialog(true);
                
                setNewEntry({
                    machineId: '',
                    contractItemId: '',
                    shift: '',
                    stitches: '',
                    repeats: '',
                    operatorName: user?.username || '',
                    notes: '',
                });
                setSnackbar({ open: true, message: 'Production entry added successfully', severity: 'success' });
            },
            onError: (err: any) => {
                setSnackbar({
                    open: true,
                    message: err.response?.data?.message || err.response?.data?.error || 'Failed to add entry',
                    severity: 'error'
                });
            }
        }
    );

    const updateEntryMutation = useMutation(
        (entry: any) => api.put(`/api/production/${entry.id}`, {
            ...entry,
            stitches: parseInt(entry.stitches),
            repeats: entry.repeats ? parseInt(entry.repeats) : 0,
        }),
        {
            onSuccess: (_data, variables) => {
                queryClient.invalidateQueries(['daily-production', selectedDate]);
                if (variables?.machineId) queryClient.invalidateQueries(['contracts-by-machine', variables.machineId]);
                queryClient.invalidateQueries('workloadSummary'); // Refresh Machine Registry
                setIsEditOpen(false);
                setEditEntry(null);
                setSnackbar({ open: true, message: 'Production entry updated successfully', severity: 'success' });
            },
            onError: (err: any) => {
                setSnackbar({
                    open: true,
                    message: err.response?.data?.message || err.response?.data?.error || 'Failed to update entry',
                    severity: 'error'
                });
            }
        }
    );

    const createTempContractMutation = useMutation(
        (data: any) => api.post('/api/contracts/temp', data),
        {
            onSuccess: (response: any) => { // Type response if possible
                queryClient.invalidateQueries('contract-items');
                setOpenTempDialog(false);
                setTempFormData({
                    contractDate: new Date().toISOString().split('T')[0],
                    poNumber: '',
                    collection: '',
                    itemDescription: 'TEMP ITEM',
                    stitch: '',
                    pieces: ''
                });

                // Auto-select the new item if returned
                if (response?.data?.data?.contractItemId) {
                    setNewEntry(prev => ({ ...prev, contractItemId: String(response.data.data.contractItemId) }));
                }
                setSnackbar({ open: true, message: 'Temporary contract created successfully', severity: 'success' });
            },
            onError: (error: any) => {
                setSnackbar({
                    open: true,
                    message: `Failed to create temp contract: ${error.response?.data?.error?.message || error.message}`,
                    severity: 'error'
                });
            }
        }
    );

    // --- Handlers ---

    const handleSubmit = () => {
        createEntryMutation.mutate(newEntry);
    };

    const handleCreateGatepassYes = () => {
        setCreateGatepassDialog(false);
        
        // Navigate to gate passes page with pre-filled data
        navigate('/gate-passes', {
            state: {
                fromProduction: true,
                productionData: savedProductionData
            }
        });
    };

    const handleCreateGatepassNo = () => {
        setCreateGatepassDialog(false);
        setSavedProductionData(null);
    };

    const handleEditClick = (entry: ProductionEntry) => {
        setEditEntry({
            id: entry.id,
            machineId: entry.machine.id, // For display/ref mainly, editing machine might be restricted or simple
            contractItemId: entry.item.id,
            shift: entry.shift,
            stitches: entry.stitches,
            repeats: entry.repeats,
            operatorName: entry.operatorName,
            notes: entry.notes || ''
        });
        setIsEditOpen(true);
    };

    const handleUpdate = () => {
        console.log('Updating entry:', editEntry);
        updateEntryMutation.mutate(editEntry);
    };

    const getShiftColor = (shift: string) => (shift === 'Day' || shift === 'day' ? 'warning' : 'info');
    const getShiftIcon = (shift: string) => (shift === 'Day' || shift === 'day' ? <WbSunny fontSize="small" /> : <NightsStay fontSize="small" />);

    // Calculate totals
    const dayShiftStitches = dailyProduction?.filter((e: any) => e.shift === 'Day' || e.shift === 'day')
        .reduce((sum: number, e: any) => sum + (e.stitches || 0), 0) || 0;

    const nightShiftStitches = dailyProduction?.filter((e: any) => e.shift === 'Night' || e.shift === 'night')
        .reduce((sum: number, e: any) => sum + (e.stitches || 0), 0) || 0;

    const totalStitches = dayShiftStitches + nightShiftStitches;

    if (isLoading) return <Typography sx={{ p: 4 }
    } > Loading production data...</Typography >;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Daily Production
            </Typography>
            <Typography variant="body1" color="textSecondary" gutterBottom>
                Record daily machine output linked to contracts.
            </Typography>

            {/* Date & Summary */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={3} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                label="Production Date"
                                type="date"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Box display="flex" alignItems="center">
                                <WbSunny color="warning" sx={{ mr: 1 }} />
                                <Box>
                                    <Typography variant="h6">{dayShiftStitches.toLocaleString()}</Typography>
                                    <Typography variant="caption" color="textSecondary">Day Shift</Typography>
                                </Box>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Box display="flex" alignItems="center">
                                <NightsStay color="info" sx={{ mr: 1 }} />
                                <Box>
                                    <Typography variant="h6">{nightShiftStitches.toLocaleString()}</Typography>
                                    <Typography variant="caption" color="textSecondary">Night Shift</Typography>
                                </Box>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Box display="flex" alignItems="center">
                                <Today color="primary" sx={{ mr: 1 }} />
                                <Box>
                                    <Typography variant="h6">{totalStitches.toLocaleString()}</Typography>
                                    <Typography variant="caption" color="textSecondary">Total Stitches</Typography>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Add Entry Form */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Add Entry</Typography>
                    <Grid container spacing={2}>
                        {/* Machine */}
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Machine</InputLabel>
                                <Select
                                    value={newEntry.machineId}
                                    label="Machine"
                                    onChange={(e) => {
                                        const machineId = e.target.value;
                                        setNewEntry({ ...newEntry, machineId, contractItemId: '' });
                                    }}
                                >
                                    {machines?.map((m: any) => (
                                        <MenuItem key={m.id} value={m.id}>
                                            M.No: {m.masterMachineNumber || m.machineNumber} ({m.masterName})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Shift */}
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Shift</InputLabel>
                                <Select
                                    value={newEntry.shift}
                                    label="Shift"
                                    onChange={(e) => setNewEntry({ ...newEntry, shift: e.target.value })}
                                >
                                    <MenuItem value="Day">Day</MenuItem>
                                    <MenuItem value="Night">Night</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Contract Item - Only contracts assigned to selected machine (backend-filtered) */}
                        <Grid item xs={12} sm={12} md={8}>
                            <FormControl fullWidth>
                                <InputLabel>Contract Item / Collection</InputLabel>
                                <Select
                                    value={newEntry.contractItemId}
                                    label="Contract Item / Collection"
                                    onChange={(e) => setNewEntry({ ...newEntry, contractItemId: e.target.value })}
                                    displayEmpty
                                >
                                    {!newEntry.machineId ? (
                                        <MenuItem value="" disabled>
                                            Select machine first to see assigned contracts
                                        </MenuItem>
                                    ) : contractItems.length === 0 ? (
                                        <MenuItem value="" disabled>
                                            No contracts assigned to this machine
                                        </MenuItem>
                                    ) : (
                                        contractItems.map((c: ContractItemOption) => (
                                            <MenuItem key={c.ContractItemID} value={c.ContractItemID}>
                                                #{c.ContractNo} — {c.Collection || '-'} — {c.ItemDescription}
                                                {` — ${c.Fabric || '-'} — ${c.Color || '-'}`}
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>
                            {selectedItem && (
                                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>
                                    Plan: {maxStitches.toLocaleString()} St |
                                    Global Rem: {remainingGlobal.toLocaleString()} St |
                                    Global Rem Reps: {remainingRepeats.toLocaleString()}
                                    {machineLimit !== null && ` | Machine Rem: ${machineLimit.toLocaleString()} St`}
                                </Typography>
                            )}
                        </Grid>

                        {/* Stitches */}
                        <Grid item xs={6} sm={4} md={4}>
                            <TextField
                                label="Stitches"
                                type="number"
                                fullWidth
                                value={newEntry.stitches}
                                onChange={(e) => setNewEntry({ ...newEntry, stitches: e.target.value })}
                            />
                        </Grid>

                        {/* Repeats */}
                        <Grid item xs={6} sm={4} md={4}>
                            <TextField
                                label="Repeats"
                                type="number"
                                fullWidth
                                value={newEntry.repeats}
                                onChange={(e) => setNewEntry({ ...newEntry, repeats: e.target.value })}
                            />
                        </Grid>

                        {/* Submit */}
                        <Grid item xs={12} sm={4} md={4}>
                            <Button
                                variant="contained"
                                color="primary"
                                fullWidth
                                sx={{ height: '56px' }}
                                startIcon={<AddCircle />}
                                onClick={handleSubmit}
                                disabled={!newEntry.machineId || !newEntry.contractItemId || !newEntry.stitches}
                            >
                                Add
                            </Button>
                        </Grid>
                    </Grid>

                    {createEntryMutation.isError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {/* @ts-ignore */}
                            {createEntryMutation.error?.response?.data?.error || "Failed to add entry"}
                        </Alert>
                    )}

                </CardContent>
            </Card>

            {/* Production Table */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Entry List</Typography>
                    <TableContainer component={Paper} elevation={0} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Machine</TableCell>
                                    <TableCell>Shift</TableCell>
                                    <TableCell>Contract</TableCell>
                                    <TableCell>Item / Color</TableCell>
                                    <TableCell>Stitches</TableCell>
                                    <TableCell>Repeats</TableCell>
                                    <TableCell>Operator</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dailyProduction?.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} align="center">No entries for this date.</TableCell></TableRow>
                                ) : (
                                    dailyProduction?.map((entry: ProductionEntry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell>
                                                <Box display="flex" alignItems="center">
                                                    <Engineering sx={{ mr: 1, fontSize: 18, color: 'action.active' }} />
                                                    <Typography variant="body2" fontWeight="bold">M{entry.machine?.machineNumber}</Typography>
                                                    {entry.machine?.masterMachineNumber && (
                                                        <Typography variant="caption" sx={{ ml: 1, fontWeight: 'bold', color: 'primary.main' }}>
                                                            [M.No: {entry.machine?.masterMachineNumber}]
                                                        </Typography>
                                                    )}
                                                    <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                                                        ({entry.machine?.masterName})
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={getShiftIcon(entry.shift)}
                                                    label={entry.shift}
                                                    color={getShiftColor(entry.shift)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                #{entry.contract?.contractNo}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{entry.item?.description}</Typography>
                                                <Typography variant="caption" color="textSecondary">{entry.item?.color}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography fontWeight="bold">{entry.stitches?.toLocaleString()}</Typography>
                                            </TableCell>
                                            <TableCell>{entry.repeats}</TableCell>
                                            <TableCell>{entry.operatorName}</TableCell>
                                            <TableCell>
                                                <IconButton size="small" onClick={() => handleEditClick(entry)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Production Entry</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {editEntry && (
                            <>
                                <FormControl fullWidth>
                                    <InputLabel>Shift</InputLabel>
                                    <Select
                                        value={editEntry.shift}
                                        label="Shift"
                                        onChange={(e) => setEditEntry({ ...editEntry, shift: e.target.value })}
                                    >
                                        <MenuItem value="Day">Day</MenuItem>
                                        <MenuItem value="Night">Night</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Stitches"
                                    type="number"
                                    fullWidth
                                    value={editEntry.stitches}
                                    onChange={(e) => setEditEntry({ ...editEntry, stitches: e.target.value })}
                                />
                                <TextField
                                    label="Repeats"
                                    type="number"
                                    fullWidth
                                    value={editEntry.repeats}
                                    onChange={(e) => setEditEntry({ ...editEntry, repeats: e.target.value })}
                                />
                                <TextField
                                    label="Operator"
                                    fullWidth
                                    value={editEntry.operatorName}
                                    onChange={(e) => setEditEntry({ ...editEntry, operatorName: e.target.value })}
                                />
                                <TextField
                                    label="Notes"
                                    fullWidth
                                    multiline
                                    rows={2}
                                    value={editEntry.notes}
                                    onChange={(e) => setEditEntry({ ...editEntry, notes: e.target.value })}
                                />
                            </>
                        )}
                        {updateEntryMutation.isError && (
                            <Alert severity="error">
                                {/* @ts-ignore */}
                                {updateEntryMutation.error?.response?.data?.error || "Failed to update"}
                            </Alert>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsEditOpen(false)} startIcon={<Cancel />}>Cancel</Button>
                    <Button onClick={handleUpdate} variant="contained" startIcon={<Save />}>Save Changes</Button>
                </DialogActions>
            </Dialog>

            {/* Temp Contract Dialog */}
            <Dialog open={openTempDialog} onClose={() => setOpenTempDialog(false)}>
                <DialogTitle>Create Temporary Contract</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" mb={2} mt={1}>
                        Create a quick contract to start production immediately.
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                                value={tempFormData.contractDate}
                                onChange={(e) => setTempFormData({ ...tempFormData, contractDate: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="PO Number (Optional)" fullWidth
                                value={tempFormData.poNumber}
                                onChange={(e) => setTempFormData({ ...tempFormData, poNumber: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Collection (Optional)" fullWidth
                                value={tempFormData.collection}
                                onChange={(e) => setTempFormData({ ...tempFormData, collection: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Item Description" fullWidth
                                value={tempFormData.itemDescription}
                                onChange={(e) => setTempFormData({ ...tempFormData, itemDescription: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Stitch (Est)" fullWidth type="number"
                                value={tempFormData.stitch}
                                onChange={(e) => setTempFormData({ ...tempFormData, stitch: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Pieces (Est)" fullWidth type="number"
                                value={tempFormData.pieces}
                                onChange={(e) => setTempFormData({ ...tempFormData, pieces: e.target.value })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenTempDialog(false)} disabled={createTempContractMutation.isLoading}>Cancel</Button>
                    <Button onClick={() => createTempContractMutation.mutate({
                        contractDate: tempFormData.contractDate,
                        poNumber: tempFormData.poNumber,
                        collection: tempFormData.collection,
                        item: {
                            itemDescription: tempFormData.itemDescription,
                            stitch: tempFormData.stitch,
                            pieces: tempFormData.pieces
                        }
                    })} variant="contained" color="warning" disabled={createTempContractMutation.isLoading}>
                        {createTempContractMutation.isLoading ? 'Creating...' : 'Create Temp'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Gatepass Confirmation Dialog */}
            <Dialog 
                open={createGatepassDialog} 
                onClose={handleCreateGatepassNo}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Chip label="Success" color="success" size="small" />
                        <Typography variant="h6" component="span">
                            Daily Production Saved Successfully
                        </Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ py: 2 }}>
                        <Typography variant="body1" gutterBottom>
                            Do you want to create a gatepass for this production?
                        </Typography>
                        {savedProductionData && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Contract:</strong> {savedProductionData.contractNo || 'N/A'}
                                </Typography>
                                {savedProductionData.collection && (
                                    <Typography variant="body2" color="text.secondary">
                                        <strong>Collection:</strong> {savedProductionData.collection}
                                    </Typography>
                                )}
                                {savedProductionData.itemDescription && (
                                    <Typography variant="body2" color="text.secondary">
                                        <strong>Item:</strong> {savedProductionData.itemDescription}
                                    </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Quantity:</strong> {savedProductionData.repeats || 0} repeats / {savedProductionData.stitches || 0} stitches
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button 
                        onClick={handleCreateGatepassNo} 
                        variant="outlined"
                        color="inherit"
                    >
                        No
                    </Button>
                    <Button 
                        onClick={handleCreateGatepassYes} 
                        variant="contained"
                        color="primary"
                        autoFocus
                    >
                        Yes, Create Gatepass
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
};

export default DailyProduction;
