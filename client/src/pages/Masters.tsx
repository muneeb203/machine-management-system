import React, { useState } from 'react';
import {
    Box,
    Typography,
    Grid,
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
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Chip,
    Alert,
} from '@mui/material';
import {
    AccountCircle,
    Edit as EditIcon,
    Add as AddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';

// --- Interfaces ---
interface Master {
    MasterID: number;
    Name: string;
    Age: number;
    ContactNumber: string;
    CNIC: string;
    Status: 'Active' | 'Inactive';
}

interface MasterFormData {
    name: string;
    age: string;
    contactNumber: string;
    cnic: string;
    status: string;
}

const Masters: React.FC = () => {
    const queryClient = useQueryClient();

    // -- State --
    const [openDialog, setOpenDialog] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formData, setFormData] = useState<MasterFormData>({
        name: '',
        age: '',
        contactNumber: '',
        cnic: '',
        status: 'Active',
    });
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // -- Data Fetching --
    const { data: masters, isLoading } = useQuery<Master[]>(
        'masters',
        async () => {
            const response = await api.get('/api/masters');
            return response.data?.data || [];
        }
    );

    // -- Mutations --
    const createMasterMutation = useMutation(
        (newMaster: any) => api.post('/api/masters', newMaster),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('masters');
                setNotification({ message: 'Master registered successfully!', type: 'success' });
                setTimeout(() => handleCloseDialog(), 1500);
            },
            onError: (error: any) => {
                setNotification({
                    message: error.response?.data?.message || 'Failed to register master',
                    type: 'error'
                });
            }
        }
    );

    const updateMasterMutation = useMutation(
        ({ id, data }: { id: number, data: any }) => api.put(`/api/masters/${id}`, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('masters');
                setNotification({ message: 'Master updated successfully!', type: 'success' });
                setTimeout(() => handleCloseDialog(), 1500);
            },
            onError: (error: any) => {
                setNotification({
                    message: error.response?.data?.message || 'Failed to update master',
                    type: 'error'
                });
            }
        }
    );

    // -- Handlers --
    const handleOpenAddDialog = () => {
        setFormData({ name: '', age: '', contactNumber: '', cnic: '', status: 'Active' });
        setIsEditing(false);
        setEditId(null);
        setOpenDialog(true);
        setNotification(null);
    };

    const handleOpenEditDialog = (master: Master) => {
        setFormData({
            name: master.Name,
            age: master.Age.toString(),
            contactNumber: master.ContactNumber,
            cnic: master.CNIC,
            status: master.Status,
        });
        setIsEditing(true);
        setEditId(master.MasterID);
        setOpenDialog(true);
        setNotification(null);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setIsEditing(false);
        setEditId(null);
        setNotification(null);
    };

    const handleSubmit = () => {
        if (!formData.name || !formData.age || !formData.contactNumber || !formData.cnic) {
            setNotification({ message: 'All fields are required.', type: 'error' });
            return;
        }

        const payload = {
            name: formData.name,
            age: parseInt(formData.age),
            contactNumber: formData.contactNumber,
            cnic: formData.cnic,
            status: formData.status
        };

        if (isEditing && editId) {
            updateMasterMutation.mutate({ id: editId, data: payload });
        } else {
            createMasterMutation.mutate(payload);
        }
    };

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Master Management
                    </Typography>
                    <Typography variant="body1" color="textSecondary">
                        Manage machine operators and masters.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleOpenAddDialog}
                >
                    Register Master
                </Button>
            </Box>

            {/* Master List */}
            <Card>
                <CardContent>
                    <TableContainer component={Paper} elevation={0} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Age</TableCell>
                                    <TableCell>Contact</TableCell>
                                    <TableCell>CNIC</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} align="center">Loading...</TableCell></TableRow>
                                ) : masters?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">No masters found. Add one to get started.</TableCell>
                                    </TableRow>
                                ) : (
                                    masters?.map((master) => (
                                        <TableRow key={master.MasterID} hover>
                                            <TableCell>
                                                <Box display="flex" alignItems="center">
                                                    <AccountCircle sx={{ mr: 1, color: 'action.active' }} />
                                                    <Typography fontWeight="bold">{master.Name}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>{master.Age}</TableCell>
                                            <TableCell>{master.ContactNumber}</TableCell>
                                            <TableCell>{master.CNIC}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={master.Status}
                                                    size="small"
                                                    color={master.Status === 'Active' ? 'success' : 'default'}
                                                    variant={master.Status === 'Active' ? 'filled' : 'outlined'}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small" color="primary" onClick={() => handleOpenEditDialog(master)}>
                                                    <EditIcon />
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

            {/* Add/Edit Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{isEditing ? 'Edit Master Details' : 'Register New Master'}</DialogTitle>
                <DialogContent>
                    {notification && (
                        <Alert severity={notification.type} sx={{ mb: 2 }}>{notification.message}</Alert>
                    )}

                    <Box component="form" sx={{ mt: 1 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Full Name"
                                    fullWidth
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Age"
                                    type="number"
                                    fullWidth
                                    required
                                    value={formData.age}
                                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Contact Number"
                                    fullWidth
                                    required
                                    value={formData.contactNumber}
                                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="CNIC"
                                    fullWidth
                                    required
                                    value={formData.cnic}
                                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                                    helperText="Must be unique"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Status"
                                    select
                                    fullWidth
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <MenuItem value="Active">Active</MenuItem>
                                    <MenuItem value="Inactive">Inactive</MenuItem>
                                </TextField>
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" color="primary">
                        {isEditing ? 'Update Master' : 'Register Master'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Masters;
