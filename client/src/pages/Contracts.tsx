import React, { useState } from 'react';
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
} from '@mui/material';
import {
  Assignment,
  Add,
  Visibility,
  Edit,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.tsx';

// Simple axios instance for API calls
const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface Contract {
  id: number;
  contractNumber: string;
  partyName: string;
  poNumber: string;
  startDate: string;
  endDate: string;
  collectionName: string;
  status: string;
}

const Contracts: React.FC = () => {
  const { user } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    contractNumber: '',
    partyName: '',
    poNumber: '',
    startDate: '',
    endDate: '',
    collectionName: '',
  });

  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery<Contract[]>(
    'contracts',
    async () => {
      const response = await api.get('/api/contracts');
      return response.data.data;
    }
  );

  const createContractMutation = useMutation(
    (newContract: any) => api.post('/api/contracts', newContract),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contracts');
        setOpenDialog(false);
        setFormData({
          contractNumber: '',
          partyName: '',
          poNumber: '',
          startDate: '',
          endDate: '',
          collectionName: '',
        });
      },
    }
  );

  const handleSubmit = () => {
    createContractMutation.mutate(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  if (isLoading) {
    return <Typography>Loading contracts...</Typography>;
  }

  const activeContracts = contracts?.filter(c => c.status === 'active').length || 0;
  const totalContracts = contracts?.length || 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Contract Management
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        {user?.role === 'admin' 
          ? 'Admin Access: Create, edit, approve, close contracts and define rates' 
          : 'Operator Access: View-only active contracts'}
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Assignment color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Contracts
                  </Typography>
                  <Typography variant="h4">
                    {totalContracts}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Assignment color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Contracts
                  </Typography>
                  <Typography variant="h4">
                    {activeContracts}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Contracts Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              {user?.role === 'admin' ? 'All Contracts' : 'Active Contracts'}
            </Typography>
            {user?.role === 'admin' && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setOpenDialog(true)}
              >
                New Contract
              </Button>
            )}
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Contract #</TableCell>
                  <TableCell>Party Name</TableCell>
                  <TableCell>PO Number</TableCell>
                  <TableCell>Collection</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts?.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {contract.contractNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{contract.partyName}</TableCell>
                    <TableCell>{contract.poNumber}</TableCell>
                    <TableCell>{contract.collectionName}</TableCell>
                    <TableCell>{new Date(contract.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(contract.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip 
                        label={contract.status.toUpperCase()}
                        color={getStatusColor(contract.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Visibility />}
                        sx={{ mr: 1 }}
                      >
                        View
                      </Button>
                      {user?.role === 'admin' && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Edit />}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create Contract Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Contract</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Contract Number"
                fullWidth
                variant="outlined"
                value={formData.contractNumber}
                onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Party Name"
                fullWidth
                variant="outlined"
                value={formData.partyName}
                onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="PO Number"
                fullWidth
                variant="outlined"
                value={formData.poNumber}
                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Collection Name"
                fullWidth
                variant="outlined"
                value={formData.collectionName}
                onChange={(e) => setFormData({ ...formData, collectionName: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="End Date"
                type="date"
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!formData.contractNumber || !formData.partyName}
          >
            Create Contract
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Contracts;