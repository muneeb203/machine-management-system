import React, { useState } from 'react';
import { Grid, Autocomplete, TextField, Button, Box, Typography, Chip, Divider, Alert } from '@mui/material';
import { Add } from '@mui/icons-material';

interface MachineSelectorProps {
    machinesList: any[];
    mastersList?: any[];
    assignedMachines: Array<{ machineId: number; machineNumber: string | number; masterName: string; gazana?: string; assignedStitches?: number; avgStitchesPerDay?: number; repeats?: number; estimatedDays?: number }>; // Updated
    onChange: (newMachines: Array<{ machineId: number; machineNumber: string | number; masterName: string; gazana?: string; assignedStitches?: number; avgStitchesPerDay?: number; repeats?: number; estimatedDays?: number }>) => void; // Updated
    totalItemStitches: number;
    itemStitchPerRepeat?: number; // New Prop
    isLoading?: boolean;
}

const ContractItemMachineSelector: React.FC<MachineSelectorProps> = ({ machinesList, mastersList, assignedMachines, onChange, totalItemStitches, itemStitchPerRepeat, isLoading }) => {
    const [selectedMaster, setSelectedMaster] = useState<string | null>(null);
    const [selectedMachine, setSelectedMachine] = useState<any | null>(null);

    // Initial Stitches Default helper
    const getDefaultStitches = () => {
        return 0;
    };

    const handleAddMachine = () => {
        if (selectedMachine) {
            // Prevent duplicates
            if (assignedMachines.some(m => m.machineId === selectedMachine.id)) {
                alert("Machine already assigned to this item.");
                return;
            }
            const newEntry = {
                machineId: selectedMachine.id,
                machineNumber: selectedMachine.machineNumber,
                masterName: selectedMachine.masterName,
                gazana: selectedMachine.gazanaMachine || '-',
                assignedStitches: getDefaultStitches(),
                avgStitchesPerDay: 0, // Default
                repeats: 0, // Default
                estimatedDays: 0 // Default
            };
            onChange([...assignedMachines, newEntry]);
            setSelectedMachine(null);
        }
    };

    const handleRemoveMachine = (machineId: number) => {
        onChange(assignedMachines.filter(m => m.machineId !== machineId));
    };

    const handleStitchChange = (machineId: number, newValue: string) => {
        const baseVal = parseFloat(newValue) || 0;
        const updated = assignedMachines.map(m => {
            if (m.machineId === machineId) {
                const totalStiches = baseVal * (m.repeats || 0);
                const estDays = (m.avgStitchesPerDay && m.avgStitchesPerDay > 0) ? (totalStiches / m.avgStitchesPerDay) : 0;
                return {
                    ...m,
                    assignedStitches: totalStiches,
                    estimatedDays: estDays
                };
            }
            return m;
        });
        onChange(updated);
    };

    const handleRepeatsChange = (machineId: number, newValue: string) => {
        const repeatVal = parseFloat(newValue) || 0;
        const updated = assignedMachines.map(m => {
            if (m.machineId === machineId) {
                // Determine current base stitches per repeat
                const baseToUse = itemStitchPerRepeat || 0;
                const currentBase = (m.repeats && m.repeats > 0)
                    ? (m.assignedStitches || 0) / m.repeats
                    : baseToUse;

                const totalStitches = currentBase * repeatVal;
                const estDays = (m.avgStitchesPerDay && m.avgStitchesPerDay > 0) ? (totalStitches / m.avgStitchesPerDay) : 0;

                return {
                    ...m,
                    repeats: repeatVal,
                    assignedStitches: totalStitches,
                    estimatedDays: estDays
                };
            }
            return m;
        });
        onChange(updated);
    };

    const handleAvgStitchesChange = (machineId: number, newValue: string) => {
        const val = parseFloat(newValue); // Allow empty or partial
        const avgStitches = isNaN(val) ? 0 : val;

        const updated = assignedMachines.map(m => {
            if (m.machineId === machineId) {
                const estDays = (avgStitches > 0) ? ((m.assignedStitches || 0) / avgStitches) : 0;
                return { ...m, avgStitchesPerDay: avgStitches, estimatedDays: estDays };
            }
            return m;
        });
        onChange(updated);
    };

    const totalAssigned = assignedMachines.reduce((sum, m) => sum + (m.assignedStitches || 0), 0);
    const totalEstimatedDays = assignedMachines.reduce((sum, m) => sum + Number(m.estimatedDays || 0), 0);
    const isTotalValid = Math.abs(totalAssigned - totalItemStitches) < 0.01;

    // Helper to check validity of a row
    const isRowValid = (m: any) => {
        return m.avgStitchesPerDay && m.avgStitchesPerDay > 0;
    };

    const uniqueMasters = (mastersList && mastersList.length > 0)
        ? mastersList.map((m: any) => m.Name).sort()
        : Array.from(new Set(machinesList?.map((m: any) => m.masterName).filter(Boolean))).sort();

    if (isLoading) {
        return <Typography sx={{ p: 2, color: 'text.secondary' }}>Loading machines...</Typography>;
    }

    if ((!machinesList || machinesList.length === 0) && (!mastersList || mastersList.length === 0)) {
        return (
            <Alert severity="warning" sx={{ mb: 1 }}>
                No machines or masters found. Please add masters and machines first.
            </Alert>
        );
    }

    return (
        <Grid container spacing={2}>
            {/* Selection Area */}
            <Grid item xs={12} md={5}>
                <Autocomplete
                    options={uniqueMasters}
                    value={selectedMaster}
                    onChange={(e, val: any) => {
                        setSelectedMaster(val);
                        setSelectedMachine(null);
                    }}
                    renderInput={(params) => <TextField {...params} label="Select Master" size="small" />}
                    noOptionsText="No Masters found"
                />
            </Grid>
            <Grid item xs={12} md={5}>
                <Autocomplete
                    options={machinesList.filter(m =>
                        (m.masterName || '').trim().toLowerCase() === (selectedMaster || '').trim().toLowerCase()
                    )}
                    disabled={!selectedMaster}
                    getOptionLabel={(option: any) => `Machine No ${option.machineNumber} (Gazana: ${option.gazanaMachine})`}
                    value={selectedMachine}
                    onChange={(e, val) => setSelectedMachine(val)}
                    renderInput={(params) => <TextField {...params} label="Select Machine" size="small" />}
                    noOptionsText={!selectedMaster ? "Select a master first" : "No machines available"}
                />
            </Grid>
            <Grid item xs={12} md={2}>
                <Button
                    variant="contained"
                    size="medium"
                    onClick={handleAddMachine}
                    disabled={!selectedMachine}
                    startIcon={<Add />}
                    fullWidth
                    sx={{ height: '40px' }}
                >
                    Add
                </Button>
            </Grid>

            {/* Allocation Table */}
            < Grid item xs={12} >
                <Box sx={{ mt: 2, border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ bgcolor: '#f5f5f5', p: 1, px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" fontWeight="bold">Allocation Table</Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="caption">Item Total: <strong>{totalItemStitches.toLocaleString()}</strong></Typography>
                            <Chip
                                label={`Assigned: ${totalAssigned.toLocaleString()}`}
                                color={isTotalValid ? "success" : "error"}
                                variant={isTotalValid ? "filled" : "outlined"}
                                size="small"
                            />
                            {totalItemStitches - totalAssigned !== 0 && (
                                <Chip
                                    label={`Remaining: ${(totalItemStitches - totalAssigned).toLocaleString()}`}
                                    color={totalItemStitches - totalAssigned > 0 ? "warning" : "error"}
                                    variant="outlined"
                                    size="small"
                                />
                            )}
                            {assignedMachines.length > 0 && (
                                <TextField
                                    size="small"
                                    label="Total Estimated Days"
                                    value={Number(totalEstimatedDays).toFixed(2)}
                                    InputProps={{ readOnly: true }}
                                    sx={{ width: 160 }}
                                    variant="outlined"
                                />
                            )}
                        </Box>
                    </Box>

                    {assignedMachines.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">No machines assigned. Add a machine to allocate stitches.</Typography>
                        </Box>
                    ) : (
                        <Grid container sx={{ p: 1 }}>
                            <Grid item xs={1}><Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>#</Typography></Grid>
                            <Grid item xs={3}><Typography variant="caption" color="text.secondary">Machine Info</Typography></Grid>
                            <Grid item xs={2}><Typography variant="caption" color="text.secondary">Gazana</Typography></Grid>
                            <Grid item xs={2}><Typography variant="caption" color="text.secondary">Assigned Stitches</Typography></Grid>
                            <Grid item xs={2}><Typography variant="caption" color="text.secondary">No. of Repeats</Typography></Grid>
                            <Grid item xs={2}><Typography variant="caption" color="text.secondary">Avg Stitches per day *</Typography></Grid>
                            <Grid item xs={2}><Typography variant="caption" color="text.secondary">Actions</Typography></Grid>

                            <Grid item xs={12}><Box sx={{ my: 1 }}><Divider /></Box></Grid>

                            {assignedMachines.map((m, idx) => (
                                <React.Fragment key={m.machineId}>
                                    <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
                                        <Typography variant="body2" fontWeight="bold">{idx + 1}</Typography>
                                    </Grid>
                                    <Grid item xs={3} sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Box>
                                            <Typography variant="body2" fontWeight="medium">Machine {m.machineNumber}</Typography>
                                            <Typography variant="caption" color="text.secondary">Master: {m.masterName}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Chip label={m.gazana || '-'} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.75rem' }} />
                                    </Grid>
                                    <Grid item xs={2} sx={{ px: 1 }}>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={m.repeats && m.repeats > 0 ? (m.assignedStitches ?? 0) / m.repeats : (itemStitchPerRepeat || 0)}
                                            placeholder="Stitches/Repeat"
                                            onChange={(e) => handleStitchChange(m.machineId, e.target.value)}
                                            helperText="Stitches per repeat"
                                        />
                                    </Grid>
                                    <Grid item xs={2} sx={{ px: 1 }}>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            value={m.repeats || ''}
                                            placeholder="Repeats"
                                            onChange={(e) => handleRepeatsChange(m.machineId, e.target.value)}
                                            InputProps={{ inputProps: { min: 0, step: 1 } }}
                                        />
                                        <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5, fontWeight: 'bold' }}>
                                            Total No of Stitches: {(m.assignedStitches || 0).toLocaleString()}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={2} sx={{ px: 1 }}>
                                        <TextField
                                            size="small"
                                            type="number"
                                            fullWidth
                                            required
                                            value={m.avgStitchesPerDay || ''}
                                            placeholder="Stitches/Day"
                                            onChange={(e) => handleAvgStitchesChange(m.machineId, e.target.value)}
                                            error={!isRowValid(m)}
                                            helperText={!isRowValid(m) ? "Required > 0" : ""}
                                            InputProps={{ inputProps: { min: 1, step: 1000 } }}
                                        />
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Estimated Days"
                                            value={Number(m.estimatedDays ?? 0).toFixed(2)}
                                            InputProps={{ readOnly: true }}
                                            sx={{ mt: 1 }}
                                            variant="outlined"
                                        />
                                    </Grid>
                                    <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Button size="small" color="error" onClick={() => handleRemoveMachine(m.machineId)}>Remove</Button>
                                    </Grid>
                                    <Grid item xs={12}><Box sx={{ my: 1, borderBottom: '1px dashed #eee' }} /></Grid>
                                </React.Fragment>
                            ))}
                        </Grid>
                    )}
                </Box>

                {
                    !isTotalValid && assignedMachines.length > 0 && (
                        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                            * Total allocated stitches must exactly match the Item Total Stitches ({totalItemStitches}).
                        </Typography>
                    )
                }
            </Grid >
        </Grid >
    );
};

export default ContractItemMachineSelector;
