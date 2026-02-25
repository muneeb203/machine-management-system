import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
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
  Alert,
  Autocomplete, // Added
} from '@mui/material';
import {
  PrecisionManufacturing,
  PlayArrow,
  Pause,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Build,
  Stop,
  CheckCircle,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';
import { useAuth } from '../contexts/AuthContext';

// --- Interfaces ---

interface Machine {
  id: number;
  machineNumber: number;
  masterName: string;
  isActive: boolean;
  status: 'running' | 'idle' | 'maintenance' | 'stopped';
  gazanaMachine?: string;
  masterMachineNumber?: number; // NEW
}

interface WorkloadSummary {
  machineId: number;
  ongoingContractsCount: number;
  totalAssigned: number;
  totalPending: number;
  totalProduced: number;
  assignmentCount?: number;
  hasDelays: boolean;
}

interface WorkloadDetail {
  contractItemId: number;
  itemDescription: string;
  collection: string;
  contractNo: string;
  assigned_stitches: number;
  completed_stitches: number;
  pending_stitches: number;
  estimated_days?: number;
  days_left?: number | null;
  first_production_date: string | null;
  last_production_date: string | null;
  actual_days_used: number;
  status: 'Open' | 'Completed' | 'Delayed';
  on_time_status: 'On Time' | 'Delayed';
  completed_at: string | null;
}

interface MachineFormData {
  machineNumber: string | number;
  masterName: string;
  status: string;
  gazanaMachine: string;
  masterMachineNumber?: number; // NEW
}

const Machines: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // -- State --
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false); // NEW
  const [deleteId, setDeleteId] = useState<number | null>(null); // NEW
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<MachineFormData>({
    machineNumber: '',
    masterName: '',
    status: 'idle',
    gazanaMachine: '',
  });
  const [workloadModalOpen, setWorkloadModalOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [selectedMachineNum, setSelectedMachineNum] = useState<string>('');

  // -- Filter State --
  const [filterMaster, setFilterMaster] = useState<string | null>(null);
  const [filterGazana, setFilterGazana] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(''); // 'Open' | 'Completed' | ''

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // -- Data Fetching --
  // -- Data Fetching --
  const { data: machines, isLoading, refetch: refetchMachines } = useQuery<Machine[]>(
    ['machines', filterMaster, filterGazana, filterStatus],
    async () => {
      const params: any = {};
      if (filterMaster) params.master = filterMaster;
      if (filterGazana) params.gazana = filterGazana;
      if (filterStatus) params.status = filterStatus;

      const response = await api.get('/api/machines', { params });
      return response.data?.data || [];
    },
    { keepPreviousData: true }
  );

  // Fetch Gazanas for Dropdown
  const { data: gazanaList } = useQuery(
    'gazanaList',
    async () => {
      const response = await api.get('/api/machines/gazanas');
      return response.data?.data || [];
    }
  );

  // Fetch Masters for Dropdown
  const { data: masters } = useQuery(
    'mastersList',
    async () => {
      const response = await api.get('/api/masters');
      return response.data?.data || [];
    }
  );

  // Fetch Workload Summary
  const { data: workloadSummary, refetch: refetchWorkload } = useQuery<WorkloadSummary[]>(
    'workloadSummary',
    async () => {
      const response = await api.get('/api/machines/workload');
      return response.data?.data || [];
    }
  );

  // Fetch Detailed Workload for Modal
  const { data: machineWorkload, isLoading: isLoadingWorkload } = useQuery<WorkloadDetail[]>(
    ['machineWorkload', selectedMachineId],
    async () => {
      if (!selectedMachineId) return [];
      const response = await api.get(`/api/machines/${selectedMachineId}/workload`);
      return response.data?.data || [];
    },
    {
      enabled: !!selectedMachineId && workloadModalOpen,
    }
  );

  // -- Mutations --
  const createMachineMutation = useMutation(
    (newMachine: any) => api.post('/api/machines', newMachine),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('machines');
        setNotification({ message: 'Machine registered successfully!', type: 'success' });
        setTimeout(() => handleCloseDialog(), 1500);
      },
      onError: (error: any) => {
        setNotification({
          message: error.response?.data?.message || 'Failed to register machine',
          type: 'error'
        });
      }
    }
  );

  const updateMachineMutation = useMutation(
    ({ id, data }: { id: number, data: any }) => api.put(`/api/machines/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('machines');
        setNotification({ message: 'Machine updated successfully!', type: 'success' });
        setTimeout(() => handleCloseDialog(), 1500);
      },
      onError: (error: any) => {
        setNotification({
          message: error.response?.data?.message || 'Failed to update machine',
          type: 'error'
        });
      }
    }
  );

  const deleteMachineMutation = useMutation(
    (id: number) => api.delete(`/api/machines/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('machines');
        setNotification({ message: 'Machine deleted successfully!', type: 'success' });
        setOpenDeleteDialog(false);
        setDeleteId(null);
      },
      onError: (error: any) => {
        setNotification({
          message: error.response?.data?.message || 'Failed to delete machine',
          type: 'error'
        });
        setOpenDeleteDialog(false);
        setDeleteId(null);
      }
    }
  );

  // -- Handlers --

  const handleOpenAddDialog = async () => {
    try {
      const res = await api.get('/api/machines/next-number');
      const nextNum = res.data.nextNumber;
      setFormData({ machineNumber: nextNum, masterName: '', status: 'idle', gazanaMachine: '', masterMachineNumber: undefined });
      setIsEditing(false);
      setEditId(null);
      setOpenDialog(true);
      setNotification(null);
    } catch (err) {
      console.error('Failed to fetch next machine number', err);
      // Fallback or error handling
      setFormData({ machineNumber: '', masterName: '', status: 'idle', gazanaMachine: '', masterMachineNumber: undefined });
      setOpenDialog(true);
    }
  };

  const handleOpenEditDialog = (machine: Machine) => {
    setFormData({
      machineNumber: machine.machineNumber,
      masterName: machine.masterName,
      status: machine.status,
      gazanaMachine: machine.gazanaMachine || '',
      masterMachineNumber: machine.masterMachineNumber // NEW
    });
    setIsEditing(true);
    setEditId(machine.id);
    setOpenDialog(true);
    setNotification(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setIsEditing(false);
    setEditId(null);
    setNotification(null);
  };

  const onDeleteClick = (id: number) => {
    setDeleteId(id);
    setOpenDeleteDialog(true);
  };

  const onDeleteConfirm = () => {
    if (deleteId) {
      deleteMachineMutation.mutate(deleteId);
    }
  };

  const handleOpenWorkload = (machine: Machine) => {
    setSelectedMachineId(machine.id);
    setSelectedMachineNum(String(machine.machineNumber));
    setWorkloadModalOpen(true);
  };

  const handleCloseWorkload = () => {
    setWorkloadModalOpen(false);
    setSelectedMachineId(null);
  };

  const handleSubmit = () => {
    if (!formData.machineNumber || !formData.masterName) {
      setNotification({ message: 'Machine Number and Master Name are required.', type: 'error' });
      return;
    }

    const payload = {
      machineNumber: formData.machineNumber, // No parseInt
      masterName: formData.masterName,
      status: formData.status,
      gazanaMachine: formData.gazanaMachine
    };

    if (isEditing && editId) {
      updateMachineMutation.mutate({ id: editId, data: payload });
    } else {
      createMachineMutation.mutate(payload);
    }
  };

  // -- Helpers --

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'idle': return 'warning';
      case 'maintenance': return 'error';
      case 'stopped': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <PlayArrow fontSize="small" />;
      case 'idle': return <Pause fontSize="small" />;
      case 'maintenance': return <Build fontSize="small" />;
      case 'stopped': return <Stop fontSize="small" />;
      default: return undefined; // Fixed: return undefined instead of null
    }
  };

  const handleResetFilters = () => {
    setFilterMaster(null);
    setFilterGazana(null);
    setFilterStatus('');
  };

  if (isLoading) {
    return <Typography sx={{ p: 4 }}>Loading machines...</Typography>;
  }

  // Basic Metrics
  const totalMachines = machines?.length || 0;
  const runningMachines = machines?.filter(m => m.status === 'running').length || 0;
  const maintenanceMachines = machines?.filter(m => m.status === 'maintenance').length || 0;
  const idleMachines = machines?.filter(m => m.status === 'idle').length || 0;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Machine Management
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Master list of all embroidery machines.
          </Typography>
        </Box>
        {user?.role === 'admin' && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
          >
            Register Machine
          </Button>
        )}
      </Box>

      {/* Filter Panel */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Autocomplete
              options={masters || []}
              getOptionLabel={(option: any) => option.Name || ''}
              value={masters?.find((m: any) => m.Name === filterMaster) || null}
              onChange={(_, newValue: any) => setFilterMaster(newValue ? newValue.Name : null)}
              renderInput={(params) => <TextField {...params} label="Filter by Master" size="small" />}
            />
          </Box>
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <Autocomplete
              options={gazanaList || []}
              getOptionLabel={(option: string) => option}
              value={filterGazana}
              onChange={(_, newValue: string | null) => setFilterGazana(newValue)}
              renderInput={(params) => <TextField {...params} label="Filter by Gazana" size="small" />}
            />
          </Box>
          <Box sx={{ minWidth: 200, flex: 1 }}>
            <TextField
              select
              label="Details Status"
              size="small"
              fullWidth
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="Open">Open (Pending Work)</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
            </TextField>
          </Box>
          <Button variant="outlined" startIcon={<DeleteIcon />} onClick={handleResetFilters}>
            Reset
          </Button>
        </Box>
      </Card>

      {/* Global Notification */}
      {
        notification && (
          <Alert severity={notification.type} sx={{ mb: 3 }} onClose={() => setNotification(null)}>
            {notification.message}
          </Alert>
        )
      }

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PrecisionManufacturing color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="subtitle2">Total Machines</Typography>
                  <Typography variant="h4">{totalMachines}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircle color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="subtitle2">Running</Typography>
                  <Typography variant="h4">{runningMachines}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Build color="error" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="subtitle2">Maintenance</Typography>
                  <Typography variant="h4">{maintenanceMachines}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Pause color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="subtitle2">Idle/Stopped</Typography>
                  <Typography variant="h4">{idleMachines}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Machine List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Machine Registry
          </Typography>

          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Unique Id</TableCell>
                  <TableCell>Master Name</TableCell>
                  <TableCell>Master Machine #</TableCell>
                  <TableCell>Gazana</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Contracts Assigned</TableCell>
                  <TableCell align="center">Assigned Stitches</TableCell>
                  <TableCell align="center">Produced</TableCell>
                  <TableCell align="center">Remaining</TableCell>
                  <TableCell>Load</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {machines?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center">No machines found. Add one to get started.</TableCell>
                  </TableRow>
                ) : (
                  machines?.map((machine) => (
                    <TableRow key={machine.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PrecisionManufacturing sx={{ mr: 1, color: 'action.active' }} />
                          <Typography fontWeight="bold">{machine.machineNumber}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{machine.masterName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {machine.masterMachineNumber ? `Machine ${machine.masterMachineNumber}` : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{machine.gazanaMachine || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(machine.status)}
                          label={machine.status.toUpperCase()}
                          color={getStatusColor(machine.status)}
                          size="small"
                        />
                      </TableCell>
                      {(() => {
                        const summary = workloadSummary?.find(w => w.machineId === machine.id);
                        return (
                          <>
                            <TableCell align="center">{summary?.ongoingContractsCount ?? '-'}</TableCell>
                            <TableCell align="center">{summary?.totalAssigned?.toLocaleString() || '-'}</TableCell>
                            <TableCell align="center">{summary?.totalProduced?.toLocaleString() || '-'}</TableCell>
                            <TableCell align="center">{summary?.totalPending?.toLocaleString() || '-'}</TableCell>
                            <TableCell>
                              <Chip
                                label={summary?.hasDelays ? 'Delayed' : (summary?.totalPending || 0) > 0 ? 'Busy' : 'Open'}
                                color={summary?.hasDelays ? 'error' : (summary?.totalPending || 0) > 0 ? 'warning' : 'success'}
                                size="small"
                                onClick={() => handleOpenWorkload(machine)}
                                sx={{ cursor: 'pointer' }}
                              />
                            </TableCell>
                          </>
                        );
                      })()}
                      <TableCell>
                        <Chip
                          label={machine.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={machine.isActive ? 'success' : 'default'}
                          variant={machine.isActive ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenWorkload(machine)}
                          sx={{ mr: 1 }}
                        >
                          Workload
                        </Button>
                        {user?.role === 'admin' && (
                          <>
                            <IconButton size="small" color="primary" onClick={() => handleOpenEditDialog(machine)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => onDeleteClick(machine.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </>
                        )}
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
        <DialogTitle>{isEditing ? 'Edit Machine Details' : 'Register New Machine'}</DialogTitle>
        <DialogContent>

          <Box component="form" sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Machine Number"
                  type="text"
                  fullWidth
                  required
                  value={formData.machineNumber}
                  onChange={(e) => setFormData({ ...formData, machineNumber: e.target.value })}
                  helperText="Auto-generated ID"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={masters || []}
                  getOptionLabel={(option: any) => option.Name}
                  value={masters?.find((m: any) => m.Name === formData.masterName) || null}
                  onChange={(event, newValue: any) => {
                    setFormData({ ...formData, masterName: newValue ? newValue.Name : '' });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Master Name"
                      required
                      fullWidth
                      helperText="Select from registered masters"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Master Machine #"
                  fullWidth
                  value={formData.masterMachineNumber ? `Machine ${formData.masterMachineNumber}` : 'Auto-generated'}
                  InputProps={{ readOnly: true }}
                  disabled
                  helperText="Sequence number for this Master"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Gazana"
                  fullWidth
                  value={formData.gazanaMachine}
                  onChange={(e) => setFormData({ ...formData, gazanaMachine: e.target.value })}
                  helperText="Enter machine gazana"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Current Status"
                  select
                  fullWidth
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="idle">Idle (Default)</MenuItem>
                  <MenuItem value="running">Running</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="stopped">Stopped</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {isEditing ? 'Update Machine' : 'Register Machine'}
          </Button>
        </DialogActions>
      </Dialog>



      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Delete Machine?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this machine?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button onClick={onDeleteConfirm} variant="contained" color="error">
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workload Modal */}
      <Dialog open={workloadModalOpen} onClose={handleCloseWorkload} maxWidth="lg" fullWidth>
        <DialogTitle>Machine {selectedMachineNum} - Workload Details</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Contract #</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>Collection</TableCell>
                  <TableCell>Assigned</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell>Pending</TableCell>
                  <TableCell align="right">Est. Days</TableCell>
                  <TableCell align="right">Days Left</TableCell>
                  <TableCell align="right">Actual Days</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>On-Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoadingWorkload ? (
                  <TableRow><TableCell colSpan={11} align="center">Loading...</TableCell></TableRow>
                ) : machineWorkload?.length === 0 ? (
                  <TableRow><TableCell colSpan={11} align="center">No assignments found.</TableCell></TableRow>
                ) : (
                  machineWorkload?.map((item) => (
                    <TableRow key={item.contractItemId}>
                      <TableCell>{item.contractNo}</TableCell>
                      <TableCell>{item.itemDescription}</TableCell>
                      <TableCell>{item.collection || '-'}</TableCell>
                      <TableCell>{item.assigned_stitches?.toLocaleString()}</TableCell>
                      <TableCell>{item.completed_stitches?.toLocaleString()}</TableCell>
                      <TableCell>{item.pending_stitches?.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        {item.estimated_days != null && item.estimated_days > 0
                          ? Number(item.estimated_days).toFixed(2)
                          : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {item.days_left != null ? (
                          <Typography
                            variant="body2"
                            fontWeight={item.days_left <= 0 ? 'bold' : 'normal'}
                            color={item.days_left <= 0 ? 'error.main' : item.days_left <= 3 ? 'warning.main' : 'text.primary'}
                          >
                            {item.days_left <= 0 ? '0 (Due)' : item.days_left}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: (item.estimated_days != null && item.estimated_days > 0 && item.actual_days_used > item.estimated_days) ? 'error.main' : 'inherit',
                          fontWeight: (item.estimated_days != null && item.estimated_days > 0 && item.actual_days_used > item.estimated_days) ? 'bold' : 'normal'
                        }}
                      >
                        {item.actual_days_used}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.status}
                          color={item.status === 'Completed' ? 'success' : item.status === 'Delayed' ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.on_time_status}
                          color={item.on_time_status === 'On Time' ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWorkload}>Close</Button>
        </DialogActions>
      </Dialog>


    </Box >
  );
};

export default Machines;