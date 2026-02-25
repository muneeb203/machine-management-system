import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box, Typography, Button, Card, TextField, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Alert, Snackbar, Autocomplete, CircularProgress
} from '@mui/material';
import {
  Add, Save, Visibility, PictureAsPdf, GetApp, Lock, Info,
  Edit, Delete as DeleteIcon
} from '@mui/icons-material';
import api from '../apiClient';
import { BillHeader, BillItem, DesignGroup, BillHistoryItem } from '../types/billing';
import { formatCurrency, calculateRatePerYard, roundTo2Decimals, roundTo4Decimals } from '../utils/billingFormulas';

const D_STITCH_DEFAULT = 104;

/** Total Rate = (Repeat × Rate/Repeat) + (Rate per Piece × Total Pieces). Only way amount is calculated. */
function calculateTotalRateForVariant(v: BillItem): number {
  const repeats = Number(v.repeats) || 0;
  const rateRepeat = Number(v.rate_repeat) || 0;
  const pieces = Number(v.pieces) || 0;
  const ratePiece = Number(v.rate_piece) || 0;
  const totalRepeatRate = repeats * rateRepeat;
  const totalPieceRate = ratePiece * pieces;
  return roundTo2Decimals(totalRepeatRate + totalPieceRate);
}

const OptimizedBilling: React.FC = () => {
  const queryClient = useQueryClient();
  
  // State
  const [header, setHeader] = useState<BillHeader>({
    party_name: '',
    bill_date: new Date().toISOString().split('T')[0],
    collection: '',
    design_no: '',
    notes: '',
    igp: '',
    code: ''
  });
  
  const [designGroups, setDesignGroups] = useState<DesignGroup[]>([]);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [openAddVariant, setOpenAddVariant] = useState(false);
  const [currentDesignIndex, setCurrentDesignIndex] = useState<number>(0);
  const [variantForm, setVariantForm] = useState({ fabric: '', yards: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [contractSearchTerm, setContractSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [sentYards, setSentYards] = useState<string>('');
  const [editingBillContractId, setEditingBillContractId] = useState<number | null>(null);
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(contractSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [contractSearchTerm]);

  // Queries
  const { data: billHistory, isLoading } = useQuery('optimizedBillHistory',
    () => api.get('/api/optimized-bills').then(res => res.data)
  );

  // Fetch contracts for dropdown
  const { data: contracts = [], isLoading: isLoadingContracts } = useQuery(
    ['contracts-dropdown', debouncedSearchTerm],
    async () => {
      const params: any = { limit: 50 };
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }
      const response = await api.get('/api/contracts/dropdown-items', { params });
      return response.data?.data || [];
    },
    {
      staleTime: 2 * 60 * 1000,
      keepPreviousData: true,
    }
  );

  // Fetch contract items when a contract is selected or when editing a bill (to show rate/piece etc.)
  const contractIdForItems = selectedContract?.contractId ?? editingBillContractId ?? null;
  const { data: contractItems = [], isLoading: isLoadingItems } = useQuery(
    ['contract-items', contractIdForItems],
    async () => {
      if (!contractIdForItems) return [];
      const response = await api.get(`/api/contract-items/by-contract/${contractIdForItems}`);
      return response.data?.data || [];
    },
    {
      enabled: !!contractIdForItems,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Contract Section 2 yards (total, cumulative sent, remaining) for Sent Yards / Remaining Yards
  const contractIdForYards = selectedContract?.contractId ?? selectedContract?.ContractID ?? editingBillContractId;
  const { data: contractYards, isLoading: isLoadingContractYards, isError: isContractYardsError } = useQuery<{ totalYards: number; cumulativeSentYards: number; remainingYards: number }>(
    ['contract-yards', contractIdForYards],
    async () => {
      if (!contractIdForYards) return { totalYards: 0, cumulativeSentYards: 0, remainingYards: 0 };
      const response = await api.get(`/api/billing/contract-yards/${contractIdForYards}`);
      const d = response.data?.data ?? response.data;
      return {
        totalYards: Number(d?.totalYards ?? 0),
        cumulativeSentYards: Number(d?.cumulativeSentYards ?? 0),
        remainingYards: Number(d?.remainingYards ?? 0),
      };
    },
    { enabled: !!contractIdForYards, staleTime: 10000 }
  );
  
  // Mutations
  const saveBillMutation = useMutation(
    (data: any) => editingBillId 
      ? api.put(`/api/optimized-bills/${editingBillId}`, data)
      : api.post('/api/optimized-bills', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('optimizedBillHistory');
        queryClient.invalidateQueries(['contract-yards']);
        resetForm();
        setSnackbar({ open: true, message: 'Bill saved successfully', severity: 'success' });
      },
      onError: (error: any) => {
        setSnackbar({ 
          open: true, 
          message: error.response?.data?.error || 'Failed to save bill', 
          severity: 'error' 
        });
      }
    }
  );
  
  // Handlers
  const handleAddDesign = () => {
    setDesignGroups([...designGroups, {
      design_no: header.design_no || '',
      collection: header.collection,
      variants: []
    }]);
  };
  
  const handleOpenAddVariant = (designIndex: number) => {
    setCurrentDesignIndex(designIndex);
    setVariantForm({ fabric: '', yards: '' });
    setOpenAddVariant(true);
  };
  
  // Get matching contract item for a design (for rate, remaining stitches/repeats)
  const getMatchingContractItem = (designNo: string, collection: string) => {
    if (selectedItem && (selectedItem.designNo || '') === (designNo || '') && (selectedItem.collection || '') === (collection || '')) {
      return selectedItem;
    }
    if (selectedContract?.designNo === designNo && selectedContract?.collection === collection) {
      return selectedContract;
    }
    return contractItems.find((c: any) =>
      (c.designNo || '') === (designNo || '') && (c.collection || '') === (collection || '')
    );
  };

  // Get rate per stitch from contract item (selected item or matching by design/collection)
  const getRatePerStitchForDesign = (designNo: string, collection: string): number => {
    if (selectedItem?.ratePerStitch != null && selectedItem.ratePerStitch > 0) {
      return Number(selectedItem.ratePerStitch);
    }
    if (selectedContract?.ratePerStitch != null && selectedContract.ratePerStitch > 0 &&
        selectedContract.designNo === designNo && selectedContract.collection === collection) {
      return Number(selectedContract.ratePerStitch);
    }
    const matching = getMatchingContractItem(designNo, collection);
    return matching?.ratePerStitch != null ? Number(matching.ratePerStitch) : 0;
  };

  // Get rate per repeat from contract item (Section 4 - Costing & Rates)
  const getRatePerRepeatForDesign = (designNo: string, collection: string): number => {
    if (selectedItem?.ratePerRepeat != null && Number(selectedItem.ratePerRepeat) >= 0) {
      return Number(selectedItem.ratePerRepeat);
    }
    if (selectedContract?.ratePerRepeat != null && selectedContract.designNo === designNo && selectedContract.collection === collection) {
      return Number(selectedContract.ratePerRepeat);
    }
    const matching = getMatchingContractItem(designNo, collection);
    return matching?.ratePerRepeat != null ? Number(matching.ratePerRepeat) : 0;
  };

  // Get rate per piece from contract item (Section 4 - Costing & Rates)
  const getRatePerPieceForDesign = (designNo: string, collection: string): number => {
    if (selectedItem?.ratePerPiece != null && Number(selectedItem.ratePerPiece) >= 0) {
      return Number(selectedItem.ratePerPiece);
    }
    if (selectedContract?.ratePerPiece != null && selectedContract.designNo === designNo && selectedContract.collection === collection) {
      return Number(selectedContract.ratePerPiece);
    }
    const matching = getMatchingContractItem(designNo, collection);
    return matching?.ratePerPiece != null ? Number(matching.ratePerPiece) : 0;
  };

  const handleAddVariant = () => {
    if (!variantForm.fabric || !variantForm.yards) {
      setSnackbar({ open: true, message: 'Fabric and Yards are required', severity: 'error' });
      return;
    }
    
    const newGroups = [...designGroups];
    const design = newGroups[currentDesignIndex];
    const rateFromContract = getRatePerStitchForDesign(design.design_no || '', design.collection || '');
    const rateRepeatFromContract = getRatePerRepeatForDesign(design.design_no || '', design.collection || '');
    const ratePieceFromContract = getRatePerPieceForDesign(design.design_no || '', design.collection || '');
    
    const newVariant: BillItem = {
      id: `temp-${Date.now()}`,
      design_no: design.design_no || '',
      collection: design.collection || '',
      fabric: variantForm.fabric,
      yards: parseFloat(variantForm.yards),
      stitches: 0,
      rate_stitch: rateFromContract,
      rate_per_yds: roundTo4Decimals(calculateRatePerYard(D_STITCH_DEFAULT, rateFromContract)),
      rate_repeat: rateRepeatFromContract,
      rate_piece: ratePieceFromContract,
      repeats: 0,
      pieces: 0,
      amount: 0,
      wte_ogp: '',
      h2h_po: ''
    };
    newVariant.amount = calculateTotalRateForVariant(newVariant);
    newGroups[currentDesignIndex].variants.push(newVariant);
    setDesignGroups(newGroups);
    setOpenAddVariant(false);
  };
  
  const handleFieldChange = (designIndex: number, variantIndex: number, field: keyof BillItem, value: any) => {
    if (field === 'rate_stitch' || field === 'rate_repeat' || field === 'rate_piece') return; // from contract Section 4, read-only
    const newGroups = [...designGroups];
    const variant = newGroups[designIndex].variants[variantIndex];
    
    (variant as any)[field] = value;
    variant.amount = calculateTotalRateForVariant(variant);
    
    setDesignGroups(newGroups);
  };
  
  const calculateTotalBill = () => {
    return designGroups.reduce((total, group) => {
      return total + group.variants.reduce((sum, v) => sum + (v.amount || 0), 0);
    }, 0);
  };
  
  const handleSave = () => {
    // Validate
    if (!header.party_name || header.party_name.length < 2) {
      setSnackbar({ open: true, message: 'Party name is required (min 2 characters)', severity: 'error' });
      return;
    }
    
    if (!header.bill_date) {
      setSnackbar({ open: true, message: 'Bill date is required', severity: 'error' });
      return;
    }
    
    // Flatten variants into items array
    const items = designGroups.flatMap(group => group.variants);
    
    if (items.length === 0) {
      setSnackbar({ open: true, message: 'Please add at least one variant', severity: 'error' });
      return;
    }
    
    // Amount is always calculated as (Repeat × Rate/Repeat) + (Rate per Piece × Total Pieces); no other validation needed
    // Save (include contract Section 2 yards when contract selected or editing bill with contract)
    const contractId = selectedContract?.contractId ?? editingBillContractId ?? null;
    saveBillMutation.mutate({
      header,
      items,
      contractId: contractId ?? null,
      sentYards: contractId != null ? Number(sentYards || 0) : undefined,
    });
  };
  
  const resetForm = () => {
    setHeader({
      party_name: '',
      bill_date: new Date().toISOString().split('T')[0],
      collection: '',
      design_no: '',
      notes: '',
      igp: '',
      code: ''
    });
    setDesignGroups([]);
    setEditingBillId(null);
    setSelectedContract(null);
    setSelectedItem(null);
    setContractSearchTerm('');
    setSentYards('');
    setEditingBillContractId(null);
  };

  // Handle contract selection
  const handleContractChange = (contract: any) => {
    setSelectedContract(contract);
    setSentYards('');
    if (contract) {
      setHeader({
        ...header,
        party_name: contract.partyName || contract.poNumber || '',
        collection: contract.collection || '',
        design_no: contract.designNo || ''
      });
      setSelectedItem(null); // Reset item selection when contract changes
    } else {
      setHeader({
        ...header,
        party_name: '',
        collection: '',
        design_no: ''
      });
      setSelectedItem(null);
    }
  };

  // Handle item selection
  const handleItemChange = (item: any) => {
    setSelectedItem(item);
    if (item) {
      setHeader({
        ...header,
        collection: item.collection || header.collection,
        design_no: item.designNo || header.design_no
      });
    }
  };
  
  const handleEdit = async (billId: number) => {
    try {
      const response = await api.get(`/api/optimized-bills/${billId}`);
      const bill = response.data.data;
      
      // Load header
      setHeader({
        party_name: bill.bill.party_name,
        bill_date: bill.bill.bill_date.split('T')[0],
        collection: bill.bill.po_number || '',
        design_no: '',
        notes: bill.bill.notes || '',
        igp: '',
        code: ''
      });
      
      // Group items by design; recalc amount (Repeat×Rate/Repeat + Rate per Piece×Pieces) and rate_per_yds for display
      const groups = groupItemsByDesign(bill.items);
      groups.forEach(g => g.variants.forEach(v => {
        v.amount = calculateTotalRateForVariant(v);
        if (v.rate_stitch != null) v.rate_per_yds = roundTo4Decimals(calculateRatePerYard(D_STITCH_DEFAULT, v.rate_stitch));
      }));
      setDesignGroups(groups);
      setEditingBillId(billId);
      setSentYards(bill.bill.sent_yards != null ? String(bill.bill.sent_yards) : '');
      setEditingBillContractId(bill.bill.contract_id ?? null);
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load bill', severity: 'error' });
    }
  };
  
  const groupItemsByDesign = (items: any[]): DesignGroup[] => {
    const grouped = new Map<string, BillItem[]>();
    
    items.forEach(item => {
      const key = `${item.design_no || 'DESIGN'}-${item.collection || ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });
    
    return Array.from(grouped.entries()).map(([key, variants]) => ({
      design_no: variants[0].design_no || 'DESIGN',
      collection: variants[0].collection || '',
      variants
    }));
  };
  
  const handleRemoveVariant = (designIndex: number, variantIndex: number) => {
    const newGroups = [...designGroups];
    newGroups[designIndex].variants.splice(variantIndex, 1);
    setDesignGroups(newGroups);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Optimized Billing
      </Typography>
      
      {/* Factory Header */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              WEAVETEX EMBROIDERY
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="IGP"
                  size="small"
                  fullWidth
                  value={header.igp}
                  onChange={(e) => setHeader({ ...header, igp: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Code"
                  size="small"
                  fullWidth
                  value={header.code}
                  onChange={(e) => setHeader({ ...header, code: e.target.value })}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Card>
      
      {/* Bill Header */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={contracts}
              getOptionLabel={(option) => {
                const parts = [];
                if (option.partyName || option.poNumber) parts.push(option.partyName || option.poNumber);
                if (option.collection) parts.push(option.collection);
                if (option.designNo) parts.push(option.designNo);
                if (option.component) parts.push(option.component);
                return parts.join(', ') || `Contract ${option.contractNumber}`;
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body2" fontWeight="bold">
                      {option.partyName || option.poNumber || 'N/A'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      {option.collection && (
                        <Typography variant="caption" color="text.secondary">
                          Collection: {option.collection}
                        </Typography>
                      )}
                      {option.designNo && (
                        <Typography variant="caption" color="text.secondary">
                          Design: {option.designNo}
                        </Typography>
                      )}
                      {option.component && (
                        <Typography variant="caption" color="text.secondary">
                          Component: {option.component}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}
              value={selectedContract}
              onChange={(_, newValue) => handleContractChange(newValue)}
              onInputChange={(_, newInputValue) => {
                setContractSearchTerm(newInputValue);
              }}
              filterOptions={(options) => options}
              loading={isLoadingContracts}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Party Name (Select Contract) *"
                  required
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isLoadingContracts ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              noOptionsText={isLoadingContracts ? "Loading contracts..." : "No contracts found"}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="Bill #"
              fullWidth
              value={editingBillId ? 'Editing' : 'Auto-generated'}
              disabled
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="Bill Date *"
              type="date"
              fullWidth
              value={header.bill_date}
              onChange={(e) => setHeader({ ...header, bill_date: e.target.value })}
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="Collection"
              fullWidth
              value={header.collection}
              onChange={(e) => setHeader({ ...header, collection: e.target.value })}
              disabled={!!selectedContract}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="Design #"
              fullWidth
              value={header.design_no}
              onChange={(e) => setHeader({ ...header, design_no: e.target.value })}
              disabled={!!selectedContract}
            />
          </Grid>
          {selectedContract && contractItems.length > 0 && (
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={contractItems}
                getOptionLabel={(option) => {
                  const parts = [];
                  if (option.itemDescription) parts.push(option.itemDescription);
                  if (option.collection) parts.push(`Collection: ${option.collection}`);
                  if (option.designNo) parts.push(`Design: ${option.designNo}`);
                  return parts.join(' • ') || `Item ${option.contractItemId}`;
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {option.itemDescription || 'N/A'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        {option.collection && (
                          <Typography variant="caption" color="text.secondary">
                            Collection: {option.collection}
                          </Typography>
                        )}
                        {option.designNo && (
                          <Typography variant="caption" color="text.secondary">
                            Design: {option.designNo}
                          </Typography>
                        )}
                        {option.component && (
                          <Typography variant="caption" color="text.secondary">
                            Component: {option.component}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                )}
                value={selectedItem}
                onChange={(_, newValue) => handleItemChange(newValue)}
                loading={isLoadingItems}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Item (Optional)"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isLoadingItems ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                noOptionsText={isLoadingItems ? "Loading items..." : "No items available"}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={2}
              value={header.notes}
              onChange={(e) => setHeader({ ...header, notes: e.target.value })}
            />
          </Grid>
        </Grid>
      </Card>
      
      {/* Yards (from Contract Section 2) - when contract selected or editing bill with contract */}
      {(selectedContract || (editingBillId && editingBillContractId)) && (
        <Card sx={{ mb: 3, p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
            Yards (from Contract Section 2)
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
            Enter yards in Contract Manager → Section 2 for this contract to see contract total and remaining.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Sent Yards"
                type="number"
                size="small"
                fullWidth
                value={sentYards}
                onChange={(e) => setSentYards(e.target.value)}
                inputProps={{ step: '0.01', min: 0 }}
                helperText="Yards sent in this billing"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Remaining Yards"
                size="small"
                fullWidth
                value={
                  isLoadingContractYards
                    ? 'Loading...'
                    : isContractYardsError
                    ? 'Error loading'
                    : contractYards != null
                    ? (Number(sentYards || 0) > 0
                        ? Math.max(0, contractYards.remainingYards - Number(sentYards))
                        : contractYards.remainingYards
                      ).toFixed(2)
                    : '0.00'
                }
                InputProps={{ readOnly: true }}
                helperText={
                  isLoadingContractYards
                    ? 'Loading contract yards...'
                    : isContractYardsError
                    ? 'Could not load yards. Check that Contract Section 2 has Yards entered.'
                    : `Contract total: ${(contractYards?.totalYards ?? 0).toFixed(2)} | Already sent: ${(contractYards?.cumulativeSentYards ?? 0).toFixed(2)}`
                }
                sx={{ '& .MuiInputBase-input': { backgroundColor: 'action.hover' } }}
              />
            </Grid>
          </Grid>
        </Card>
      )}
      
      {/* Design Groups */}
      {designGroups.map((group, designIndex) => {
        const matchingItem = getMatchingContractItem(group.design_no || '', group.collection || '');
        const remainingStitches = matchingItem?.remainingStitches ?? null;
        const remainingRepeats = matchingItem?.remainingRepeats ?? null;
        const totalPlannedStitches = matchingItem?.totalPlannedStitches ?? null;
        const totalRepeats = matchingItem?.repeat ?? null;
        return (
        <Card key={designIndex} sx={{ mb: 3, p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
            <Typography variant="h6">
              Design: {group.design_no || 'Unnamed'}
            </Typography>
            {(remainingStitches != null || remainingRepeats != null) && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'info.light', px: 2, py: 1, borderRadius: 1 }}>
                {remainingStitches != null && (
                  <Typography variant="body2">
                    <strong>Remaining Stitches:</strong> {Number(remainingStitches).toLocaleString()}
                    {totalPlannedStitches != null && ` (of ${Number(totalPlannedStitches).toLocaleString()} total)`}
                  </Typography>
                )}
                {remainingRepeats != null && (
                  <Typography variant="body2">
                    <strong>Remaining Repeats:</strong> {Number(remainingRepeats).toLocaleString()}
                    {totalRepeats != null && ` (of ${Number(totalRepeats).toLocaleString()} total)`}
                  </Typography>
                )}
              </Box>
            )}
            <Button
              startIcon={<Add />}
              variant="outlined"
              size="small"
              onClick={() => handleOpenAddVariant(designIndex)}
            >
              Add Variant
            </Button>
          </Box>
          
          {group.variants.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Metric</TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx} align="center" sx={{ fontWeight: 'bold' }}>
                        {variant.fabric}
                        <br />
                        <Typography variant="caption">{variant.yards} YRD</Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveVariant(designIndex, idx)}
                          sx={{ ml: 1 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* 1. STITCH - on top */}
                  <TableRow>
                    <TableCell>STITCH</TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={variant.stitches || ''}
                          onChange={(e) => handleFieldChange(designIndex, idx, 'stitches', parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* 2. # OF REPEATS */}
                  <TableRow>
                    <TableCell># OF REPEATS</TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={variant.repeats || ''}
                          onChange={(e) => handleFieldChange(designIndex, idx, 'repeats', parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* Total No of Stitches = stitches × repeats (calculated) */}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      Total No of Stitches
                      <Tooltip title="Stitches × Repeats">
                        <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                      </Tooltip>
                    </TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          size="small"
                          fullWidth
                          value={
                            (variant.stitches != null && variant.repeats != null && !Number.isNaN(Number(variant.stitches)) && !Number.isNaN(Number(variant.repeats)))
                              ? (Number(variant.stitches) * Number(variant.repeats)).toLocaleString()
                              : '-'
                          }
                          InputProps={{ readOnly: true }}
                          sx={{ '& .MuiInputBase-input': { fontWeight: 'bold' } }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* YARDS (editable - changing this updates amount) */}
                  <TableRow>
                    <TableCell>YARDS</TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={variant.yards ?? ''}
                          onChange={(e) => handleFieldChange(designIndex, idx, 'yards', parseFloat(e.target.value) || 0)}
                          inputProps={{ step: 0.01, min: 0 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* RATE/STITCH - From contract item, read-only */}
                  <TableRow>
                    <TableCell>
                      RATE/STITCH
                      <Tooltip title="From contract item (Rate per Stitch)">
                        <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                      </Tooltip>
                    </TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={variant.rate_stitch ?? ''}
                          InputProps={{ readOnly: true }}
                          inputProps={{ step: 0.0001 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* RATE/M/Y (Rate per Meter/Yard - formula only, not used for total rate) */}
                  <TableRow>
                    <TableCell>
                      RATE/M/Y
                      <Tooltip title="Formula: (D-Stitch ÷ 1000) × 2.77 × Rate/Stitch (display only; total rate uses Repeat × Rate/Repeat + Rate per Piece × Pieces)">
                        <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                      </Tooltip>
                    </TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography>{variant.rate_per_yds != null ? variant.rate_per_yds.toFixed(4) : '0.0000'}</Typography>
                          <Lock fontSize="small" color="disabled" />
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* RATE/REPEAT - From contract Section 4 (Costing & Rates), read-only */}
                  <TableRow>
                    <TableCell>
                      RATE/REPEAT
                      <Tooltip title="From contract Section 4 (Costing & Rates)">
                        <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                      </Tooltip>
                    </TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={variant.rate_repeat ?? ''}
                          InputProps={{ readOnly: true }}
                          inputProps={{ step: 0.0001 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* RATE/PIECE - From contract Section 4 (Costing & Rates), read-only */}
                  <TableRow>
                    <TableCell>
                      RATE/PIECE
                      <Tooltip title="From contract Section 4 (Costing & Rates)">
                        <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                      </Tooltip>
                    </TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={(variant.rate_piece ?? getRatePerPieceForDesign(group.design_no || '', group.collection || '')) || ''}
                          InputProps={{ readOnly: true }}
                          inputProps={{ step: 0.0001 }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* PIECES */}
                  <TableRow>
                    <TableCell># OF PIECES</TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={variant.pieces || ''}
                          onChange={(e) => handleFieldChange(designIndex, idx, 'pieces', parseInt(e.target.value) || 0)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  
                  {/* AMOUNT = Total Rate (only formula: Repeat × Rate/Repeat + Rate per Piece × Total Pieces) */}
                  <TableRow>
                    <TableCell>
                      AMOUNT (Total Rate)
                      <Tooltip title="Total Rate = Total Repeat Rate + Total Piece Rate. Total Repeat Rate = Repeat × Rate/Repeat. Total Piece Rate = Rate per Piece × Total Pieces.">
                        <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                      </Tooltip>
                    </TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(variant.amount || 0)}
                          </Typography>
                          <Lock fontSize="small" color="disabled" />
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                  
                  {/* WTE OGP */}
                  <TableRow>
                    <TableCell>WTE OGP#</TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          size="small"
                          fullWidth
                          value={variant.wte_ogp || ''}
                          onChange={(e) => handleFieldChange(designIndex, idx, 'wte_ogp', e.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  
                  {/* H2H PO */}
                  <TableRow>
                    <TableCell>H2H PO</TableCell>
                    {group.variants.map((variant, idx) => (
                      <TableCell key={idx}>
                        <TextField
                          size="small"
                          fullWidth
                          value={variant.h2h_po || ''}
                          onChange={(e) => handleFieldChange(designIndex, idx, 'h2h_po', e.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No variants added yet. Click "Add Variant" to start.</Alert>
          )}
        </Card>
        );
      })}
      
      {/* Add Design Button */}
      <Button
        startIcon={<Add />}
        variant="outlined"
        onClick={handleAddDesign}
        sx={{ mb: 3 }}
      >
        Add Design
      </Button>
      
      {/* Total Bill */}
      <Card sx={{ mb: 3, p: 2, bgcolor: 'primary.light' }}>
        <Typography variant="h5" align="center" sx={{ fontWeight: 'bold' }}>
          TOTAL BILL: {formatCurrency(calculateTotalBill())}
        </Typography>
      </Card>
      
      {/* Action Buttons */}
      <Box display="flex" gap={2} mb={3}>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
          disabled={saveBillMutation.isLoading}
        >
          {saveBillMutation.isLoading ? 'Saving...' : 'Save Bill'}
        </Button>
        <Button variant="outlined" onClick={resetForm}>
          Reset
        </Button>
      </Box>
      
      {/* Bill History */}
      <Card sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Bill History
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Bill #</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Party</TableCell>
                <TableCell>Items</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">Loading...</TableCell>
                </TableRow>
              ) : billHistory?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">No bills found</TableCell>
                </TableRow>
              ) : (
                billHistory?.data?.map((bill: BillHistoryItem) => (
                  <TableRow key={bill.bill_id}>
                    <TableCell>{bill.bill_number}</TableCell>
                    <TableCell>{new Date(bill.bill_date).toLocaleDateString()}</TableCell>
                    <TableCell>{bill.party_name}</TableCell>
                    <TableCell>{bill.items_count} variants</TableCell>
                    <TableCell align="right">{formatCurrency(bill.total_amount)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(bill.bill_id)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      
      {/* Add Variant Dialog */}
      <Dialog open={openAddVariant} onClose={() => setOpenAddVariant(false)}>
        <DialogTitle>Add Fabric Variant</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
            <TextField
              label="Fabric Type *"
              placeholder="e.g., ORG, POLY, COTTON"
              fullWidth
              value={variantForm.fabric}
              onChange={(e) => setVariantForm({ ...variantForm, fabric: e.target.value })}
            />
            <TextField
              label="Yards *"
              type="number"
              fullWidth
              value={variantForm.yards}
              onChange={(e) => setVariantForm({ ...variantForm, yards: e.target.value })}
              inputProps={{ step: 0.01 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddVariant(false)}>Cancel</Button>
          <Button onClick={handleAddVariant} variant="contained">Add Variant</Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OptimizedBilling;
