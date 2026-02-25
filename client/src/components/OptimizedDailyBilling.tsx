import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Chip,
  Alert,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress, 
} from '@mui/material';
import {
  ExpandMore,
  Add,
  Delete,
  Save,
  WbSunny,
  NightsStay,
  Calculate,
  Visibility,
  History,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import {
  calculateRatePerYard,
  calculateAmount,
  calculateAmountHDS,
  calculateFabricYards,
  roundTo2Decimals,
  roundTo4Decimals,
} from '../utils/billingFormulas';

// Types
interface Machine {
  id: number;
  machineNumber: string;
  masterName: string;
  gazanaMachine: number;
  isActive: boolean;
}

interface Master {
  MasterID: number;
  Name: string;
}

interface DesignItem {
  designNo: string;
  dStitch: number;
  dayShift: ShiftData;
  nightShift: ShiftData;
}

interface ShiftData {
  stitchesDone: number;
  fabric: number; // calculated
  rate: number;
  perYds: number; // calculated
  amount: number; // calculated
}

interface Contract {
  ContractID: number;
  ContractNo: string;
  PONumber: string;
  Collection?: string;
  DesignNo?: string;
  Component?: string;
  ItemDescription?: string;
  ItemID?: number; // itemId from dropdown-items when row represents a contract item
}

interface ContractItemOption {
  contractItemId: number;
  contractId: number;
  collection: string | null;
  designNo: string | null;
  component: string | null;
  itemDescription: string | null;
  fabric: string | null;
  color: string | null;
  stitch: number | null;
  ratePerStitch: number | null;
  yards?: number | null;
}

interface HistoryRecord {
  id: number;
  machine_id: number;
  master_id: number;
  contract_id?: number;
  billing_date: string;
  total_amount: number;
  totalStitches: number;
  dayStitches: number;
  nightStitches: number;
  MachineNumber: string;
  masterName: string;
  contractNumber?: string;
  poNumber?: string;
  designNos: string;
  status: string;
  created_at?: string;
  sent_yards?: number | null;
  remaining_yards?: number | null;
}

interface BillingRecord {
  id?: number;
  machineId: number;
  masterId: number;
  billingDate: string;
  designs: DesignItem[];
  totalAmount: number;
  status: 'draft' | 'saved' | 'approved';
}

const OptimizedDailyBilling: React.FC = () => {
  const queryClient = useQueryClient();

  // State
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedContractItem, setSelectedContractItem] = useState<ContractItemOption | null>(null);
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [designs, setDesigns] = useState<DesignItem[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [viewRecord, setViewRecord] = useState<HistoryRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDesigns, setEditDesigns] = useState<DesignItem[]>([]);
  const [recentlySavedId, setRecentlySavedId] = useState<number | null>(null);
  const [contractSearchTerm, setContractSearchTerm] = useState<string>('');

  // Debounced search term to reduce API calls
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(contractSearchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [contractSearchTerm]);

  // Fetch machines
  const { data: machines = [] } = useQuery<Machine[]>('machines', async () => {
    const response = await api.get('/api/machines');
    return response.data?.data || [];
  });

  // Fetch masters
  const { data: masters = [] } = useQuery<Master[]>('masters', async () => {
    const response = await api.get('/api/masters');
    return response.data?.data || [];
  });

  // Fetch contracts with search capability - filtered by selected machine (backend only)
  const { data: contracts = [], isLoading: isLoadingContracts } = useQuery<Contract[]>(
    ['contracts-lookup', debouncedSearchTerm, selectedMachine?.id], 
    async () => {
      const params = new URLSearchParams();
      if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim());
      if (selectedMachine?.id) params.set('machineId', String(selectedMachine.id));
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/api/contracts/dropdown-items${queryString}`);
      // Map response to match our Contract interface if necessary
      return response.data?.data.map((c: any) => ({
        ContractID: c.contractId,
        ContractNo: c.contractNumber,
        PONumber: c.poNumber,
        Collection: c.collection,
        DesignNo: c.designNo,
        Component: c.component,
        ItemDescription: c.itemDescription,
        ItemID: c.itemId ?? undefined, // itemId when row represents a contract item
      })) || [];
    },
    {
      enabled: !!selectedMachine, // Only fetch when machine is selected
      keepPreviousData: true, // Keep previous results while loading new ones
      staleTime: 30000, // Cache results for 30 seconds
    }
  );

  // Fetch contract items for selected contract
  const { data: contractItems = [], isLoading: isLoadingItems } = useQuery<ContractItemOption[]>(
    ['contract-items-by-contract', selectedContract?.ContractID],
    async () => {
      if (!selectedContract?.ContractID) return [];
      const response = await api.get(`/api/contract-items/by-contract/${selectedContract.ContractID}`);
      return response.data?.data || [];
    },
    {
      enabled: !!selectedContract?.ContractID,
      staleTime: 30000,
    }
  );

  // Auto-select contract item when contract row has ItemID so Rate per Stitch auto-fills on Add Design
  useEffect(() => {
    if (!selectedContract?.ItemID || !contractItems.length) return;
    const match = contractItems.find((i) => i.contractItemId === selectedContract.ItemID);
    if (match) {
      setSelectedContractItem(match);
    }
  }, [selectedContract?.ItemID, contractItems]);

  // Fetch history
  const { data: history = [], refetch: refetchHistory, isLoading: isLoadingHistory } = useQuery<HistoryRecord[]>(['billing-history'], async () => {
    const response = await api.get('/api/billing/history');
    return response.data?.data || [];
  });

  // Fetch full record for editing
  const { data: editRecordData, isLoading: isLoadingEditRecord } = useQuery(
    ['billing-record', editRecordId],
    async () => {
      if (!editRecordId) return null;
      const response = await api.get(`/api/billing/record/${editRecordId}`);
      return response.data?.data || null;
    },
    { enabled: !!editRecordId && isEditModalOpen }
  );

  // Fetch full record for viewing (same API as Edit - ensures View shows same data)
  const { data: viewRecordData, isLoading: isLoadingViewRecord } = useQuery(
    ['billing-record-view', viewRecord?.id],
    async () => {
      if (!viewRecord?.id) return null;
      const response = await api.get(`/api/billing/record/${viewRecord.id}`);
      return response.data?.data || null;
    },
    { enabled: !!viewRecord?.id && isViewModalOpen }
  );

  // Update mutation
  const updateBillingMutation = useMutation(
    (payload: { id: number; designs: DesignItem[]; totalAmount: number }) =>
      api.put(`/api/billing/record/${payload.id}`, {
        designs: payload.designs,
        totalAmount: payload.totalAmount,
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('billing-history');
        setIsEditModalOpen(false);
        setEditRecordId(null);
        setEditDesigns([]);
        setNotification({ message: 'Production record updated successfully', type: 'success' });
      },
      onError: (err: any) => {
        setNotification({
          message: err.response?.data?.error || 'Failed to update record',
          type: 'error',
        });
      },
    }
  );

  // Sync edit designs and sent yards when record loads
  useEffect(() => {
    if (editRecordData?.designs) {
      setEditDesigns(editRecordData.designs);
    }
  }, [editRecordData?.designs]);

  const handleOpenEdit = (record: HistoryRecord) => {
    setEditRecordId(record.id);
    setIsEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setEditRecordId(null);
    setEditDesigns([]);
  };

  const updateEditShiftCalculations = (
    designIndex: number,
    shift: 'dayShift' | 'nightShift',
    field: string,
    value: number
  ) => {
    const machineGazana = editRecordData?.gazana_machine ?? 0;
    setEditDesigns((prev) => {
      const updated = [...prev];
      const design = updated[designIndex];
      const shiftData = { ...design[shift] };
      (shiftData as any)[field] = value;
      if (field === 'stitchesDone' || field === 'rate') {
        shiftData.fabric = calculateFabric(machineGazana, design.dStitch, shiftData.stitchesDone);
        shiftData.perYds = calculatePerYds(design.dStitch, shiftData.rate);
        shiftData.amount = calculateShiftAmount(shiftData.fabric, shiftData.perYds, shiftData.stitchesDone, shiftData.rate);
      }
      design[shift] = shiftData;
      return updated;
    });
  };

  const updateEditDesign = (designIndex: number, field: string, value: any) => {
    const machineGazana = editRecordData?.gazana_machine ?? 0;
    setEditDesigns((prev) => {
      const updated = [...prev];
      (updated[designIndex] as any)[field] = value;
      if (field === 'dStitch') {
        const design = updated[designIndex];
        design.dayShift.fabric = calculateFabric(machineGazana, value, design.dayShift.stitchesDone);
        design.dayShift.perYds = calculatePerYds(value, design.dayShift.rate);
        design.dayShift.amount = calculateShiftAmount(design.dayShift.fabric, design.dayShift.perYds, design.dayShift.stitchesDone, design.dayShift.rate);
        design.nightShift.fabric = calculateFabric(machineGazana, value, design.nightShift.stitchesDone);
        design.nightShift.perYds = calculatePerYds(value, design.nightShift.rate);
        design.nightShift.amount = calculateShiftAmount(design.nightShift.fabric, design.nightShift.perYds, design.nightShift.stitchesDone, design.nightShift.rate);
      }
      return updated;
    });
  };

  const getEditTotalAmount = () =>
    editDesigns.reduce((sum, d) => sum + (d.dayShift?.amount || 0) + (d.nightShift?.amount || 0), 0);

  const handleUpdateBilling = () => {
    if (!editRecordId || editDesigns.length === 0) return;
    updateBillingMutation.mutate({
      id: editRecordId,
      designs: editDesigns,
      totalAmount: Math.round(getEditTotalAmount()),
    });
  };

  // Filter machines based on selected master
  const availableMachines = machines.filter((machine: Machine) =>
    !selectedMaster || machine.masterName === selectedMaster.Name
  );

  // Same formulas as Contract Management (Section 4 - Costing & Rates)
  const calculateFabric = (machineGazana: number, dStitch: number, stitchesDone: number): number => {
    return calculateFabricYards(machineGazana, dStitch, stitchesDone);
  };

  const calculatePerYds = (dStitch: number, rate: number): number => {
    return roundTo4Decimals(calculateRatePerYard(dStitch, rate));
  };

  const calculateShiftAmount = (fabric: number, perYds: number, stitchesDone: number, rate: number): number => {
    if (fabric !== undefined && fabric > 0 && perYds !== undefined) {
      return roundTo2Decimals(calculateAmount(fabric, perYds));
    }
    if (stitchesDone !== undefined && rate !== undefined) {
      return roundTo2Decimals(calculateAmountHDS(stitchesDone, rate));
    }
    return 0;
  };

  // Update shift calculations
  const updateShiftCalculations = (designIndex: number, shift: 'dayShift' | 'nightShift', field: string, value: number) => {
    setDesigns(prev => {
      const updated = [...prev];
      const design = updated[designIndex];
      const shiftData = { ...design[shift] };

      // Update the field
      (shiftData as any)[field] = value;

      // Recalculate dependent fields
      if (field === 'stitchesDone' || field === 'rate') {
        const machineGazana = selectedMachine?.gazanaMachine || 0;
        const dStitch = design.dStitch;

        shiftData.fabric = calculateFabric(machineGazana, dStitch, shiftData.stitchesDone);
        shiftData.perYds = calculatePerYds(dStitch, shiftData.rate);
        shiftData.amount = calculateShiftAmount(shiftData.fabric, shiftData.perYds, shiftData.stitchesDone, shiftData.rate);
      }

      design[shift] = shiftData;
      updated[designIndex] = design;

      return updated;
    });
  };

  // Add new design
  const addDesign = () => {
    // Use selected contract item (if any) to pre-fill design and rate from Rate per Stitch
    const baseDesignNo = selectedContractItem?.designNo ? String(selectedContractItem.designNo) : '';
    const baseDStitch = selectedContractItem?.stitch != null ? Number(selectedContractItem.stitch) : 0;
    const baseRate = selectedContractItem?.ratePerStitch != null ? Number(selectedContractItem.ratePerStitch) : 0;

    const newDesign: DesignItem = {
      designNo: baseDesignNo,
      dStitch: baseDStitch,
      dayShift: {
        stitchesDone: 0,
        fabric: 0,
        rate: baseRate,
        perYds: 0,
        amount: 0,
      },
      nightShift: {
        stitchesDone: 0,
        fabric: 0,
        rate: baseRate,
        perYds: 0,
        amount: 0,
      },
    };
    setDesigns(prev => [...prev, newDesign]);
  };

  // Remove design
  const removeDesign = (index: number) => {
    setDesigns(prev => prev.filter((_, i) => i !== index));
  };

  // Update design basic info
  const updateDesign = (index: number, field: string, value: any) => {
    setDesigns(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;

      // If dStitch changed, recalculate all dependent fields
      if (field === 'dStitch' && selectedMachine) {
        const design = updated[index];
        const machineGazana = selectedMachine.gazanaMachine;

        // Recalculate day shift (same formulas as Contract Management)
        design.dayShift.fabric = calculateFabric(machineGazana, value, design.dayShift.stitchesDone);
        design.dayShift.perYds = calculatePerYds(value, design.dayShift.rate);
        design.dayShift.amount = calculateShiftAmount(design.dayShift.fabric, design.dayShift.perYds, design.dayShift.stitchesDone, design.dayShift.rate);

        // Recalculate night shift
        design.nightShift.fabric = calculateFabric(machineGazana, value, design.nightShift.stitchesDone);
        design.nightShift.perYds = calculatePerYds(value, design.nightShift.rate);
        design.nightShift.amount = calculateShiftAmount(design.nightShift.fabric, design.nightShift.perYds, design.nightShift.stitchesDone, design.nightShift.rate);
      }

      return updated;
    });
  };

  // Calculate totals
  const getTotalAmount = () => {
    return designs.reduce((total, design) =>
      total + design.dayShift.amount + design.nightShift.amount, 0
    );
  };

  const getTotalStitches = () => {
    return designs.reduce((total, design) =>
      total + design.dayShift.stitchesDone + design.nightShift.stitchesDone, 0
    );
  };

  // Save billing record
  const saveBillingMutation = useMutation(
    (data: any) => api.post('/api/billing/daily', data),
    {
      onMutate: async (billingData) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries(['billing-history']);

        // Snapshot the previous value
        const previousHistory = queryClient.getQueryData<HistoryRecord[]>(['billing-history']);
        const tempId = Date.now(); // Generate temp ID once

        // Optimistically update the history with the new record
        if (previousHistory && selectedMachine && selectedMaster) {
          const optimisticRecord: HistoryRecord = {
            id: tempId,
            machine_id: selectedMachine.id,
            master_id: selectedMaster.MasterID,
            billing_date: billingData.billingDate,
            total_amount: billingData.totalAmount,
            status: 'draft',
            created_at: new Date().toISOString(),
            MachineNumber: selectedMachine.machineNumber,
            masterName: selectedMaster.Name,
            contractNumber: selectedContract?.ContractNo || undefined,
            poNumber: selectedContract?.PONumber || undefined,
            // Calculate day and night stitches from designs
            dayStitches: billingData.designs.reduce((sum: number, d: any) => sum + d.dayShift.stitchesDone, 0),
            nightStitches: billingData.designs.reduce((sum: number, d: any) => sum + d.nightShift.stitchesDone, 0),
            totalStitches: billingData.designs.reduce((sum: number, d: any) => 
              sum + d.dayShift.stitchesDone + d.nightShift.stitchesDone, 0),
            designNos: billingData.designs.map((d: any) => d.designNo).join(', ')
          };

          // Add the new record at the beginning of the history
          queryClient.setQueryData(['billing-history'], [optimisticRecord, ...previousHistory]);
        }

        // Return a context object with the snapshotted value and temp ID
        return { previousHistory, tempId };
      },
      onSuccess: (response, billingData, context) => {
        setNotification({ message: 'Billing record saved successfully', type: 'success' });
        
        // Reset form
        setDesigns([]);
        setSelectedMachine(null);
        setSelectedMaster(null);
        setSelectedContract(null);

        // Update the history cache with the real saved record from server
        const previousHistory = queryClient.getQueryData<HistoryRecord[]>(['billing-history']);
        if (previousHistory && response.data?.data) {
          const savedRecord = response.data.data;
          // Remove the optimistic record (with temporary ID) and add the real one
          const updatedHistory = previousHistory.filter(record => record.id !== context?.tempId);
          queryClient.setQueryData(['billing-history'], [savedRecord, ...updatedHistory]);
          
          // Track the newly saved record for highlighting
          setRecentlySavedId(savedRecord.id);
          
          // Remove the highlight after 3 seconds
          setTimeout(() => {
            setRecentlySavedId(null);
          }, 3000);
        }

        // Also invalidate and refetch to ensure consistency
        queryClient.invalidateQueries(['billing-history']);
        // Invalidate contract progress so % done and stitches/repeats left update
        queryClient.invalidateQueries(['contracts']);
        queryClient.invalidateQueries(['contract']);
      },
      onError: (error: any, billingData, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousHistory) {
          queryClient.setQueryData(['billing-history'], context.previousHistory);
        }

        const errorData = error.response?.data?.error || error.response?.data?.message;
        const errorMessage = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData;
        const errorMsg = errorMessage || error.message || 'Failed to save billing record';
        setNotification({ message: String(errorMsg), type: 'error' });
      }
    }
  );

  const handleSave = () => {
    if (!selectedMachine || !selectedMaster) {
      setNotification({ message: 'Please select machine and master', type: 'error' });
      return;
    }

    if (designs.length === 0) {
      setNotification({ message: 'Please add at least one design', type: 'error' });
      return;
    }

    const billingData = {
      machineId: selectedMachine.id,
      masterId: selectedMaster.MasterID,
      contractId: selectedContract?.ContractID,
      billingDate,
      designs,
      totalAmount: Math.round(getTotalAmount()),
    };

    saveBillingMutation.mutate(billingData);
  };

  // Render shift section
  const renderShiftSection = (
    design: DesignItem,
    designIndex: number,
    shift: 'dayShift' | 'nightShift',
    shiftName: string,
    icon: React.ReactNode
  ) => {
    const shiftData = design[shift];
    const machineGazana = selectedMachine?.gazanaMachine || 0;

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon}
          <Typography variant="h6" color={shift === 'dayShift' ? 'primary' : 'secondary'}>
            {shiftName}
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="No. of Stitches Done"
              type="number"
              fullWidth
              size="small"
              value={shiftData.stitchesDone || ''}
              onChange={(e) => updateShiftCalculations(designIndex, shift, 'stitchesDone', Number(e.target.value))}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Fabric"
              type="number"
              fullWidth
              size="small"
              value={shiftData.fabric.toFixed(4)}
              InputProps={{ readOnly: true }}
              helperText={`Fabric = (${machineGazana} ÷ ${design.dStitch}) × ${shiftData.stitchesDone}`}
              sx={{ '& .MuiInputBase-input': { backgroundColor: 'action.hover' } }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Rate"
              type="number"
              fullWidth
              size="small"
              inputProps={{ step: '0.01' }}
              value={shiftData.rate ?? ''}
              InputProps={{ readOnly: true }}
              helperText="From contract item (Rate per Stitch)"
              sx={{ '& .MuiInputBase-input': { backgroundColor: 'action.hover' } }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Per Yds"
              type="number"
              fullWidth
              size="small"
              value={shiftData.perYds.toFixed(4)}
              InputProps={{ readOnly: true }}
              helperText={`Per Yds = (${design.dStitch} ÷ 1000) × 2.77 × ${shiftData.rate}`}
              sx={{ '& .MuiInputBase-input': { backgroundColor: 'action.hover' } }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Amount"
              type="number"
              fullWidth
              size="small"
              value={shiftData.amount.toFixed(2)}
              InputProps={{ readOnly: true }}
              helperText={`Amount = ${shiftData.fabric.toFixed(2)} × ${shiftData.perYds.toFixed(2)}`}
              sx={{
                '& .MuiInputBase-input': {
                  backgroundColor: 'success.light',
                  fontWeight: 'bold',
                  color: 'success.dark'
                }
              }}
            />
          </Grid>
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {notification && (
        <Alert
          severity={notification.type}
          onClose={() => setNotification(null)}
          sx={{ mb: 2 }}
        >
          {String(notification.message)}
        </Alert>
      )}

      {/* Machine and Master Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Machine & Master Selection
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <TextField
                label="Billing Date"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={billingDate}
                onChange={(e) => setBillingDate(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <Autocomplete
                options={masters}
                getOptionLabel={(option) => option.Name || ''}
                value={selectedMaster}
                onChange={(_, newValue) => {
                  setSelectedMaster(newValue);
                  setSelectedMachine(null);
                  setSelectedContract(null);
                  setSelectedContractItem(null);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Select Master" size="small" />
                )}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <Autocomplete
                options={availableMachines}
                getOptionLabel={(option) => `${option.machineNumber} (Gazana: ${option.gazanaMachine})`}
                value={selectedMachine}
                onChange={(_, newValue) => {
                  setSelectedMachine(newValue);
                  setSelectedContract(null);
                  setSelectedContractItem(null);
                }}
                disabled={!selectedMaster}
                renderInput={(params) => (
                  <TextField {...params} label="Select Machine" size="small" />
                )}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <Autocomplete
                options={selectedMachine ? contracts : []}
                getOptionLabel={(option) => {
                  const parts = [option.ContractNo];
                  if (option.PONumber) parts.push(`(${option.PONumber})`);
                  if (option.Collection) parts.push(`- ${option.Collection}`);
                  if (option.DesignNo) parts.push(`[${option.DesignNo}]`);
                  return parts.join(' ');
                }}
                value={selectedContract}
                onChange={(_, newValue) => {
                  setSelectedContract(newValue);
                  setSelectedContractItem(null);
                  // Clear search term when a contract is selected
                  if (newValue) {
                    setContractSearchTerm('');
                  }
                }}
                onInputChange={(_, newInputValue) => {
                  setContractSearchTerm(newInputValue);
                }}
                filterOptions={(options) => options} // Disable client-side filtering since we're doing server-side
                clearOnBlur={false} // Keep the input value when focus is lost
                selectOnFocus={true} // Select all text when focused
                handleHomeEndKeys={true} // Enable Home/End key navigation
                disabled={!selectedMachine}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Select Contract / Collection" 
                    size="small"
                    placeholder={selectedMachine ? "Type to search contracts..." : "Select machine first"}
                    helperText={
                      !selectedMachine ? "Select machine first to see assigned contracts" :
                      contractSearchTerm && !isLoadingContracts ? `${contracts.length} contracts found` : ''
                    }
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {option.ContractNo} {option.PONumber && `(${option.PONumber})`}
                    </Typography>
                    {(option.Collection || option.DesignNo || option.Component) && (
                      <Typography variant="caption" color="text.secondary">
                        {[option.Collection, option.DesignNo, option.Component].filter(Boolean).join(' • ')}
                      </Typography>
                    )}
                    {option.ItemDescription && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {option.ItemDescription}
                      </Typography>
                    )}
                  </Box>
                )}
                loading={isLoadingContracts}
                loadingText="Searching contracts..."
                noOptionsText={
                  !selectedMachine ? "Select machine first" :
                  contractSearchTerm ? "No contracts found matching your search" :
                  "No contracts assigned to this machine"
                }
                ListboxProps={{
                  style: { maxHeight: '300px' } // Limit dropdown height for better UX
                }}
              />
            </Grid>

            {/* Selected Contract Details (read-only) */}
            {selectedContract && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Contract No"
                    size="small"
                    fullWidth
                    value={selectedContract.ContractNo || ''}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Design No"
                    size="small"
                    fullWidth
                    value={selectedContract.DesignNo || ''}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Component"
                    size="small"
                    fullWidth
                    value={selectedContract.Component || ''}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Autocomplete
                    options={contractItems}
                    getOptionLabel={(option) => {
                      const parts = [];
                      if (option.itemDescription) parts.push(option.itemDescription);
                      if (option.fabric) parts.push(option.fabric);
                      if (option.color) parts.push(option.color);
                      if (option.collection) parts.push(String(option.collection));
                      if (option.designNo) parts.push(String(option.designNo));
                      return parts.join(' • ') || `Item ${option.contractItemId}`;
                    }}
                    value={selectedContractItem}
                    onChange={(_, newValue) => setSelectedContractItem(newValue)}
                    loading={isLoadingItems}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Contract Item"
                        size="small"
                        placeholder="Select item from contract"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {isLoadingItems ? <CircularProgress color="inherit" size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    noOptionsText={selectedContract ? "No items for this contract" : "Select a contract first"}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12} md={12} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={addDesign}
                disabled={!selectedMachine || !selectedMaster}
                sx={{ minWidth: 150 }}
              >
                Add Design
              </Button>
            </Grid>
          </Grid>

          {selectedMachine && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Selected Machine:</strong> {selectedMachine.machineNumber} |
                <strong> Master:</strong> {(selectedMaster as Master | null)?.Name || 'Not selected'} |
                <strong> Machine Gazana:</strong> {selectedMachine.gazanaMachine}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Design Items */}
      {designs.map((design, index) => (
        <Accordion key={index} defaultExpanded sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="h6">
                Design {index + 1}: {design.designNo || 'Unnamed'}
              </Typography>
              <Chip
                label={`D-Stitch: ${design.dStitch}`}
                size="small"
                color="primary"
              />
              <Chip
                label={`Total: ${(design.dayShift.amount + design.nightShift.amount).toFixed(2)}`}
                size="small"
                color="success"
              />
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDesign(index);
                }}
              >
                <Delete />
              </IconButton>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Design No"
                  fullWidth
                  size="small"
                  value={design.designNo}
                  onChange={(e) => updateDesign(index, 'designNo', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="D-Stitch (Total Stitches for Design)"
                  type="number"
                  fullWidth
                  size="small"
                  value={design.dStitch || ''}
                  onChange={(e) => updateDesign(index, 'dStitch', Number(e.target.value))}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Day Shift */}
            {renderShiftSection(design, index, 'dayShift', 'Day Shift', <WbSunny color="primary" />)}

            <Divider sx={{ my: 2 }} />

            {/* Night Shift */}
            {renderShiftSection(design, index, 'nightShift', 'Night Shift', <NightsStay color="secondary" />)}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Summary */}
      {designs.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Billing Summary
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light' }}>
                  <Typography variant="h4" color="primary">
                    {designs.length}
                  </Typography>
                  <Typography variant="body2">Total Designs</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
                  <Typography variant="h4" color="info.dark">
                    {getTotalStitches().toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Total Stitches</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                  <Typography variant="h4" color="success.dark">
                    {Math.round(getTotalAmount())}
                  </Typography>
                  <Typography variant="body2">Total Amount</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Save />}
                  onClick={handleSave}
                  disabled={!selectedMachine || !selectedMaster || designs.length === 0}
                  fullWidth
                  sx={{ height: '100%' }}
                >
                  Save Billing Record
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Formula Reference */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Calculate /> Formula Reference
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Fabric Calculation
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  Fabric = (Machine Gazana ÷ D-Stitch) × Stitches Done
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Per Yds Calculation
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  Per Yds = (D-Stitch ÷ 1000) × 2.77 × Rate
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Amount Calculation
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  Amount = Fabric × Per Yds
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Production History Table */}
      < Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <History color="primary" />
            <Typography variant="h6">Production History</Typography>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Machine</TableCell>
                  <TableCell>Master</TableCell>
                  <TableCell>Contract / PO</TableCell>
                  <TableCell>Designs</TableCell>
                  <TableCell align="right">Day Stitches</TableCell>
                  <TableCell align="right">Night Stitches</TableCell>
                  <TableCell align="right">Total Stitches</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No production records found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((record) => (
                    <TableRow 
                      key={record.id} 
                      hover
                      sx={{
                        // Highlight newly saved records with a subtle green background
                        ...(record.id === recentlySavedId && {
                          bgcolor: 'success.light',
                          '&:hover': {
                            bgcolor: 'success.main',
                          },
                          animation: 'fadeIn 0.5s ease-in-out',
                          '@keyframes fadeIn': {
                            '0%': {
                              opacity: 0,
                              transform: 'translateY(-10px)',
                            },
                            '100%': {
                              opacity: 1,
                              transform: 'translateY(0)',
                            },
                          },
                        })
                      }}
                    >
                      <TableCell>{new Date(record.billing_date).toLocaleDateString()}</TableCell>
                      <TableCell>{record.MachineNumber}</TableCell>
                      <TableCell>{record.masterName}</TableCell>
                      <TableCell>
                        {record.contractNumber ? (
                          <Typography variant="body2">
                            {record.contractNumber}
                            {record.poNumber && <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>({record.poNumber})</Box>}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {record.designNos}
                      </TableCell>
                      <TableCell align="right">{record.dayStitches.toLocaleString()}</TableCell>
                      <TableCell align="right">{record.nightStitches.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {record.totalStitches.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        {Math.round(Number(record.total_amount))}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => handleOpenEdit(record)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            startIcon={<Visibility />}
                            onClick={() => {
                              setViewRecord(record);
                              setIsViewModalOpen(true);
                            }}
                          >
                            View
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card >

      {/* View Details Modal - uses same API as Edit so View shows the same record */}
      <Dialog
        open={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setViewRecord(null); }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          Production Details - {viewRecordData ? new Date(viewRecordData.billing_date).toLocaleDateString() : (viewRecord ? new Date(viewRecord.billing_date).toLocaleDateString() : '')}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {isLoadingViewRecord ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress />
              <Typography sx={{ mt: 1 }}>Loading record...</Typography>
            </Box>
          ) : viewRecordData && viewRecordData.designs && viewRecordData.designs.length > 0 ? (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Machine: {viewRecordData.MachineNumber}</Typography>
                  <Typography variant="subtitle2" color="text.secondary">Master: {viewRecordData.masterName}</Typography>
                  <Typography variant="subtitle2" color="text.secondary">Contract: {viewRecordData.contractNumber || 'N/A'}</Typography>
                  <Typography variant="subtitle2" color="text.secondary">Total Amount: {Math.round(Number(viewRecordData.total_amount)).toLocaleString()}</Typography>
                </Box>
              </Grid>
              {viewRecordData.designs.map((design: DesignItem, designIndex: number) => (
                <Grid item xs={12} key={designIndex}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Design {designIndex + 1}: {design.designNo || 'Unnamed'}</Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={4}>
                        <Typography variant="caption" color="text.secondary">Design No</Typography>
                        <Typography variant="body1">{design.designNo}</Typography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="caption" color="text.secondary">D-Stitch</Typography>
                        <Typography variant="body1">{design.dStitch ?? '-'}</Typography>
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      <WbSunny fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} /> Day Shift
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Stitches Done</Typography>
                        <Typography variant="body1">{(design.dayShift?.stitchesDone ?? 0).toLocaleString()}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Fabric</Typography>
                        <Typography variant="body1">{(design.dayShift?.fabric ?? 0).toFixed(4)}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Rate</Typography>
                        <Typography variant="body1">{design.dayShift?.rate ?? '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Per Yds</Typography>
                        <Typography variant="body1">{(design.dayShift?.perYds ?? 0).toFixed(4)}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Amount</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{(design.dayShift?.amount ?? 0).toFixed(2)}</Typography>
                      </Grid>
                    </Grid>
                    <Typography variant="subtitle2" color="secondary" gutterBottom>
                      <NightsStay fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} /> Night Shift
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Stitches Done</Typography>
                        <Typography variant="body1">{(design.nightShift?.stitchesDone ?? 0).toLocaleString()}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Fabric</Typography>
                        <Typography variant="body1">{(design.nightShift?.fabric ?? 0).toFixed(4)}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Rate</Typography>
                        <Typography variant="body1">{design.nightShift?.rate ?? '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Per Yds</Typography>
                        <Typography variant="body1">{(design.nightShift?.perYds ?? 0).toFixed(4)}</Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="caption" color="text.secondary">Amount</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{(design.nightShift?.amount ?? 0).toFixed(2)}</Typography>
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : viewRecord && !isLoadingViewRecord ? (
            <Typography color="text.secondary">No details found for this record.</Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setIsViewModalOpen(false); setViewRecord(null); }}>Close</Button>
          {viewRecord && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => {
                setIsViewModalOpen(false);
                setViewRecord(null);
                handleOpenEdit(viewRecord);
              }}
            >
              Edit
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Production Record Modal */}
      <Dialog open={isEditModalOpen} onClose={handleCloseEdit} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          Edit Production - {editRecordData ? new Date(editRecordData.billing_date).toLocaleDateString() : ''}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {isLoadingEditRecord ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress />
              <Typography sx={{ mt: 1 }}>Loading record...</Typography>
            </Box>
          ) : editRecordData && editDesigns.length > 0 ? (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Machine: {editRecordData.MachineNumber}</Typography>
                  <Typography variant="subtitle2" color="text.secondary">Master: {editRecordData.masterName}</Typography>
                  <Typography variant="subtitle2" color="text.secondary">Contract: {editRecordData.contractNumber || 'N/A'}</Typography>
                </Box>
              </Grid>
              {editDesigns.map((design, designIndex) => (
                <Grid item xs={12} key={designIndex}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Design {designIndex + 1}: {design.designNo || 'Unnamed'}</Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Design No"
                          size="small"
                          fullWidth
                          value={design.designNo}
                          onChange={(e) => updateEditDesign(designIndex, 'designNo', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="D-Stitch"
                          type="number"
                          size="small"
                          fullWidth
                          value={design.dStitch || ''}
                          onChange={(e) => updateEditDesign(designIndex, 'dStitch', Number(e.target.value))}
                        />
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      <WbSunny fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} /> Day Shift
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6} md={2}>
                        <TextField label="Stitches Done" type="number" size="small" fullWidth
                          value={design.dayShift.stitchesDone || ''}
                          onChange={(e) => updateEditShiftCalculations(designIndex, 'dayShift', 'stitchesDone', Number(e.target.value))} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Fabric" size="small" fullWidth value={design.dayShift.fabric.toFixed(4)} InputProps={{ readOnly: true }} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Rate" size="small" fullWidth value={design.dayShift.rate ?? ''} InputProps={{ readOnly: true }} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Per Yds" size="small" fullWidth value={design.dayShift.perYds.toFixed(4)} InputProps={{ readOnly: true }} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Amount" size="small" fullWidth value={design.dayShift.amount.toFixed(2)} InputProps={{ readOnly: true }} />
                      </Grid>
                    </Grid>
                    <Typography variant="subtitle2" color="secondary" gutterBottom>
                      <NightsStay fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} /> Night Shift
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} md={2}>
                        <TextField label="Stitches Done" type="number" size="small" fullWidth
                          value={design.nightShift.stitchesDone || ''}
                          onChange={(e) => updateEditShiftCalculations(designIndex, 'nightShift', 'stitchesDone', Number(e.target.value))} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Fabric" size="small" fullWidth value={design.nightShift.fabric.toFixed(4)} InputProps={{ readOnly: true }} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Rate" size="small" fullWidth value={design.nightShift.rate ?? ''} InputProps={{ readOnly: true }} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Per Yds" size="small" fullWidth value={design.nightShift.perYds.toFixed(4)} InputProps={{ readOnly: true }} />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <TextField label="Amount" size="small" fullWidth value={design.nightShift.amount.toFixed(2)} InputProps={{ readOnly: true }} />
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
              ))}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" color="success.main">
                  Total Amount: {Math.round(getEditTotalAmount())}
                </Typography>
              </Grid>
            </Grid>
          ) : null}
          {updateBillingMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {updateBillingMutation.error?.response?.data?.error || 'Failed to update'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>Cancel</Button>
          <Button
            onClick={handleUpdateBilling}
            variant="contained"
            startIcon={<Save />}
            disabled={!editRecordData || editDesigns.length === 0 || updateBillingMutation.isLoading}
          >
            {updateBillingMutation.isLoading ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
};

export default OptimizedDailyBilling;