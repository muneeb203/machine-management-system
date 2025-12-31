import React from 'react';
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
} from '@mui/material';
import {
  PrecisionManufacturing,
  PlayArrow,
  Pause,
  Settings,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
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

interface Machine {
  id: number;
  machineNumber: number;
  masterGroup: number;
  dayShiftCapacity: number;
  nightShiftCapacity: number;
  isActive: boolean;
  status: string;
}

const Machines: React.FC = () => {
  const { user } = useAuth();
  
  const { data: machines, isLoading } = useQuery<Machine[]>(
    'machines',
    async () => {
      const response = await api.get('/api/machines');
      return response.data.data;
    }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'idle': return 'warning';
      case 'maintenance': return 'error';
      default: return 'default';
    }
  };

  const getMasterGroupColor = (group: number) => {
    switch (group) {
      case 1: return 'primary';
      case 2: return 'secondary';
      case 3: return 'info';
      default: return 'default';
    }
  };

  if (isLoading) {
    return <Typography>Loading machines...</Typography>;
  }

  const runningMachines = machines?.filter(m => m.status === 'running').length || 0;
  const totalCapacity = machines?.reduce((sum, m) => sum + m.dayShiftCapacity + m.nightShiftCapacity, 0) || 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Machine Management
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        {user?.role === 'admin' 
          ? 'Full control: Add/edit machines and status' 
          : 'View-only: Machine list and status'}
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PrecisionManufacturing color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Machines
                  </Typography>
                  <Typography variant="h4">
                    22
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
                <PlayArrow color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Running Now
                  </Typography>
                  <Typography variant="h4">
                    {runningMachines}
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
                <Settings color="info" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Daily Capacity
                  </Typography>
                  <Typography variant="h4">
                    {(totalCapacity / 2).toLocaleString()}
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
                <Pause color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Efficiency
                  </Typography>
                  <Typography variant="h4">
                    {Math.round((runningMachines / 22) * 100)}%
                  </Typography>
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
            Machine Status Overview
          </Typography>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Machine #</TableCell>
                  <TableCell>Master Group</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Day Capacity</TableCell>
                  <TableCell>Night Capacity</TableCell>
                  <TableCell>Total Capacity</TableCell>
                  {user?.role === 'admin' && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {machines?.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <PrecisionManufacturing sx={{ mr: 1 }} />
                        Machine {machine.machineNumber}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={`Master ${machine.masterGroup}`}
                        color={getMasterGroupColor(machine.masterGroup)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={machine.status.toUpperCase()}
                        color={getStatusColor(machine.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{machine.dayShiftCapacity.toLocaleString()}</TableCell>
                    <TableCell>{machine.nightShiftCapacity.toLocaleString()}</TableCell>
                    <TableCell>
                      <strong>
                        {(machine.dayShiftCapacity + machine.nightShiftCapacity).toLocaleString()}
                      </strong>
                    </TableCell>
                    {user?.role === 'admin' && (
                      <TableCell>
                        <Button size="small" variant="outlined">
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Master Group Summary */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {[1, 2, 3].map(group => {
          const groupMachines = machines?.filter(m => m.masterGroup === group) || [];
          const groupRunning = groupMachines.filter(m => m.status === 'running').length;
          
          return (
            <Grid item xs={12} md={4} key={group}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Master Group {group}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Machines: {group === 1 ? '1-8' : group === 2 ? '9-15' : '16-22'}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Running: {groupRunning} / {groupMachines.length}
                    </Typography>
                    <Typography variant="body2">
                      Efficiency: {Math.round((groupRunning / groupMachines.length) * 100)}%
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default Machines;