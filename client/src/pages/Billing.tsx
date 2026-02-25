import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Grid,
  Chip,
  FormControlLabel,
  Switch,
  Autocomplete,
} from '@mui/material';
import { Add, Delete, GetApp, Print, Refresh, Save } from '@mui/icons-material';
import { useMutation, useQuery } from 'react-query';
import api from '../apiClient';
import BillHistory from '../components/BillHistory';

// Types
type RateType = 'HDS' | 'SHEET' | 'FUSING';

interface BillItem {
  bill_item_id?: number;
  design_no?: string;
  collection?: string;
  component?: string;
  item_description?: string;
  qty?: number;
  stitches: number;
  rate_per_unit: number;
  rate_type: RateType;
  amount: number;
}

interface Bill {
  bill_id?: number;
  bill_number?: string;
  bill_date: string;
  party_name: string;
  po_number?: string;
}

// Formula calculation (client-side preview only)
const calculateAmount = (stitches: number, rate: number, rateType: RateType): number => {
  let amount = 0;
  switch (rateType) {
    case 'HDS':
      amount = stitches * rate * 0.1;
      break;
    case 'SHEET':
      amount = stitches * rate * 0.277;
      break;
    case 'FUSING':
      amount = 100 * rate;
      break;
  }
  return Math.round(amount * 100) / 100;
};

const Billing: React.FC = () => {
  const location = useLocation();
  
  // Bill header state
  const [billHeader, setBillHeader] = useState<Bill>({
    bill_date: new Date().toISOString().split('T')[0],
    party_name: '',
    po_number: ''
  });

  const [currentBillId, setCurrentBillId] = useState<number | null>(null);
  const [currentItem, setCurrentItem] = useState<Partial<BillItem>>({
    design_no: '',
    collection: '',
    component: '',
    item_description: '',
    qty: 0,
    stitches: 0,
    rate_per_unit: 0,
    rate_type: 'HDS'
  });

  const [rateType, setRateType] = useState<RateType>('HDS');
  const [items, setItems] = useState<BillItem[]>([]);
  const [previewAmount, setPreviewAmount] = useState<number>(0);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [selectedContract, setSelectedContract] = useState<{ id: number; contractNumber: string; poNumber: string; partyName?: string } | null>(null);

  // Fetch active contracts for Party Name dropdown
  const { data: contracts = [] } = useQuery(
    ['contracts-billing'],
    () => api.get('/api/contracts', { params: { limit: 500, status: 'active' } }).then(res => res.data.data)
  );

  // Toggle for clearing Design No & Item Description after Add
  const [clearDesignAfterAdd, setClearDesignAfterAdd] = useState<boolean>(false);

  // Bill history state
  const [historyPage, setHistoryPage] = useState(1);
  const historyLimit = 10;

  const { data: historyData, refetch: refetchHistory } = useQuery(
    ['bills', historyPage],
    () => api.get(`/api/bills?page=${historyPage}&limit=${historyLimit}`).then(res => ({
      bills: res.data.data,
      total: res.data.pagination.total
    })),
    { keepPreviousData: true }
  );

  // Update preview when stitches, rate, or rate type changes
  useEffect(() => {
    const stitches = Number(currentItem.stitches) || 0;
    const rate = Number(currentItem.rate_per_unit) || 0;
    const amount = calculateAmount(stitches, rate, rateType);
    setPreviewAmount(amount);
  }, [currentItem.stitches, currentItem.rate_per_unit, rateType]);

  // Handle pre-filled data from GatePass navigation
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromGatePass && state?.contractNo) {
      // Pre-fill the contract number (PO Number field)
      setBillHeader(prev => ({
        ...prev,
        po_number: state.contractNo
      }));
      
      // Show notification to user
      setNotification({
        message: `Contract ${state.contractNo} pre-filled from Gate Pass`,
        type: 'success'
      });
      
      // Clear the notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
  }, [location.state]);

  // Save bill mutation (creates a new bill with items)
  const saveBillMutation = useMutation(
    (data: any) => api.post('/api/bills', data),
    {
      onSuccess: () => {
        setNotification({ message: 'Bill saved successfully', type: 'success' });
        handleReset();
        refetchHistory();
      },
      onError: (error: any) => {
        const data = error.response?.data;
        let errorMsg = data?.error || data?.message || error.message || 'Unknown error';
        if (data?.details && Array.isArray(data.details)) {
          errorMsg += ': ' + data.details.map((d: any) => d.message).join(', ');
        }
        setNotification({ message: `Failed to save bill: ${errorMsg}`, type: 'error' });
      }
    }
  );

  // Update bill header mutation (for existing bills)
  const updateBillMutation = useMutation(
    (data: { id: number; bill: Bill }) => api.put(`/api/bills/${data.id}`, data.bill),
    {
      onSuccess: () => {
        setNotification({ message: 'Bill header updated successfully', type: 'success' });
        refetchHistory();
      },
      onError: (error: any) => {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
        setNotification({ message: `Failed to update bill header: ${errorMsg}`, type: 'error' });
      }
    }
  );

  // Delete bill mutation
  const deleteBillMutation = useMutation(
    (billId: number) => api.delete(`/api/bills/${billId}`),
    {
      onSuccess: () => {
        setNotification({ message: 'Bill deleted successfully', type: 'success' });
        refetchHistory();
      },
      onError: (error: any) => {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
        setNotification({ message: `Failed to delete bill: ${errorMsg}`, type: 'error' });
      }
    }
  );

  // Note: Add item and Delete item mutations are no longer needed for NEW bills
  // because we save everything at once. They are kept for managing local state only during creation.

  // Handle add item locally
  const handleAddItem = () => {
    const errors: { [key: string]: string } = {};

    const stitches = Number(currentItem.stitches) || 0;
    const rate = Number(currentItem.rate_per_unit) || 0;

    if (rateType !== 'FUSING' && stitches <= 0) {
      errors.stitches = 'Stitches must be greater than 0';
    }
    if (rate <= 0) {
      errors.rate_per_unit = 'Rate must be greater than 0';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    // Add to local list
    const newItem: BillItem = {
      ...currentItem as BillItem,
      bill_item_id: Date.now(), // Temp ID for React keys
      rate_type: rateType,
      amount: previewAmount
    };

    setItems(prev => [...prev, newItem]);

    // Clear per-line fields based on toggle
    setCurrentItem(prev => ({
      design_no: clearDesignAfterAdd ? '' : prev.design_no,
      collection: clearDesignAfterAdd ? '' : prev.collection,
      component: clearDesignAfterAdd ? '' : prev.component,
      item_description: clearDesignAfterAdd ? '' : prev.item_description,
      qty: 0,
      stitches: 0,
      rate_per_unit: 0,
      rate_type: rateType
    }));
  };

  const handleSaveBill = () => {
    if (!billHeader.party_name) {
      setFormErrors({ party_name: 'Party name is required' });
      return;
    }
    if (items.length === 0) {
      setNotification({ message: 'Please add at least one item to the bill', type: 'error' });
      return;
    }

    const payload = {
      ...billHeader,
      items: items.map(({ bill_item_id, ...item }) => item) // Remove temp IDs
    };

    saveBillMutation.mutate(payload);
  };

  const handleClearItem = () => {
    setCurrentItem({
      design_no: '',
      collection: '',
      component: '',
      item_description: '',
      qty: 0,
      stitches: 0,
      rate_per_unit: 0,
      rate_type: rateType
    });
    setFormErrors({});
  };

  const handleDeleteItem = (id: number) => {
    if (window.confirm('Are you sure you want to remove this item?')) {
      if (currentBillId) {
        // If editing an existing bill, we'd ideally want to delete it from DB
        // But for consistency with the new flow, we just manage local state
        // and tell the user they need to save or we could call a delete API.
        // For now, let's keep it simple: filter the local list.
        setItems(prev => prev.filter(item => item.bill_item_id !== id));
      } else {
        setItems(prev => prev.filter(item => item.bill_item_id !== id));
      }
    }
  };

  const handleExportCSV = async () => {
    if (!currentBillId) {
      setNotification({ message: 'Please save bill header first', type: 'error' });
      return;
    }
    try {
      const response = await api.post(`/api/bills/${currentBillId}/export?format=csv`, {}, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bill_${billHeader.bill_number}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setNotification({ message: 'Failed to export CSV', type: 'error' });
    }
  };

  const handlePrint = () => window.print();

  const handleReset = () => {
    setBillHeader({ bill_date: new Date().toISOString().split('T')[0], party_name: '', po_number: '' });
    setSelectedContract(null);
    setCurrentBillId(null);
    setItems([]);
    setCurrentItem({ design_no: '', collection: '', component: '', item_description: '', qty: 0, stitches: 0, rate_per_unit: 0, rate_type: 'HDS' });
    setRateType('HDS');
    refetchHistory();
  };

  const handleEditBill = async (bill: Bill) => {
    try {
      const response = await api.get(`/api/bills/${bill.bill_id}`);
      const { bill: fullBill, items: billItems } = response.data.data;

      setBillHeader({
        bill_date: fullBill.bill_date.split('T')[0],
        party_name: fullBill.party_name,
        po_number: fullBill.po_number || '',
        bill_number: fullBill.bill_number
      });
      setSelectedContract(null); // Clear selection when editing existing bill
      setCurrentBillId(fullBill.bill_id);
      setItems(billItems);

      // Focus the item entry
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotification({ message: 'Failed to load bill details', type: 'error' });
    }
  };

  const handleDeleteBill = (billId: number) => {
    if (window.confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
      deleteBillMutation.mutate(billId);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName === 'INPUT') {
        e.preventDefault();
        handleAddItem();
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (currentBillId) {
          updateBillMutation.mutate({ id: currentBillId, bill: billHeader });
        } else {
          handleSaveBill();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, billHeader, currentBillId, rateType]);

  const totalStitches = items.reduce((sum, item) => sum + Number(item.stitches), 0);
  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Daily Billing Records</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {currentBillId && (
            <Chip label={`Draft Saved - Bill #${billHeader.bill_number}`} color="success" variant="outlined" icon={<Save />} />
          )}
        </Box>
      </Box>

      {notification && (
        <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 2 }}>
          {notification.message}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Bill Information</Typography>
            {currentBillId && (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<Refresh />}
                onClick={handleReset}
              >
                New Bill
              </Button>
            )}
          </Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <TextField label="Bill Date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
                value={billHeader.bill_date} onChange={(e) => setBillHeader({ ...billHeader, bill_date: e.target.value })}
                disabled={!!currentBillId} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={contracts}
                getOptionLabel={(option: any) => {
                  const parts = [];
                  if (option.poNumber) parts.push(option.poNumber);
                  if (option.contractNumber) parts.push(`#${option.contractNumber}`);
                  if (option.collections) parts.push(option.collections);
                  return parts.join(' • ') || 'Select contract';
                }}
                value={selectedContract || (billHeader.po_number && contracts.find((c: any) => c.poNumber === billHeader.po_number)) || null}
                onChange={(_, newValue: any) => {
                  setSelectedContract(newValue);
                  if (newValue) {
                    setBillHeader({
                      ...billHeader,
                      party_name: newValue.poNumber || String(newValue.contractNumber || ''),
                      po_number: newValue.poNumber || ''
                    });
                    setFormErrors(prev => ({ ...prev, party_name: '' }));
                  } else {
                    setBillHeader({ ...billHeader, party_name: '', po_number: '' });
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Party Name (Select Contract) *"
                    size="small"
                    error={!!formErrors.party_name}
                    helperText={formErrors.party_name}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="PO Number"
                fullWidth
                size="small"
                value={billHeader.po_number}
                onChange={(e) => !selectedContract && setBillHeader({ ...billHeader, po_number: e.target.value })}
                InputProps={{ readOnly: !!selectedContract }}
                helperText={selectedContract ? 'From selected contract' : undefined}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField label="Bill Number" fullWidth size="small" value={billHeader.bill_number || 'Auto-generated'} disabled />
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Select Rate Type</Typography>
            <ToggleButtonGroup value={rateType} exclusive onChange={(_, newType) => newType && setRateType(newType)} sx={{ mb: 1 }}>
              <ToggleButton value="HDS">HDS</ToggleButton>
              <ToggleButton value="SHEET">SHEET</ToggleButton>
              <ToggleButton value="FUSING">FUSING</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" display="block" color="text.secondary">
              {rateType === 'HDS' && '📐 Formula: stitches × rate × 0.1'}
              {rateType === 'SHEET' && '📐 Formula: stitches × rate × 0.277'}
              {rateType === 'FUSING' && '📐 Formula: 100 × rate (stitches not used)'}
            </Typography>
          </Box>

          <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">Add Line Item</Typography>
              <FormControlLabel
                control={<Switch checked={clearDesignAfterAdd} onChange={(e) => setClearDesignAfterAdd(e.target.checked)} size="small" />}
                label={<Typography variant="caption">Clear Design & Item after Add</Typography>}
              />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={1.5}>
                <TextField label="Design No" fullWidth size="small" value={currentItem.design_no}
                  onChange={(e) => setCurrentItem({ ...currentItem, design_no: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Collection" fullWidth size="small" value={currentItem.collection}
                  onChange={(e) => setCurrentItem({ ...currentItem, collection: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={1.5}>
                <TextField label="Component" fullWidth size="small" value={currentItem.component}
                  onChange={(e) => setCurrentItem({ ...currentItem, component: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={2.5}>
                <TextField label="Item Description" fullWidth size="small" value={currentItem.item_description}
                  onChange={(e) => setCurrentItem({ ...currentItem, item_description: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={1}>
                <TextField label="Qty" type="number" fullWidth size="small" value={currentItem.qty || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, qty: Number(e.target.value) })} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label={rateType === 'FUSING' ? 'Stitches (opt)' : 'Stitches *'} type="number" fullWidth size="small"
                  value={currentItem.stitches || ''}
                  onChange={(e) => {
                    setCurrentItem({ ...currentItem, stitches: Number(e.target.value) });
                    setFormErrors(prev => ({ ...prev, stitches: '' }));
                  }}
                  error={!!formErrors.stitches} helperText={formErrors.stitches} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Rate *" type="number" fullWidth size="small" inputProps={{ step: '0.01' }}
                  value={currentItem.rate_per_unit || ''}
                  onChange={(e) => {
                    setCurrentItem({ ...currentItem, rate_per_unit: Number(e.target.value) });
                    setFormErrors(prev => ({ ...prev, rate_per_unit: '' }));
                  }}
                  error={!!formErrors.rate_per_unit} helperText={formErrors.rate_per_unit} />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Preview Amount" fullWidth size="small" value={previewAmount.toFixed(2)} disabled
                  sx={{ '& .MuiInputBase-input': { fontWeight: 'bold', color: 'primary.main' } }} />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddItem}
                disabled={rateType !== 'FUSING' ? !currentItem.stitches || !currentItem.rate_per_unit : !currentItem.rate_per_unit}
              >
                Add Line
              </Button>
              <Button variant="outlined" size="small" onClick={handleClearItem}>Clear Line</Button>
              <Typography variant="caption" color="text.secondary">Press Enter to add | Ctrl+S to save bill</Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Items ({items.length})</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Design No</TableCell>
                    <TableCell>Collection</TableCell>
                    <TableCell>Component</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Stitches</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={10} align="center">No items added yet</TableCell></TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.bill_item_id}>
                        <TableCell>{item.design_no || '-'}</TableCell>
                        <TableCell>{item.collection || '-'}</TableCell>
                        <TableCell>{item.component || '-'}</TableCell>
                        <TableCell>{item.item_description || '-'}</TableCell>
                        <TableCell align="right">{item.qty || 0}</TableCell>
                        <TableCell align="right">{Number(item.stitches).toLocaleString()}</TableCell>
                        <TableCell>{item.rate_type}</TableCell>
                        <TableCell align="right">{Number(item.rate_per_unit).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{Number(item.amount).toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleDeleteItem(item.bill_item_id!)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="textSecondary">Total Items</Typography>
                <Typography variant="h5">{items.length}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="textSecondary">Total Stitches</Typography>
                <Typography variant="h5">{totalStitches.toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="textSecondary">Total Amount</Typography>
                <Typography variant="h5" color="primary">{totalAmount.toFixed(2)}</Typography>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {currentBillId ? (
              <Button variant="contained" color="secondary" startIcon={<Save />}
                onClick={() => updateBillMutation.mutate({ id: currentBillId, bill: billHeader })}>Update Bill Header</Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Save />}
                onClick={handleSaveBill}
                disabled={!billHeader.party_name || items.length === 0}
              >
                Save Bill
              </Button>
            )}
            <Button variant="outlined" startIcon={<GetApp />} onClick={handleExportCSV} disabled={!currentBillId}>Export CSV</Button>
            <Button variant="outlined" startIcon={<Print />} onClick={handlePrint}>Print</Button>
            <Button variant="outlined" color="warning" startIcon={<Refresh />} onClick={handleReset}>Reset</Button>
          </Box>
        </CardContent>
      </Card>

      {historyData && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <BillHistory
              bills={historyData.bills}
              total={historyData.total}
              page={historyPage}
              limit={historyLimit}
              onPageChange={setHistoryPage}
              onEdit={handleEditBill}
              onDelete={handleDeleteBill}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Billing;