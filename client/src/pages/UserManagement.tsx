import React, { useState } from 'react';
import {
  Box,
  Typography,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Alert,
} from '@mui/material';
import {
  People,
  Add,
  Edit,
  AdminPanelSettings,
  Engineering,
  PrecisionManufacturing,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

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

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
}

const UserManagement: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: '',
  });

  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>(
    'users',
    async () => {
      const response = await api.get('/api/admin/users');
      return response.data.data;
    }
  );

  const createUserMutation = useMutation(
    (newUser: any) => api.post('/api/admin/users', newUser),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        setOpenDialog(false);
        setFormData({ username: '', email: '', password: '', role: '' });
      },
    }
  );

  const handleSubmit = () => {
    createUserMutation.mutate(formData);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <AdminPanelSettings />;
      case 'programmer': return <Engineering />;
      case 'operator': return <PrecisionManufacturing />;
      default: return <People />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'programmer': return 'secondary';
      case 'operator': return 'primary';
      default: return 'default';
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin': 
        return 'Full system control, configuration, approvals, and audits';
      case 'programmer': 
        return 'Programming assignments, scheduling, and production planning';
      case 'operator': 
        return 'Daily production entry, same-day data only';
      default: 
        return 'Unknown role';
    }
  };

  if (isLoading) {
    return <Typography>Loading users...</Typography>;
  }

  const roleStats = {
    admin: users?.filter(u => u.role === 'admin').length || 0,
    programmer: users?.filter(u => u.role === 'programmer').length || 0,
    operator: users?.filter(u => u.role === 'operator').length || 0,
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User & Role Management
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Admin Access: Create, edit, deactivate users and assign roles and permissions
      </Typography>

      {/* Role Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <AdminPanelSettings color="error" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Administrators
                  </Typography>
                  <Typography variant="h4">
                    {roleStats.admin}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Engineering color="secondary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Programmers
                  </Typography>
                  <Typography variant="h4">
                    {roleStats.programmer}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PrecisionManufacturing color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Operators
                  </Typography>
                  <Typography variant="h4">
                    {roleStats.operator}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Users Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              System Users
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setFormData({ username: '', email: '', password: '', role: '' });
                setOpenDialog(true);
              }}
            >
              Add User
            </Button>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        {getRoleIcon(user.role)}
                        <Box ml={1}>
                          <Typography variant="body2" fontWeight="bold">
                            {user.username}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {user.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.role.toUpperCase()}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={user.isActive ? 'Active' : 'Inactive'}
                        color={user.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="textSecondary">
                        {getRoleDescription(user.role)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Edit />}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Role Permissions Reference
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Alert severity="error" sx={{ height: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  <AdminPanelSettings sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Administrator
                </Typography>
                <Typography variant="body2">
                  • Full system access<br/>
                  • Rate management<br/>
                  • User management<br/>
                  • Billing approval<br/>
                  • System configuration<br/>
                  • All reports and exports
                </Typography>
              </Alert>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Alert severity="info" sx={{ height: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  <Engineering sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Programmer
                </Typography>
                <Typography variant="body2">
                  • Contract/design management<br/>
                  • Programming assignments<br/>
                  • Production planning<br/>
                  • Schedule control<br/>
                  • View reports
                </Typography>
              </Alert>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Alert severity="success" sx={{ height: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  <PrecisionManufacturing sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Operator
                </Typography>
                <Typography variant="body2">
                  • Daily production entry<br/>
                  • Same-day data only<br/>
                  • View active contracts<br/>
                  • View machine list<br/>
                  • Limited dashboards<br/>
                  • Request overrides
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            variant="outlined"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth variant="outlined">
            <InputLabel>Role</InputLabel>
            <Select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              label="Role"
            >
              <MenuItem value="admin">Administrator</MenuItem>
              <MenuItem value="programmer">Programmer</MenuItem>
              <MenuItem value="operator">Operator</MenuItem>
            </Select>
          </FormControl>
          
          {formData.role && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>{formData.role.toUpperCase()}:</strong> {getRoleDescription(formData.role)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!formData.username || !formData.email || !formData.password || !formData.role}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;