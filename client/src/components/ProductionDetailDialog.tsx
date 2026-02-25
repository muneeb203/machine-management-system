import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    TextField,
    Typography,
    Box,
    Divider,
    IconButton,
    CircularProgress,
    MenuItem,
    Alert
} from '@mui/material';
import { Edit, Close, Save } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';

interface ProductionDetailDialogProps {
    open: boolean;
    entryId: number | null;
    onClose: () => void;
}

const ProductionDetailDialog: React.FC<ProductionDetailDialogProps> = ({ open, entryId, onClose }) => {
    const queryClient = useQueryClient();
    const [isEditMode, setIsEditMode] = useState(false);
    const [editFormData, setEditFormData] = useState({
        collectionName: '',
        dayShiftStitches: '0',
        nightShiftStitches: '0',
        rate: 0
    });
    const [serverError, setServerError] = useState<string | null>(null);

    // Fetch details
    const { data: entry, isLoading, refetch, error: fetchError } = useQuery(
        ['production-entry', entryId],
        () => api.get(`/api/production-master/${entryId}`).then(res => res.data.data),
        {
            enabled: !!entryId && open,
            onSuccess: (data) => {
                // Initialize form data
                if (data) {
                    setEditFormData({
                        collectionName: data.collection_name,
                        dayShiftStitches: data.day_shift_stitches,
                        nightShiftStitches: data.night_shift_stitches,
                        rate: data.rate_per_stitch
                    });
                }
            }
        }
    );

    // Mutation
    const updateMutation = useMutation(
        (payload: any) => api.put(`/api/production-master/${entryId}`, payload),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('production-master');
                queryClient.invalidateQueries('workloadSummary'); // Refresh Machine Registry produced/remaining
                refetch();
                setIsEditMode(false);
                setServerError(null);
            },
            onError: (err: any) => {
                setServerError(err.response?.data?.message || 'Failed to update entry');
            }
        }
    );

    const handleSave = () => {
        updateMutation.mutate({
            collectionName: editFormData.collectionName,
            dayShiftStitches: parseInt(editFormData.dayShiftStitches) || 0,
            nightShiftStitches: parseInt(editFormData.nightShiftStitches) || 0,
            rate: editFormData.rate
        });
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setServerError(null);
        // Reset form to current loaded data
        if (entry) {
            setEditFormData({
                collectionName: entry.collection_name,
                dayShiftStitches: entry.day_shift_stitches,
                nightShiftStitches: entry.night_shift_stitches,
                rate: entry.rate_per_stitch
            });
        }
    };

    // Derived Calc for Preview
    const dayVal = parseInt(editFormData.dayShiftStitches) || 0;
    const nightVal = parseInt(editFormData.nightShiftStitches) || 0;
    const totalStitches = dayVal + nightVal;
    const totalAmount = (totalStitches * editFormData.rate).toFixed(2);

    if (!open) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                    {isEditMode ? 'Edit Production Entry' : 'Production Details'}
                </Typography>
                {!isEditMode && (
                    <IconButton onClick={() => setIsEditMode(true)} color="primary">
                        <Edit />
                    </IconButton>
                )}
            </DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress />
                    </Box>
                ) : entry ? (
                    <Box>
                        {serverError && (
                            <Alert severity="error" sx={{ mb: 2 }}>{serverError}</Alert>
                        )}

                        {/* Header Info (Read-Only) */}
                        <Box sx={{ mb: 3, bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="caption" color="textSecondary">Production Date</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                        {new Date(entry.production_date).toLocaleDateString()}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="caption" color="textSecondary">Master Name</Typography>
                                    <Typography variant="body2" fontWeight="bold">{entry.MasterName}</Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="caption" color="textSecondary">Machine</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                        {entry.master_machine_number ? `No. ${entry.master_machine_number}` : (entry.MachineNumber || '-')}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="caption" color="textSecondary">Gazana</Typography>
                                    <Typography variant="body2" fontWeight="bold">{entry.gazana_machine || '-'}</Typography>
                                </Grid>
                            </Grid>
                        </Box>

                        <Divider sx={{ my: 2 }} >Work Details</Divider>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Collection"
                                    fullWidth
                                    value={isEditMode ? editFormData.collectionName : entry.collection_name}
                                    onChange={(e) => setEditFormData({ ...editFormData, collectionName: e.target.value })}
                                    InputProps={{ readOnly: !isEditMode }}
                                    variant={isEditMode ? 'outlined' : 'filled'}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Rate per Stitch"
                                    type="number"
                                    fullWidth
                                    value={editFormData.rate}
                                    onChange={(e) => setEditFormData({ ...editFormData, rate: parseFloat(e.target.value) })}
                                    InputProps={{ readOnly: !isEditMode }}
                                    variant={isEditMode ? 'outlined' : 'filled'}
                                    helperText="Rate used for billing calculation"
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <TextField
                                    label="Day Shift Stitches"
                                    type="number"
                                    fullWidth
                                    value={isEditMode ? editFormData.dayShiftStitches : entry.day_shift_stitches}
                                    onChange={(e) => setEditFormData({ ...editFormData, dayShiftStitches: e.target.value })}
                                    InputProps={{ readOnly: !isEditMode }}
                                    variant={isEditMode ? 'outlined' : 'filled'}
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <TextField
                                    label="Night Shift Stitches"
                                    type="number"
                                    fullWidth
                                    value={isEditMode ? editFormData.nightShiftStitches : entry.night_shift_stitches}
                                    onChange={(e) => setEditFormData({ ...editFormData, nightShiftStitches: e.target.value })}
                                    InputProps={{ readOnly: !isEditMode }}
                                    variant={isEditMode ? 'outlined' : 'filled'}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Total Stitches"
                                    fullWidth
                                    value={isEditMode ? totalStitches.toLocaleString() : entry.total_stitches.toLocaleString()}
                                    InputProps={{ readOnly: true }}
                                    sx={{ bgcolor: isEditMode ? 'action.hover' : 'transparent' }}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Total Amount"
                                    fullWidth
                                    value={isEditMode ? totalAmount : parseFloat(entry.total_amount).toFixed(2)}
                                    InputProps={{ readOnly: true }}
                                    sx={{ bgcolor: isEditMode ? '#e3f2fd' : 'transparent' }}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', color: 'text.secondary', fontSize: '0.75rem' }}>
                            <Typography variant="caption">Created: {new Date(entry.created_at).toLocaleString()}</Typography>
                            <Typography variant="caption">Last Updated: {new Date(entry.updated_at).toLocaleString()}</Typography>
                        </Box>

                    </Box>
                ) : (
                    <Box p={3} textAlign="center">
                        <Typography color="error" gutterBottom>Failed to load details.</Typography>
                        {(fetchError as any) && (
                            <Typography variant="caption" color="textSecondary">
                                {(fetchError as any).response?.data?.message || (fetchError as any).message || 'Unknown error'}
                            </Typography>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {isEditMode ? (
                    <>
                        <Button onClick={handleCancelEdit}>Cancel</Button>
                        <Button
                            onClick={handleSave}
                            variant="contained"
                            startIcon={<Save />}
                            disabled={updateMutation.isLoading}
                        >
                            Save Changes
                        </Button>
                    </>
                ) : (
                    <Button onClick={onClose}>Close</Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ProductionDetailDialog;
