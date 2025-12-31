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
  Grid,
  Chip,
  Alert,
} from '@mui/material';
import {
  MonetizationOn,
  Add,
  Edit,
  Calculate,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';



interface RateElement {
  id: number;
  name: string;
  ratePerStitch: number;
  isActive: boolean;
}

const RateManagement: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRate, setEditingRate] = useState<RateElement | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    ratePerStitch: 0,
  });

  const queryClient = useQueryClient();

  const { data: rateElements, isLoading } = useQuery<RateElement[]>(
    'rate-elements',
    async () => {
      const response = await api.get('/api/admin/rate-elements');
      return response.data.data;
    }
  );

  const createRateMutation = useMutation(
    (newRate: any) => api.post('/api/admin/rate-elements', newRate),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('rate-elements');
        setOpenDialog(false);
        setFormData({ name: '', ratePerStitch: 0 });
      },
    }
  );

  const handleSubmit = () => {
    createRateMutation.mutate(formData);
  };

  const handleEdit = (rate: RateElement) => {
    setEditingRate(rate);
    setFormData({
      name: rate.name,
      ratePerStitch: rate.ratePerStitch,
    });
    setOpenDialog(true);
  };

  const calculateSampleBilling = () => {
    const baseRate = rateElements?.find(r => r.name === 'Base Rate')?.ratePerStitch || 0;
    const selectedElements = rateElements?.filter(r => r.name !== 'Base Rate') || [];
    const totalElementRate = selectedElements.reduce((sum, r) => sum + r.ratePerStitch, 0);
    const effectiveRate = baseRate + totalElementRate;

    return {
      baseRate,
      elementRate: totalElementRate,
      effectiveRate,
      sampleAmount: effectiveRate * 50000, // 50,000 stitches sample
    };
  };

  const sample = calculateSampleBilling();

  if (isLoading) {
    return <Typography>Loading rate elements...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Rate & Pricing Management
      </Typography>

      <Typography variant="body1" color="textSecondary" gutterBottom>
        Admin Access: Define base and element rates, lock rates for billing
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Billing Formula:</strong> Final Bill = Actual Stitches × (Base Rate + Selected Element Rates)
      </Alert>

      {/* Rate Calculation Preview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Calculate sx={{ mr: 1, verticalAlign: 'middle' }} />
            Rate Calculation Preview (50,000 stitches)
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  ${sample.baseRate.toFixed(6)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Base Rate per Stitch
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="secondary">
                  ${sample.elementRate.toFixed(6)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Element Rates Sum
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  ${sample.effectiveRate.toFixed(6)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Effective Rate per Stitch
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="error.main">
                  ${sample.sampleAmount.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Sample Bill Amount
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Rate Elements Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Rate Elements Configuration
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setEditingRate(null);
                setFormData({ name: '', ratePerStitch: 0 });
                setOpenDialog(true);
              }}
            >
              Add Rate Element
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Element Name</TableCell>
                  <TableCell>Rate per Stitch ($)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Impact on 50k Stitches</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rateElements?.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <MonetizationOn sx={{ mr: 1 }} />
                        {rate.name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        ${rate.ratePerStitch.toFixed(6)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rate.isActive ? 'Active' : 'Inactive'}
                        color={rate.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary">
                        ${(rate.ratePerStitch * 50000).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Edit />}
                        onClick={() => handleEdit(rate)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRate ? 'Edit Rate Element' : 'Add New Rate Element'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Element Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Rate per Stitch ($)"
            type="number"
            fullWidth
            variant="outlined"
            value={formData.ratePerStitch}
            onChange={(e) => setFormData({ ...formData, ratePerStitch: parseFloat(e.target.value) })}
            inputProps={{ step: 0.000001, min: 0 }}
          />

          {formData.ratePerStitch > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Impact on 50,000 stitches: <strong>${(formData.ratePerStitch * 50000).toFixed(2)}</strong>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.name || formData.ratePerStitch <= 0}
          >
            {editingRate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RateManagement;