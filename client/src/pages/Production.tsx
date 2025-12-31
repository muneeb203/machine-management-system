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
  TextField,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
} from '@mui/material';
import {
  Engineering,
  Add,
  Today,
  NightsStay,
  WbSunny,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';
import { useAuth } from '../contexts/AuthContext';



interface ProductionEntry {
  id: number;
  machineId: number;
  designId: number;
  productionDate: string;
  shift: string;
  actualStitches: number;
  genuineStitches: number;
  repeatsCompleted: number;
  operatorName: string;
  notes: string;
  machine?: {
    machineNumber: number;
    masterGroup: number;
  };
  design?: {
    designNumber: string;
    component: string;
  };
}

const Production: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntry, setNewEntry] = useState({
    machineId: '',
    designId: '',
    shift: '',
    actualStitches: '',
    genuineStitches: '',
    repeatsCompleted: '',
    operatorName: user?.username || '',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: dailyProduction, isLoading } = useQuery(
    ['daily-production', selectedDate],
    async () => {
      const response = await api.get(`/api/production/daily/${selectedDate}`);
      return response.data.data;
    }
  );

  const { data: machines } = useQuery('machines', async () => {
    const response = await api.get('/api/machines');
    return response.data.data;
  });

  const createEntryMutation = useMutation(
    (entry: any) => api.post('/api/production/entry', {
      ...entry,
      productionDate: selectedDate,
      machineId: parseInt(entry.machineId),
      designId: parseInt(entry.designId),
      actualStitches: parseInt(entry.actualStitches),
      genuineStitches: parseInt(entry.genuineStitches),
      repeatsCompleted: parseInt(entry.repeatsCompleted),
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['daily-production', selectedDate]);
        setNewEntry({
          machineId: '',
          designId: '',
          shift: '',
          actualStitches: '',
          genuineStitches: '',
          repeatsCompleted: '',
          operatorName: user?.username || '',
          notes: '',
        });
      },
    }
  );

  const handleSubmit = () => {
    createEntryMutation.mutate(newEntry);
  };

  const canEditDate = (date: string) => {
    if (user?.role === 'admin') return true;
    return date === new Date().toISOString().split('T')[0]; // Operators can only edit today
  };

  const getTotalStitches = (shift?: string) => {
    if (!dailyProduction) return 0;
    return dailyProduction
      .filter((entry: ProductionEntry) => !shift || entry.shift === shift)
      .reduce((sum: number, entry: ProductionEntry) => sum + entry.actualStitches, 0);
  };

  if (isLoading) {
    return <Typography>Loading production data...</Typography>;
  }

  const dayShiftStitches = getTotalStitches('day');
  const nightShiftStitches = getTotalStitches('night');
  const totalStitches = getTotalStitches();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Daily Production Entry
      </Typography>

      <Typography variant="body1" color="textSecondary" gutterBottom>
        {user?.role === 'admin'
          ? 'Admin Access: Edit entries, approve backdated data'
          : 'Operator Access: Enter same-day production only'}
      </Typography>

      {/* Date Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Production Date"
                type="date"
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={user?.role === 'operator' && selectedDate !== new Date().toISOString().split('T')[0]}
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

      {/* Production Entry Form */}
      {canEditDate(selectedDate) && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Add Production Entry
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Machine</InputLabel>
                  <Select
                    value={newEntry.machineId}
                    onChange={(e) => setNewEntry({ ...newEntry, machineId: e.target.value })}
                    label="Machine"
                  >
                    {machines?.map((machine: any) => (
                      <MenuItem key={machine.id} value={machine.id}>
                        Machine {machine.machineNumber}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Shift</InputLabel>
                  <Select
                    value={newEntry.shift}
                    onChange={(e) => setNewEntry({ ...newEntry, shift: e.target.value })}
                    label="Shift"
                  >
                    <MenuItem value="day">Day Shift</MenuItem>
                    <MenuItem value="night">Night Shift</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  label="Actual Stitches"
                  type="number"
                  fullWidth
                  value={newEntry.actualStitches}
                  onChange={(e) => setNewEntry({ ...newEntry, actualStitches: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  label="Repeats Completed"
                  type="number"
                  fullWidth
                  value={newEntry.repeatsCompleted}
                  onChange={(e) => setNewEntry({ ...newEntry, repeatsCompleted: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  label="Operator Name"
                  fullWidth
                  value={newEntry.operatorName}
                  onChange={(e) => setNewEntry({ ...newEntry, operatorName: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Add />}
                  onClick={handleSubmit}
                  disabled={!newEntry.machineId || !newEntry.shift || !newEntry.actualStitches}
                  sx={{ height: '56px' }}
                >
                  Add Entry
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {!canEditDate(selectedDate) && user?.role === 'operator' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Operators can only enter production data for today. Selected date: {selectedDate}
        </Alert>
      )}

      {/* Production Entries Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Production Entries for {new Date(selectedDate).toLocaleDateString()}
          </Typography>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Machine</TableCell>
                  <TableCell>Shift</TableCell>
                  <TableCell>Design</TableCell>
                  <TableCell>Actual Stitches</TableCell>
                  <TableCell>Genuine Stitches</TableCell>
                  <TableCell>Repeats</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyProduction?.map((entry: ProductionEntry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Engineering sx={{ mr: 1 }} />
                        Machine {entry.machine?.machineNumber}
                        <Chip
                          label={`M${entry.machine?.masterGroup}`}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.shift.toUpperCase()}
                        color={entry.shift === 'day' ? 'warning' : 'info'}
                        size="small"
                        icon={entry.shift === 'day' ? <WbSunny /> : <NightsStay />}
                      />
                    </TableCell>
                    <TableCell>
                      {entry.design?.designNumber} - {entry.design?.component}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {entry.actualStitches.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>{entry.genuineStitches?.toLocaleString()}</TableCell>
                    <TableCell>{entry.repeatsCompleted}</TableCell>
                    <TableCell>{entry.operatorName}</TableCell>
                    <TableCell>{entry.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {(!dailyProduction || dailyProduction.length === 0) && (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary">
                No production entries found for {new Date(selectedDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Production;