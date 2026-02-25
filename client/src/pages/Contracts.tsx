import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Alert,
  Divider,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Autocomplete
} from '@mui/material';
import {
  Assignment,
  Add,
  Remove,
  Visibility,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Clear,
  Print as PrintIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Save // Added
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';
import { useAuth } from '../contexts/AuthContext';
import ContractItemMachineSelector from '../components/ContractItemMachineSelector';

// --- Interfaces ---

interface ContractItem {
  partyName?: string; // New: Party Name (shared for contract/items)
  h2hOGP: string | number;
  wteIGP: string | number;
  itemDescription: string;
  fabric: string;
  color: string;
  repeat: string | number;
  pieces: string | number;
  motif: string | number;
  lace: string | number;
  yards: string | number; // New field for Yards
  ghazanaGatepass: string | number; // Renamed from Gazana Contract
  tilla: string | number;
  sequence: string | number;
  collection: string;
  designNo: string;
  component: string;
  stitch: string | number; // Changed to number logic mostly, but string input ok
  ratePerRepeat: string | number;
  ratePerStitch: string | number; // New Field,
  gazanaCost: string | number; // Renamed from Gazana (Costing)
  calculatedRate: string | number; // New Field (Rate/meter/yard)
  totalRate: string | number; // New Field (Repeat * Rate/Repeat)
  machineGazz?: string;

  // Rate per Piece fields
  ratePerPiece?: string | number;
  pieceAmount?: string | number; // Calculated: Rate per Piece × Total Pieces
  motifRate?: string | number;
  motifAmount?: string | number; // Calculated: Motif Rate × Motif Quantity
  laceRate?: string | number;
  laceAmount?: string | number; // Calculated: Lace Rate × Lace Quantity

  assignedMachines?: Array<{
    machineId: number;
    machineNumber: string | number;
    masterName: string;
    assignedStitches?: number;
    gazana?: string;
    avgStitchesPerDay?: number; // New Field - Average Stitches per day
    repeats?: number; // New Field - No of Repeats
    estimatedDays?: number; // New Field - Total Estimated Days
  }>;
}

interface ContractFormData {
  contractNumber: string;
  contractDate: string;
  poNumber: string;
  items: ContractItem[];
}

interface Contract {
  id: number;
  contractNumber: string | number; // Updated to support alphanumeric
  contractDate: string;
  contractEndDate?: string;
  contractDuration?: number;
  poNumber: string;
  isActive?: boolean;
  progress?: string;
  items?: ContractItem[];
  collections?: string;
  isTemp?: boolean;
  status?: 'draft' | 'active' | 'completed' | 'cancelled'; // Added
  last_updated_at?: string; // Added
}

const Contracts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Removed openDialog state as we use Draft workflow now
  const [viewContractId, setViewContractId] = useState<number | null>(null);

  // Auto-Save State
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved' | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Gate Pass Prompt State
  const [showGatePassPrompt, setShowGatePassPrompt] = useState(false);
  const [lastCreatedContract, setLastCreatedContract] = useState<{ id: number, poNumber: string, contractNumber: string } | null>(null);

  // Temp Contract State
  const [openTempDialog, setOpenTempDialog] = useState(false);
  const [tempFormData, setTempFormData] = useState({
    contractDate: new Date().toISOString().split('T')[0],
    poNumber: '',
    collection: '',
    itemDescription: 'TEMP ITEM',
    stitch: '',
    pieces: ''
  });

  // -- Form State --
  const [formData, setFormData] = useState<ContractFormData>({
    contractNumber: '',
    contractDate: new Date().toISOString().split('T')[0],
    poNumber: '',
    items: [],
  });

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  // Helper function to safely extract error message
  const getErrorMessage = (error: any): string => {
    const backendError = error.response?.data?.error?.message || error.response?.data?.message || error.message;
    return typeof backendError === 'string' ? backendError : JSON.stringify(backendError);
  };

  const queryClient = useQueryClient();

  // Fetch Machines for Assignment
  const { data: machinesList = [], isLoading: isLoadingMachines } = useQuery('machines', () => api.get('/api/machines').then(res => res.data.data), {
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Fetch Masters for Assignment
  const { data: mastersList = [], isLoading: isLoadingMasters } = useQuery('masters', () => api.get('/api/masters').then(res => res.data.data), {
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // -- Edit State --
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<ContractFormData>({
    contractNumber: '',
    contractDate: '',
    poNumber: '',
    items: [],
  });

  // -- New Item Form State --
  const createEmptyItem = (): ContractItem => ({
    partyName: '',
    itemDescription: '', fabric: '', color: '', collection: '', designNo: '', component: '',
    h2hOGP: '', wteIGP: '', repeat: '', stitch: '', tilla: '', sequence: '',
    pieces: '', motif: '', lace: '', yards: '', ghazanaGatepass: '', gazanaCost: '',
    ratePerRepeat: '', ratePerStitch: '', calculatedRate: '', totalRate: '',
    ratePerPiece: '', pieceAmount: '', motifRate: '', motifAmount: '', laceRate: '', laceAmount: '',
    machineGazz: '', assignedMachines: []
  });

  const [currentItem, setCurrentItem] = useState<ContractItem>(createEmptyItem());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showItemErrors, setShowItemErrors] = useState(false);

  // Common Fields Logic
  const [isCommonFieldsLocked, setIsCommonFieldsLocked] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);

  // -- Data Fetching (List) - list-items for full columns; contracts for count and fallback
  const { data: contractsData } = useQuery<{ contracts: Contract[], total: number }>(
    'contracts',
    async () => {
      const response = await api.get('/api/contracts?limit=1000&status=active');
      return {
        contracts: response.data?.data || [],
        total: response.data?.pagination?.total || 0
      };
    }
  );

  const { data: listItemsData, isLoading } = useQuery<any[]>(
    ['contracts-list-items'],
    async () => {
      const response = await api.get('/api/contracts/list-items?limit=1000&status=active');
      return response.data?.data || [];
    },
    { retry: 2 }
  );

  // Helper to get value (handles DB returning different key casing, e.g. stitch vs Stitch)
  const getVal = (row: any, key: string) => {
    const keys = [key, key.charAt(0).toUpperCase() + key.slice(1), key.replace(/([A-Z])/g, '_$1').toLowerCase()];
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null) return row[k];
    }
    return row[key];
  };

  // Use list-items when available; otherwise flatten contracts for display
  const displayRows = React.useMemo(() => {
    if (listItemsData && listItemsData.length > 0) {
      return listItemsData.map((row: any) => ({
        contractId: getVal(row, 'contractId'),
        itemId: getVal(row, 'itemId'),
        contractNumber: getVal(row, 'contractNumber'),
        contractDate: getVal(row, 'contractDate'),
        poNumber: getVal(row, 'poNumber'),
        collection: getVal(row, 'collection'),
        designNo: getVal(row, 'designNo'),
        component: getVal(row, 'component'),
        stitch: getVal(row, 'stitch'),
        rate: getVal(row, 'rate'),
        repeat: getVal(row, 'repeat'),
        pieces: getVal(row, 'pieces'),
        yards: getVal(row, 'yards'),
        totalAmount: getVal(row, 'totalAmount'),
        totalEstimatedDays: Number(getVal(row, 'totalEstimatedDays') || 0)
      }));
    }
    // Fallback: use contracts (one row per contract, item columns empty)
    const contracts = contractsData?.contracts || [];
    return contracts.map((c: any) => ({
      contractId: c.id,
      itemId: null,
      contractNumber: c.contractNumber,
      contractDate: c.contractDate,
      poNumber: c.poNumber,
      collection: c.collections || null,
      designNo: c.designNos || null,
      component: null,
      stitch: null,
      rate: null,
      repeat: null,
      pieces: null,
      yards: null,
      totalAmount: null,
      totalEstimatedDays: Number(c.totalEstimatedDays || 0)
    }));
  }, [listItemsData, contractsData]);

  const totalContractsCount = contractsData?.total || 0;

  // -- Data Fetching (Single Details) --
  const { data: contractDetails, isLoading: isLoadingDetails, error: contractDetailsError } = useQuery<Contract>(
    ['contract', viewContractId],
    async () => {
      console.log('Fetching contract details for ID:', viewContractId);
      const response = await api.get(`/api/contracts/${viewContractId}`);
      console.log('Contract details response:', response.data);
      return response.data?.data || response.data;
    },
    {
      enabled: !!viewContractId,
      retry: 3,
      retryDelay: 1000,
      onError: (error: any) => {
        console.error('Failed to fetch contract details:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
        setNotification({
          message: `Failed to load contract details: ${errorMessage}`,
          type: 'error'
        });
      },
      onSuccess: (data) => {
        if (data) {
          const items = data.items ? data.items.map(item => ({
            ...item,
          partyName: (item as any).partyName || '',
            repeat: item.repeat || 0,
            ghazanaGatepass: item.ghazanaGatepass || 0,
            pieces: item.pieces || 0,
            motif: item.motif || 0,
            lace: item.lace || 0,
            yards: item.yards || 0,
            collection: item.collection || '',
            designNo: item.designNo || '',
            component: item.component || '',
            stitch: item.stitch || '',
            ratePerRepeat: item.ratePerRepeat || '',
            ratePerStitch: item.ratePerStitch || '',
            calculatedRate: item.calculatedRate || '',
            totalRate: item.totalRate || '',
            machineGazz: item.machineGazz || '',
            gazanaCost: item.gazanaCost || '',
            ratePerPiece: item.ratePerPiece || '',
            pieceAmount: item.pieceAmount || '',
            motifRate: item.motifRate || '',
            motifAmount: item.motifAmount || '',
            laceRate: item.laceRate || '',
            laceAmount: item.laceAmount || '',
            assignedMachines: item.assignedMachines || []
          })) as ContractItem[] : [];

          setEditFormData({
            contractNumber: String(data.contractNumber),
            contractDate: data.contractDate ? new Date(data.contractDate).toISOString().split('T')[0] : '',
            poNumber: data.poNumber,
            items: items,
          });
        }
      }
    }
  );

  const createDraftMutation = useMutation(
    (draftData: any) => {
      console.log('Creating draft with data:', draftData);
      return api.post('/api/contracts', { ...draftData, status: 'draft' });
    },
    {
      onSuccess: (response) => {
        console.log('Draft Created RAW Response:', response);
        const body = response.data;
        // Parse ID carefully
        let newId: number | null = null;
        if (typeof body === 'number') newId = body;
        else if (body && body.data) {
          if (typeof body.data === 'number') newId = body.data;
          else if (body.data.id) newId = body.data.id;
        }

        console.log('Parsed Draft ID:', newId);

        if (newId) {
          queryClient.invalidateQueries('contracts');
          queryClient.invalidateQueries(['contracts-list-items']);
          // Add a small delay before setting the view contract ID to ensure the contract is available
          setTimeout(() => {
            setViewContractId(newId!);
            setIsEditing(true);
          }, 500);
          setNotification({ message: 'Draft created successfully. Opening for editing...', type: 'success' });
        } else {
          console.error('Failed to parse ID from response');
          setNotification({ message: 'Error: Could not parse Draft ID.', type: 'error' });
        }
      },
      onError: (error: any) => {
        console.error('Draft Creation Failed:', error);
        setNotification({ message: `Failed to create draft: ${getErrorMessage(error)}`, type: 'error' });
      }
    }
  );

  const updateDraftMutation = useMutation(
    (data: { id: number, payload: any }) => api.put(`/api/contracts/${data.id}/draft`, data.payload),
    {
      onMutate: () => setAutoSaveStatus('saving'),
      onSuccess: () => {
        setAutoSaveStatus('saved');
        setLastSaved(new Date());
        queryClient.invalidateQueries(['contract', viewContractId]);
        // Don't invalidate list every auto-save to avoid flicker, or do throttle
      },
      onError: () => setAutoSaveStatus(null)
    }
  );

  // Replaces createContractMutation for final save? No, finalize replaces it.
  // Standard create logic is now "Finalize Draft" or just "Save Draft"?
  // If user wants to "Create Contract" directly, we now create draft -> finalize.


  const createTempContractMutation = useMutation(
    (data: any) => api.post('/api/contracts/temp', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contracts');
        queryClient.invalidateQueries(['contracts-list-items']);
        setNotification({ message: 'Temp Contract created successfully!', type: 'success' });
        setOpenTempDialog(false);
        setTempFormData({
          contractDate: new Date().toISOString().split('T')[0],
          poNumber: '',
          collection: '',
          itemDescription: 'TEMP ITEM',
          stitch: '',
          pieces: ''
        });
      },
      onError: (error: any) => {
        const backendError = error.response?.data?.error?.message || error.response?.data?.message || error.message;
        setNotification({ message: `Failed: ${backendError}`, type: 'error' });
      }
    }
  );

  const finalizeContractMutation = useMutation(
    (data: { id: number, payload: any }) => api.put(`/api/contracts/${data.id}/finalize`, data.payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contracts');
        queryClient.invalidateQueries(['contracts-list-items']);
        queryClient.invalidateQueries(['contract', viewContractId]);
        setNotification({ message: 'Contract Finalized successfully!', type: 'success' });
        setIsEditing(false);
      },
      onError: (error: any) => {
        const backendError = error.response?.data?.error?.message || error.response?.data?.message || error.message;
        setNotification({ message: `Failed: ${backendError}`, type: 'error' });
      }
    }
  );

  const updateContractMutation = useMutation(
    (updatedContract: any) => api.put(`/api/contracts/${viewContractId}`, updatedContract),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contracts');
        queryClient.invalidateQueries(['contracts-list-items']);
        queryClient.invalidateQueries(['contract', viewContractId]);
        setNotification({ message: 'Contract updated successfully!', type: 'success' });
        setIsEditing(false);
        setTimeout(() => { setNotification(null); }, 2000);
      },
      onError: (error: any) => {
        const backendError = error.response?.data?.error?.message || error.response?.data?.message || error.message;
        setNotification({ message: `Failed: ${backendError}`, type: 'error' });
      }
    }
  );

  // Auto-Save Effect
  useEffect(() => {
    if (!viewContractId || !isEditing || !contractDetails) return;
    if (contractDetails.status !== 'draft') return; // Only auto-save drafts

    // Debounce logic
    const timer = setTimeout(() => {
      // Check if form data differs from initial? 
      // For now, just save whatever is in editFormData if it's valid-ish or just save.
      // We skip strict validation for draft auto-save.
      // Check if dirty? (Optimization)

      // Construct payload
      const payload = buildPayload(editFormData);
      // We only save if we have at least a contract number or something?
      // Actually, just save.
      updateDraftMutation.mutate({ id: viewContractId, payload });
    }, 3000); // 3 seconds debounce

    return () => clearTimeout(timer);
  }, [editFormData, viewContractId, isEditing, contractDetails?.status]);

  const handleCreateNewClick = async () => {
    try {
      const response = await api.get('/api/contracts/next-number');
      const nextNumber = response.data.data;

      createDraftMutation.mutate({
        contractNumber: nextNumber,
        contractDate: new Date().toISOString().split('T')[0],
        poNumber: 'PENDING',
        status: 'draft',
        items: []
      });
    } catch (error: any) {
      console.error('Failed to fetch next contract number:', error);
      const errorMsg = error.response?.status ? `HTTP-${error.response.status}` : (error.message || 'UNKNOWN');
      // Fallback with visible error tag
      createDraftMutation.mutate({
        contractNumber: `ERR-${errorMsg}-${Date.now()}`,
        contractDate: new Date().toISOString().split('T')[0],
        poNumber: 'PENDING',
        status: 'draft',
        items: []
      });
    }
  };

  const handleSaveDraftManual = () => {
    if (viewContractId) {
      updateDraftMutation.mutate({ id: viewContractId, payload: buildPayload(editFormData) });
      setNotification({ message: 'Draft saved manually.', type: 'success' });
    }
  };

  const deleteContractMutation = useMutation(
    (contractId: number) => api.delete(`/api/contracts/${contractId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contracts');
        queryClient.invalidateQueries(['contracts-list-items']);
        setNotification({ message: 'Contract deleted successfully!', type: 'success' });
        setTimeout(() => {
          handleCloseViewDialog();
        }, 1000);
      },
      onError: (error: any) => {
        setNotification({ message: `Failed to delete: ${getErrorMessage(error)}`, type: 'error' });
      }
    }
  );

  const handleDeleteContract = (id?: number) => {
    const targetId = id || viewContractId;
    if (!targetId) return;

    if (window.confirm("Are you sure you want to delete this contract? This action will mark it as inactive.")) {
      deleteContractMutation.mutate(targetId);
    }
  };


  const resetForm = () => {
    setFormData({
      contractNumber: '',
      contractDate: new Date().toISOString().split('T')[0],
      poNumber: '',
      items: [],
    });
    setCurrentItem(createEmptyItem());
    setEditingIndex(null);
    setShowItemErrors(false);
  };

  // -- Item Form Handlers & Logic --

  useEffect(() => {
    if (!isEditing) {
      setIsCommonFieldsLocked(formData.items.length > 0);
    }
  }, [isEditing, formData.items.length]);

  // Auto-Calculate Effect
  useEffect(() => {
    const stitchVal = parseFloat(currentItem.stitch as string);
    const rateStitchVal = parseFloat(currentItem.ratePerStitch as string);
    const gazanaCostVal = parseFloat(currentItem.gazanaCost as string);

    let newCalculatedRate = parseFloat(currentItem.calculatedRate as string);

    // 1. Calculate Rate/Meter/Yard
    if (!isNaN(stitchVal) && !isNaN(rateStitchVal)) {
      // Formula: ((stich * rate_per_stich ) /1000) * 2.77
      const calc = ((stitchVal * rateStitchVal) / 1000) * 2.77;
      newCalculatedRate = parseFloat(calc.toFixed(4));
    }

    // 2. Calculate Rate/Repeat based on Rate/Meter/Yard * Gazana (Cost)
    let newRatePerRepeat = parseFloat(currentItem.ratePerRepeat as string);

    // Only auto-calc if we have a valid calculated rate (or if it was just calculated) and gazanaCost
    if (!isNaN(newCalculatedRate) && !isNaN(gazanaCostVal)) {
      const calcRepeat = newCalculatedRate * gazanaCostVal;
      newRatePerRepeat = parseFloat(calcRepeat.toFixed(4));
    }

    // 3. Calculate Item Total Rate (Repeat * Rate/Repeat)
    let newTotalRate = parseFloat(currentItem.totalRate as string);
    if (!isNaN(newRatePerRepeat) && !isNaN(parseFloat(currentItem.repeat as string))) {
      const repeatVal = parseFloat(currentItem.repeat as string);
      const calcTotal = repeatVal * newRatePerRepeat;
      newTotalRate = parseFloat(calcTotal.toFixed(4));
    }

    // Update state if changes
    if (newCalculatedRate !== parseFloat(currentItem.calculatedRate as string) ||
      newRatePerRepeat !== parseFloat(currentItem.ratePerRepeat as string) ||
      newTotalRate !== parseFloat(currentItem.totalRate as string)) {

      // Avoid NaN updates if inputs are empty
      const finalCalculatedRate = isNaN(newCalculatedRate) ? (currentItem.calculatedRate || '') : newCalculatedRate;
      const finalRatePerRepeat = isNaN(newRatePerRepeat) ? (currentItem.ratePerRepeat || '') : newRatePerRepeat;
      const finalTotalRate = isNaN(newTotalRate) ? (currentItem.totalRate || '') : newTotalRate;

      if (finalCalculatedRate !== currentItem.calculatedRate || finalRatePerRepeat !== currentItem.ratePerRepeat || finalTotalRate !== currentItem.totalRate) {
        setCurrentItem(prev => ({
          ...prev,
          calculatedRate: finalCalculatedRate,
          ratePerRepeat: finalRatePerRepeat,
          totalRate: finalTotalRate
        }));
      }
    }
  }, [currentItem.stitch, currentItem.ratePerStitch, currentItem.gazanaCost, currentItem.repeat, currentItem.ratePerRepeat, currentItem.calculatedRate, currentItem.totalRate]);

  // Auto-Calculate Effect for Piece-based Rates
  useEffect(() => {
    const ratePerRepeatVal = parseFloat(currentItem.ratePerRepeat as string);
    const gazana = parseFloat(currentItem.gazanaCost as string);
    const totalPieces = parseFloat(currentItem.pieces as string);
    const motifRateVal = parseFloat(currentItem.motifRate as string);
    const motifQty = parseFloat(currentItem.motif as string);
    const laceRateVal = parseFloat(currentItem.laceRate as string);
    const laceQty = parseFloat(currentItem.lace as string);

    // Derive heads based on gazana cost
    let heads = 0;
    if (!isNaN(gazana)) {
      if (Math.abs(gazana - 10.11) < 0.001) heads = 14;
      else if (Math.abs(gazana - 11.55) < 0.001) heads = 16;
      else if (Math.abs(gazana - 2.88) < 0.001) heads = 4;
    }

    // Calculate Rate per Piece = Rate per Repeat / Heads
    let newRatePerPiece = parseFloat(currentItem.ratePerPiece as string);
    if (!isNaN(ratePerRepeatVal) && heads > 0) {
      newRatePerPiece = parseFloat((ratePerRepeatVal / heads).toFixed(4));
    }

    // Calculate Piece Amount = Rate per Piece × Total Pieces
    let newPieceAmount = parseFloat(currentItem.pieceAmount as string);
    if (!isNaN(newRatePerPiece) && !isNaN(totalPieces)) {
      newPieceAmount = parseFloat((newRatePerPiece * totalPieces).toFixed(4));
    }

    // Calculate Motif Amount
    let newMotifAmount = parseFloat(currentItem.motifAmount as string);
    if (!isNaN(motifRateVal) && !isNaN(motifQty)) {
      newMotifAmount = parseFloat((motifRateVal * motifQty).toFixed(4));
    }

    // Calculate Lace Amount
    let newLaceAmount = parseFloat(currentItem.laceAmount as string);
    if (!isNaN(laceRateVal) && !isNaN(laceQty)) {
      newLaceAmount = parseFloat((laceRateVal * laceQty).toFixed(4));
    }

    // Prepare final values (keep read-only semantics)
    const finalRatePerPiece = isNaN(newRatePerPiece) ? (currentItem.ratePerPiece || '') : newRatePerPiece;
    const finalPieceAmount = isNaN(newPieceAmount) ? (currentItem.pieceAmount || '') : newPieceAmount;
    const finalMotifAmount = isNaN(newMotifAmount) ? (currentItem.motifAmount || '') : newMotifAmount;
    const finalLaceAmount = isNaN(newLaceAmount) ? (currentItem.laceAmount || '') : newLaceAmount;

    if (
      finalRatePerPiece !== currentItem.ratePerPiece ||
      finalPieceAmount !== currentItem.pieceAmount ||
      finalMotifAmount !== currentItem.motifAmount ||
      finalLaceAmount !== currentItem.laceAmount
    ) {
      setCurrentItem(prev => ({
        ...prev,
        ratePerPiece: finalRatePerPiece,
        pieceAmount: finalPieceAmount,
        motifAmount: finalMotifAmount,
        laceAmount: finalLaceAmount
      }));
    }
  }, [
    currentItem.ratePerRepeat,
    currentItem.gazanaCost,
    currentItem.pieces,
    currentItem.motifRate,
    currentItem.motif,
    currentItem.laceRate,
    currentItem.lace,
    currentItem.ratePerPiece,
    currentItem.pieceAmount,
    currentItem.motifAmount,
    currentItem.laceAmount
  ]);

  const handleCurrentItemChange = (field: keyof ContractItem, value: any) => {
    setCurrentItem(prev => ({ ...prev, [field]: value }));
  };

  const handleAddOrUpdateItem = (isEditMode: boolean) => {
    // Basic validation for Item
    if (!currentItem.itemDescription || !currentItem.fabric || !currentItem.color) {
      setShowItemErrors(true);
      setNotification({ message: "Please fill in the required fields (Description, Fabric, Color) highlighted in red.", type: 'error' });
      return;
    }
    // Validation for Machine
    if (!currentItem.assignedMachines || currentItem.assignedMachines.length === 0) {
      setNotification({ message: "Please assign at least one Machine for this item (Section 5).", type: 'error' });
      return;
    }

    // Validation: Avg Stitches per day must be > 0 for all assigned machines
    const invalidMachines = currentItem.assignedMachines.filter(m => !m.avgStitchesPerDay || m.avgStitchesPerDay <= 0);
    if (invalidMachines.length > 0) {
      setNotification({ message: "Please provide valid 'Avg Stitches per day' (> 0) for all assigned machines.", type: 'error' });
      return;
    }

    // Validation for Stitches
    const itemStitchPerRepeat = parseFloat(currentItem.stitch as string) || 0;
    const itemRepeats = parseFloat(currentItem.repeat as string) || 1;
    const itemStitchTotal = itemStitchPerRepeat * itemRepeats;
    const assignedTotal = currentItem.assignedMachines.reduce((sum, m) => sum + (m.assignedStitches || 0), 0);

    if (Math.abs(itemStitchTotal - assignedTotal) > 0.01) {
      setNotification({
        message: `Stitch Mismatch! Total allocated stitches (${assignedTotal.toLocaleString()}) does not match Item Total Stitches (${itemStitchTotal.toLocaleString()}). You can still proceed, but please verify.`,
        type: 'warning'
      });
      // Removed: return; - Allowing user to proceed with mismatch
    }

    if (isEditMode) {
      // Update in Edit Mode (View Dialog)
      setEditFormData(prev => {
        const newItems = [...prev.items];
        if (editingIndex !== null && editingIndex >= 0) {
          newItems[editingIndex] = currentItem;
        } else {
          newItems.push(currentItem);
        }
        return { ...prev, items: newItems };
      });
    } else {
      // Update in Create Mode (Create Dialog)
      setFormData(prev => {
        const newItems = [...prev.items];
        if (editingIndex !== null && editingIndex >= 0) {
          newItems[editingIndex] = currentItem;
        } else {
          newItems.push(currentItem);
        }
        return { ...prev, items: newItems };
      });
    }

    // Partial Reset Form (Keep Common Fields)
    setIsCommonFieldsLocked(true);

    // Explicitly keep section 1 fields, reset others but RESET MACHINE
    setCurrentItem(prev => ({
      ...createEmptyItem(),
      h2hOGP: prev.h2hOGP,
      wteIGP: prev.wteIGP,
      collection: prev.collection,
      designNo: prev.designNo,
      component: prev.component,
      // Reset Machine Assignment for new item
      assignedMachines: []
    }));

    setEditingIndex(null);
    setShowItemErrors(false);
    setNotification(null);
  };

  const handleUnlockCommonFields = () => {
    setConfirmUnlockOpen(true);
  };

  const confirmUnlock = () => {
    setIsCommonFieldsLocked(false);
    setConfirmUnlockOpen(false);
  };

  const handleEditItemFromList = (index: number, item: ContractItem) => {
    setCurrentItem(item);
    setEditingIndex(index);
  };

  const removeItemFromList = (index: number, isEditMode: boolean) => {
    if (isEditMode) {
      setEditFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
    // If we were editing this item, cancel edit
    if (editingIndex === index) {
      setCurrentItem(createEmptyItem());
      setEditingIndex(null);
      setShowItemErrors(false);
    }
  };

  const clearItemForm = () => {
    setCurrentItem(createEmptyItem());
    setEditingIndex(null);
    setShowItemErrors(false);
    setIsCommonFieldsLocked(false); // Allow full reset on clear
  };

  const validateForm = (data: ContractFormData) => {
    if (!data.contractDate) return "Contract Date is required.";
    if (!data.poNumber) return "PO Number is required.";
    if (data.items.length === 0) return "At least one item is required.";
    return null;
  };

  const buildPayload = (data: ContractFormData) => {
    return {
      contractNumber: data.contractNumber,
      contractDate: data.contractDate,
      poNumber: data.poNumber,
      items: data.items.map(item => ({
        id: (item as any).id || (item as any).ContractItemID, // Pass ID for backend Upsert logic
        h2hOGP: item.h2hOGP ? parseFloat(item.h2hOGP as string) : null,
        wteIGP: item.wteIGP ? parseFloat(item.wteIGP as string) : null,
        itemDescription: item.itemDescription,
        fabric: item.fabric,
        color: item.color,
        repeat: parseFloat(item.repeat as string) || 0,
        pieces: parseInt(item.pieces as string) || 0,
        motif: parseInt(item.motif as string) || 0,
        lace: parseInt(item.lace as string) || 0,
        yards: parseFloat(item.yards as string) || 0,
        ghazanaGatepass: parseFloat(item.ghazanaGatepass as string) || 0,
        tilla: item.tilla,
        sequence: item.sequence,
        gazanaCost: item.gazanaCost ? parseFloat(item.gazanaCost as string) : null,
        collection: item.collection,
        designNo: item.designNo,
        component: item.component,
        stitch: item.stitch ? parseFloat(item.stitch as string) : null,
        ratePerRepeat: item.ratePerRepeat ? parseFloat(item.ratePerRepeat as string) : null,
        ratePerStitch: item.ratePerStitch ? parseFloat(item.ratePerStitch as string) : null,
        calculatedRate: item.calculatedRate ? parseFloat(item.calculatedRate as string) : null,
        totalRate: item.totalRate ? parseFloat(item.totalRate as string) : null,
        ratePerPiece: item.ratePerPiece ? parseFloat(item.ratePerPiece as string) : null,
        pieceAmount: item.pieceAmount ? parseFloat(item.pieceAmount as string) : null,
        motifRate: item.motifRate ? parseFloat(item.motifRate as string) : null,
        motifAmount: item.motifAmount ? parseFloat(item.motifAmount as string) : null,
        laceRate: item.laceRate ? parseFloat(item.laceRate as string) : null,
        laceAmount: item.laceAmount ? parseFloat(item.laceAmount as string) : null,
        assignedMachines: item.assignedMachines?.map(m => ({
          machineId: m.machineId,
          assignedStitches: m.assignedStitches || 0,
          avgStitchesPerDay: m.avgStitchesPerDay || 0,
          repeats: m.repeats || 0,
          estimatedDays: m.estimatedDays || 0
        })) || []
      }))
    };
  };




  const handleCreateTempContract = () => {
    createTempContractMutation.mutate({
      contractDate: tempFormData.contractDate,
      poNumber: tempFormData.poNumber,
      collection: tempFormData.collection,
      item: {
        itemDescription: tempFormData.itemDescription,
        stitch: tempFormData.stitch,
        pieces: tempFormData.pieces
      }
    });
  };

  const handleFinalize = () => {
    // Validate
    const error = validateForm(editFormData);
    if (error) { setNotification({ message: error, type: 'error' }); return; }

    if (!window.confirm("Are you sure you want to Finalize this contract? It will be converted to a permanent contract.")) return;

    finalizeContractMutation.mutate({
      id: viewContractId!,
      payload: buildPayload(editFormData)
    });
  };

  const handleSaveEdit = () => {
    // Check for unsaved item
    // Refactored to ignore Shared Fields (Section 1) - only explicit item fields count as dirty
    const isItemDirty = currentItem.itemDescription || currentItem.fabric || currentItem.color || currentItem.repeat || currentItem.pieces || currentItem.motif || currentItem.lace || currentItem.ghazanaGatepass || currentItem.tilla || currentItem.sequence || currentItem.gazanaCost || currentItem.stitch;

    if (isItemDirty) {
      setNotification({ message: "You have an unsaved item in the form. Please click 'Update Item' (or Clear) before saving changes.", type: 'error' });
      return;
    }

    const error = validateForm(editFormData);
    if (error) { setNotification({ message: error, type: 'error' }); return; }
    updateContractMutation.mutate(buildPayload(editFormData));
  };

  const handleCloseViewDialog = () => {
    setViewContractId(null);
    setIsEditing(false);
    setNotification(null);
    setEditingIndex(null);
    setCurrentItem(createEmptyItem());
    setShowItemErrors(false);
  };

  const handlePrint = () => {
    if (!contractDetails) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    const totalNetRate = (contractDetails.items || []).reduce((sum, item) => sum + (parseFloat(item.totalRate as string) || 0), 0).toFixed(2);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Contract #${contractDetails.contractNumber}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { margin: 0; text-transform: uppercase; letter-spacing: 2px; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-radius: 4px; }
          .info-item label { display: block; font-size: 0.85em; color: #666; font-weight: bold; }
          .info-item span { font-size: 1.1em; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9em; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; font-size: 0.8em; }
          tr:nth-child(even) { background-color: #fafafa; }
          .totals { margin-top: 30px; text-align: right; border-top: 2px solid #333; padding-top: 10px; }
          .totals-label { font-size: 1.2em; font-weight: bold; margin-right: 15px; }
          .totals-value { font-size: 1.5em; font-weight: bold; color: #2e7d32; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
            th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Contract Details</h1>
        </div>
        
        <div class="info-grid">
          <div class="info-item">
            <label>Contract #</label>
            <span>${contractDetails.contractNumber}</span>
          </div>
          <div class="info-item">
            <label>Date</label>
            <span>${new Date(contractDetails.contractDate).toLocaleDateString()}</span>
          </div>
          <div class="info-item">
            <label>PO Number</label>
            <span>${contractDetails.poNumber}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Contract #</th>
              <th>Date</th>
              <th>PO Number</th>
              <th>Collection</th>
              <th>Design No</th>
              <th>Component</th>
              <th>Stitch</th>
              <th>Rate</th>
              <th>Repeat</th>
              <th>Pieces</th>
              <th>Yards</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(contractDetails.items || []).map(item => `
              <tr>
                <td>${contractDetails.contractNumber}</td>
                <td>${new Date(contractDetails.contractDate).toLocaleDateString()}</td>
                <td>${contractDetails.poNumber}</td>
                <td>${item.collection || '-'}</td>
                <td>${item.designNo || '-'}</td>
                <td>${item.component || '-'}</td>
                <td>${item.stitch != null ? Number(item.stitch).toLocaleString() : '-'}</td>
                <td>${item.ratePerStitch != null ? Number(item.ratePerStitch).toFixed(2) : '-'}</td>
                <td>${item.repeat != null ? Number(item.repeat).toLocaleString() : '-'}</td>
                <td>${item.pieces != null ? Number(item.pieces).toLocaleString() : '-'}</td>
                <td>${item.yards != null ? Number(item.yards).toFixed(2) : '-'}</td>
                <td style="font-weight: bold;">${item.totalRate != null ? Number(item.totalRate).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <span class="totals-label">Net Contract Rate:</span>
          <span class="totals-value">${totalNetRate}</span>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    if (!contractDetails) return;

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text(`Contract #${contractDetails.contractNumber}`, 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date(contractDetails.contractDate).toLocaleDateString()}`, 14, 30);
    doc.text(`PO Number: ${contractDetails.poNumber}`, 14, 36);

    // Table - columns: Contract #, Date, PO Number, Collection, Design No, Component, Stitch, Rate, Repeat, Pieces, Yards, Total Amount
    const tableColumn = ["Contract #", "Date", "PO #", "Collection", "Design No", "Component", "Stitch", "Rate", "Repeat", "Pieces", "Yards", "Total"];
    const tableRows: any[] = [];

    (contractDetails.items || []).forEach(item => {
      const rowData = [
        String(contractDetails.contractNumber),
        new Date(contractDetails.contractDate).toLocaleDateString(),
        contractDetails.poNumber,
        item.collection || '-',
        item.designNo || '-',
        item.component || '-',
        item.stitch != null ? String(item.stitch) : '-',
        item.ratePerStitch != null ? Number(item.ratePerStitch).toFixed(2) : '-',
        item.repeat != null ? String(item.repeat) : '-',
        item.pieces != null ? String(item.pieces) : '-',
        item.yards != null ? Number(item.yards).toFixed(2) : '-',
        item.totalRate != null ? Number(item.totalRate).toFixed(2) : '-'
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 18 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 14 },
        7: { cellWidth: 14 },
        8: { cellWidth: 14 },
        9: { cellWidth: 14 },
        10: { cellWidth: 14 },
        11: { cellWidth: 18, fontStyle: 'bold' }
      }
    });

    // Totals
    const totalNetRate = (contractDetails.items || []).reduce((sum, item) => sum + (parseFloat(item.totalRate as string) || 0), 0).toFixed(2);
    const finalY = (doc as any).lastAutoTable.finalY || 50;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Net Contract Rate: ${totalNetRate}`, 14, finalY + 10);

    doc.save(`contract_${contractDetails.contractNumber}.pdf`);
  };

  // --- Sub-Components ---

  const renderItemForm = (isEditMode: boolean) => (
    <Box sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
      <Typography variant="subtitle2" gutterBottom color="primary">
        {editingIndex !== null ? 'Update Item' : 'Add New Item'}
      </Typography>

      {/* Reordered Fields based on User Request - Grouped */}

      {/* Section 1: Machine & Design Specs */}
      <Box sx={{ mb: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, position: 'relative' }}>
        <Box display="flex" alignItems="center" mb={1.5}>
          <Typography variant="subtitle2" sx={{ color: '#1976d2', fontWeight: 'bold', mr: 1 }}>Section 1: Machine & Design Specs</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 2 }}>(Shared for all items)</Typography>
          {isCommonFieldsLocked && (
            <Chip
              icon={<LockIcon style={{ fontSize: 16 }} />}
              label="Locked"
              size="small"
              color="default"
              variant="outlined"
              onClick={handleUnlockCommonFields}
              sx={{ cursor: 'pointer', height: 24 }}
            />
          )}
          {isCommonFieldsLocked && (
            <Button size="small" onClick={handleUnlockCommonFields} sx={{ ml: 1, fontSize: '0.7rem' }}>Edit</Button>
          )}
        </Box>

        {/* Master Selection Removed from Section 1 - Moved to Section 5 (Isolated) */}
        {/* <Grid container spacing={2} sx={{ mb: 2 }}>...</Grid> */}

        <Grid container spacing={2}>
          {/* 0. Party Name */}
          <Grid item xs={12} md={4}>
            <TextField
              label="Party Name"
              fullWidth
              size="small"
              disabled={isCommonFieldsLocked}
              value={currentItem.partyName}
              onChange={e => handleCurrentItemChange('partyName', e.target.value)}
            />
          </Grid>
          {/* 1. H2H OGP */}
          <Grid item xs={6} md={2}>
            <TextField label="H2H OGP" fullWidth size="small" type="number"
              disabled={isCommonFieldsLocked}
              value={currentItem.h2hOGP} onChange={e => handleCurrentItemChange('h2hOGP', e.target.value)} />
          </Grid>
          {/* 2. WTE IGP */}
          <Grid item xs={6} md={2}>
            <TextField label="WTE IGP" fullWidth size="small" type="number"
              disabled={isCommonFieldsLocked}
              value={currentItem.wteIGP} onChange={e => handleCurrentItemChange('wteIGP', e.target.value)} />
          </Grid>
          {/* 3. Collection */}
          <Grid item xs={6} md={2}>
            <TextField label="Collection" fullWidth size="small"
              disabled={isCommonFieldsLocked}
              value={currentItem.collection} onChange={e => handleCurrentItemChange('collection', e.target.value)} />
          </Grid>
          {/* 4. Design No */}
          <Grid item xs={6} md={2}>
            <TextField label="Design No" fullWidth size="small"
              disabled={isCommonFieldsLocked}
              value={currentItem.designNo} onChange={e => handleCurrentItemChange('designNo', e.target.value)} />
          </Grid>
          {/* 5. Component */}
          <Grid item xs={6} md={3}>
            <TextField label="Component" fullWidth size="small"
              disabled={isCommonFieldsLocked}
              value={currentItem.component} onChange={e => handleCurrentItemChange('component', e.target.value)} />
          </Grid>
        </Grid>
      </Box>

      {/* Section 2: Production Parameters */}
      <Box sx={{ mb: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#ed6c02', fontWeight: 'bold' }}>Section 2: Production Parameters</Typography>
        <Grid container spacing={2}>
          {/* 6. Stitch */}
          <Grid item xs={6} md={3}>
            <TextField label="Stitch (K)" fullWidth size="small" type="number"
              value={currentItem.stitch} onChange={e => handleCurrentItemChange('stitch', e.target.value)} />
          </Grid>
          {/* 7. Repeat */}
          <Grid item xs={6} md={3}>
            <TextField label="Repeat" fullWidth size="small" type="number" inputProps={{ step: "0.01" }}
              value={currentItem.repeat} onChange={e => handleCurrentItemChange('repeat', e.target.value)} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Formula: Total Stitches = Stitch × Repeat
            </Typography>
          </Grid>
          {/* Yards */}
          <Grid item xs={6} md={3}>
            <TextField label="Yards" fullWidth size="small" type="number" inputProps={{ step: "0.01" }}
              value={currentItem.yards} onChange={e => handleCurrentItemChange('yards', e.target.value)} />
          </Grid>
          {/* Total Stitches (Calculated) */}
          <Grid item xs={6} md={3}>
            <TextField
              label="Total Stitches"
              fullWidth
              size="small"
              type="number"
              value={(() => {
                const stitch = parseFloat(currentItem.stitch as string) || 0;
                const repeat = parseFloat(currentItem.repeat as string) || 0;
                return stitch * repeat;
              })()}
              InputProps={{
                readOnly: true,
                sx: { bgcolor: '#f5f5f5' }
              }}
              helperText="Auto-calculated (read-only)"
            />
          </Grid>
          {/* Warning for Stitch Mismatch */}
          {(() => {
            const stitch = parseFloat(currentItem.stitch as string) || 0;
            const repeat = parseFloat(currentItem.repeat as string) || 0;
            const totalStitches = stitch * repeat;
            const assignedStitches = currentItem.assignedMachines?.reduce((sum, m) => sum + (m.assignedStitches || 0), 0) || 0;

            if (totalStitches > 0 && assignedStitches > 0 && Math.abs(totalStitches - assignedStitches) > 0.01) {
              return (
                <Grid item xs={12}>
                  <Alert severity="warning" sx={{ bgcolor: '#fff3e0' }}>
                    <strong>Warning:</strong> Assigned stitches ({assignedStitches.toLocaleString()}) do not match planned total stitches ({totalStitches.toLocaleString()}).
                    This is informational only and will not prevent saving.
                  </Alert>
                </Grid>
              );
            }
            return null;
          })()}
          {/* 8. Pieces / Motif / Lace (Split) */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
              {/* Pieces */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox checked={!!currentItem.pieces} onChange={e => handleCurrentItemChange('pieces', e.target.checked ? '' : 0)} />
                  }
                  label="Pieces"
                />
                {!!currentItem.pieces || currentItem.pieces === '' ? (
                  <TextField size="small" type="number" placeholder="Qty" sx={{ width: 100 }}
                    value={currentItem.pieces} onChange={e => handleCurrentItemChange('pieces', e.target.value)} />
                ) : null}
              </Box>
              {/* Lace */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox checked={!!currentItem.lace} onChange={e => handleCurrentItemChange('lace', e.target.checked ? '' : 0)} />
                  }
                  label="Lace"
                />
                {!!currentItem.lace || currentItem.lace === '' ? (
                  <TextField size="small" type="number" placeholder="Qty" sx={{ width: 100 }}
                    value={currentItem.lace} onChange={e => handleCurrentItemChange('lace', e.target.value)} />
                ) : null}
              </Box>
              {/* Motif */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox checked={!!currentItem.motif} onChange={e => handleCurrentItemChange('motif', e.target.checked ? '' : 0)} />
                  }
                  label="Motif"
                />
                {!!currentItem.motif || currentItem.motif === '' ? (
                  <TextField size="small" type="number" placeholder="Qty" sx={{ width: 100 }}
                    value={currentItem.motif} onChange={e => handleCurrentItemChange('motif', e.target.value)} />
                ) : null}
              </Box>
            </Box>
          </Grid>
          {/* Gazana (Contract) removed from UI as requested */}
        </Grid>
      </Box>



      {/* Section 3: Material & Extra Details */}
      <Box sx={{ mb: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#2e7d32', fontWeight: 'bold' }}>Section 3: Material & Extra Details</Typography>
        <Grid container spacing={2}>
          {/* 10. Fabric */}
          <Grid item xs={6} md={3}>
            <TextField label="Fabric *" fullWidth size="small"
              error={showItemErrors && !currentItem.fabric}
              value={currentItem.fabric} onChange={e => handleCurrentItemChange('fabric', e.target.value)} />
          </Grid>
          {/* 11. Color */}
          <Grid item xs={6} md={3}>
            <TextField label="Color *" fullWidth size="small"
              error={showItemErrors && !currentItem.color}
              value={currentItem.color} onChange={e => handleCurrentItemChange('color', e.target.value)} />
          </Grid>
          {/* 13. Tilla */}
          <Grid item xs={6} md={3}>
            <TextField label="Tilla" fullWidth size="small" type="text"
              value={currentItem.tilla} onChange={e => handleCurrentItemChange('tilla', e.target.value)} />
          </Grid>
          {/* 14. Sequence */}
          <Grid item xs={6} md={3}>
            <TextField label="Seq" fullWidth size="small" type="text"
              value={currentItem.sequence} onChange={e => handleCurrentItemChange('sequence', e.target.value)} />
          </Grid>
          {/* 12. Description */}
          <Grid item xs={12} md={12}>
            <TextField label="Description *" fullWidth size="small"
              error={showItemErrors && !currentItem.itemDescription}
              value={currentItem.itemDescription} onChange={e => handleCurrentItemChange('itemDescription', e.target.value)} />
          </Grid>
        </Grid>
      </Box>

      {/* Section 4: Costing & Rates & Calculations */}
      <Box sx={{ mb: 2, bgcolor: '#e8f5e9', p: 1, borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#2e7d32', fontWeight: 'bold' }}>Section 4: Costing & Rates & Calculations</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={6} md={3}>
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField label="Rate / Stitch" fullWidth size="small" type="number" inputProps={{ step: "0.01" }}
                value={currentItem.ratePerStitch} onChange={e => handleCurrentItemChange('ratePerStitch', e.target.value)} />

              <Autocomplete
                options={['2.88', '10.11', '11.55']}
                value={currentItem.gazanaCost ? String(currentItem.gazanaCost) : ''}
                onChange={(e, newValue) => handleCurrentItemChange('gazanaCost', newValue || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Gazana (Cost)" fullWidth size="small" type="number"
                    inputProps={{ ...params.inputProps, step: "0.01" }}
                  />
                )}
              />
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box display="flex" flexDirection="column" gap={2}>
              {/* First Calculation */}
              <Box>
                <TextField label="Calculated Rate (Rate/M/Y)" fullWidth size="small" type="number"
                  InputProps={{ readOnly: true, style: { fontWeight: 'bold' } }} variant="filled"
                  value={currentItem.calculatedRate} />
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                  Formula: ((Stitch * Rate/Stitch) / 1000) * 2.77
                </Typography>
              </Box>

              {/* Second Calculation (Below First) */}
              <Box>
                <TextField
                  label="Rate / Repeat"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ step: "0.01" }}
                  value={currentItem.ratePerRepeat}
                  onChange={e => handleCurrentItemChange('ratePerRepeat', e.target.value)}
                  helperText="Formula: Rate/M/Y × Gazana"
                />
              </Box>

              {/* Third Calculation (Total Rate) */}
              <Box>
                <TextField
                  label="Total Rate"
                  fullWidth
                  size="small"
                  type="number"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true, style: { fontWeight: 'bold', color: '#1976d2' } }}
                  variant="filled"
                  value={currentItem.totalRate}
                  helperText="Formula: Repeat × Rate/Repeat"
                />
              </Box>
            </Box>
          </Grid>

          {/* Rate per Piece (auto-calculated) */}
          <Grid item xs={12} md={3}>
            <TextField
              label="Rate per Piece"
              fullWidth
              size="small"
              type="number"
              InputProps={{ readOnly: true, style: { fontWeight: 'bold' } }}
              variant="filled"
              value={currentItem.ratePerPiece}
              helperText="Rate per Piece = Rate/Repeat ÷ Heads"
            />
          </Grid>
          {/* Piece Amount (total piece rate) */}
          <Grid item xs={12} md={3}>
            <TextField
              label="Total Piece Rate"
              fullWidth
              size="small"
              type="number"
              InputProps={{ readOnly: true, style: { fontWeight: 'bold' } }}
              variant="filled"
              value={currentItem.pieceAmount}
              helperText="Total Piece Rate = Rate per Piece × Total Pieces"
            />
          </Grid>
        </Grid>

        {/* Final Total Rate (currently same as Total Rate; additional stacking logic can be added later if needed) */}
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box sx={{ bgcolor: '#fff3e0', p: 2, borderRadius: 1, border: '2px solid #ff9800' }}>
              <TextField
                label="Final Total Rate"
                fullWidth
                size="medium"
                type="number"
                InputProps={{
                  readOnly: true,
                  style: { fontWeight: 'bold', fontSize: '1.1rem', color: '#e65100' }
                }}
                variant="filled"
                value={(() => {
                  const baseTotal = parseFloat(currentItem.totalRate as string) || 0;
                  const pieceAmt = parseFloat(currentItem.pieceAmount as string) || 0;
                  return Math.round(baseTotal + pieceAmt);
                })()}
              />
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ fontSize: '0.75rem', display: 'block', mt: 0.5 }}
              >
                Final Total Rate = Stitch/Repeat Total Rate + Total Piece Rate
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>



      {/* Section 5: Machine Configuration - ISOLATED */}
      <Box sx={{ mb: 2, p: 1.5, border: '1px solid #1976d2', borderRadius: 1, bgcolor: '#e3f2fd' }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#1565c0', fontWeight: 'bold' }}>
          Section 5: Machine and Master Configuration
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 2, color: 'text.secondary' }}>
          Assign machines to this item. You can add multiple machines.
        </Typography>

        <ContractItemMachineSelector
          machinesList={machinesList}
          mastersList={mastersList}
          totalItemStitches={(parseFloat(currentItem.stitch as string) || 0) * (parseFloat(currentItem.repeat as string) || 1)}
          itemStitchPerRepeat={parseFloat(currentItem.stitch as string) || 0}
          assignedMachines={currentItem.assignedMachines || []}
          onChange={(newMachines) => handleCurrentItemChange('assignedMachines', newMachines)}
          isLoading={isLoadingMachines}
        />
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant="outlined" color="inherit" size="small" onClick={clearItemForm} startIcon={<Clear />}>
          Clear Form
        </Button>
        <Button variant="contained" color="primary" size="small" onClick={() => handleAddOrUpdateItem(isEditMode)} startIcon={editingIndex !== null ? <EditIcon /> : <Add />}>
          {editingIndex !== null ? 'Update Item' : 'Add Item'}
        </Button>
      </Box>
    </Box>
  );

  const renderItemsTable = (items: ContractItem[], isEditMode: boolean) => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Machine</TableCell> {/* Added Column */}
            <TableCell>Desc</TableCell>
            <TableCell>Fabric</TableCell>
            <TableCell>Color</TableCell>
            <TableCell>Stitch</TableCell>
            <TableCell>Rate/Stitch</TableCell>
            <TableCell>Calc. Rate</TableCell>
            <TableCell>Gazana (Cost)</TableCell>
            <TableCell>Rate/Repeat</TableCell>
            {/* <TableCell>Gazana</TableCell> Removed */}
            <TableCell>Pieces</TableCell>
            <TableCell>Total Rate</TableCell>
            {isEditMode && <TableCell>Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} align="center">No items added.</TableCell>
            </TableRow>
          ) : (
            items.map((item, idx) => (
              <TableRow key={idx} sx={editingIndex === idx ? { bgcolor: '#e3f2fd' } : {}}>
                <TableCell>
                  {(() => {
                    // Logic to display Machine readable names from Assigned Machines
                    if (item.assignedMachines && item.assignedMachines.length > 0) {
                      return item.assignedMachines.map(m => `#${m.machineNumber} (${m.masterName})`).join(', ');
                    }
                    return '-';
                  })()}
                </TableCell>
                <TableCell>{item.itemDescription}</TableCell>
                <TableCell>{item.fabric}</TableCell>
                <TableCell>{item.color}</TableCell>
                <TableCell>{item.stitch}</TableCell>
                <TableCell>{item.ratePerStitch}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{item.calculatedRate}</TableCell>
                <TableCell>{item.gazanaCost}</TableCell>
                <TableCell>{item.ratePerRepeat}</TableCell>
                {/* <TableCell>{item.ghazanaGatepass}</TableCell> Removed */}
                <TableCell>{item.pieces}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{item.totalRate}</TableCell>
                {isEditMode && (
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEditItemFromList(idx, item)} color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => removeItemFromList(idx, isEditMode)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // function definition removed

  {/* Edit Form Area */ }
  { isEditing && renderItemForm(true) }

  {/* Machine Selection Removed */ }

  {/* List Area */ }
  <Typography variant="h6" gutterBottom>Items</Typography>


  // ...

  {/* Create Form Area */ }
  { renderItemForm(false) }

  {/* Machine Selection Removed */ }

  {/* List Area */ }
  <Typography variant="h6" gutterBottom>Items Added</Typography>

  // --- Main Render ---

  if (isLoading) return <Typography>Loading contracts...</Typography>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Contract Management</Typography>
      <Typography variant="body1" color="textSecondary" gutterBottom>Manage Contracts and Items</Typography>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Contracts</Typography>
              <Typography variant="h4">{totalContractsCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Contract List</Typography>
            <Box>
              <Button variant="outlined" color="warning" startIcon={<Assignment />} onClick={() => setOpenTempDialog(true)} sx={{ mr: 1 }}>
                Quick Temp Contract
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={handleCreateNewClick}>New Contract</Button>
            </Box>
          </Box>
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Contract #</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>PO Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Collection</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Design No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Component</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="right">Stitch</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="right">Rate</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="right">Repeat</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="right">Pieces</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="right">Yards</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="right">Total Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="center">Total Est. Days</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="center">Days Left</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">Loading...</Typography>
                    </TableCell>
                  </TableRow>
                ) : !displayRows?.length ? (
                  <TableRow>
                    <TableCell colSpan={15} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">No contracts found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayRows.map((row: any, idx: number) => {
                    const totalEst = Number(row.totalEstimatedDays || 0);
                    const start = row.contractDate ? new Date(row.contractDate) : null;
                    if (start) start.setHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const elapsed = start ? Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    const daysLeft = totalEst > 0 ? Math.ceil(totalEst) - elapsed : null;
                    return (
                    <TableRow key={row.itemId ? `${row.contractId}-${row.itemId}` : `c-${row.contractId}-${idx}`} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.contractNumber ?? '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.contractDate ? new Date(row.contractDate).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.poNumber ?? '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.collection ?? '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.designNo ?? '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.component ?? '-'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.stitch != null ? Number(row.stitch).toLocaleString() : '-'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.rate != null ? Number(row.rate).toFixed(2) : '-'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.repeat != null ? Number(row.repeat).toLocaleString() : '-'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.pieces != null ? Number(row.pieces).toLocaleString() : '-'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.yards != null ? Number(row.yards).toFixed(2) : '-'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                        {row.totalAmount != null ? Number(row.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        {totalEst > 0 ? Number(totalEst).toFixed(2) : '-'}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        {daysLeft != null ? (
                          <Typography variant="body2" color={daysLeft < 0 ? 'error.main' : daysLeft < 7 ? 'warning.main' : 'text.primary'}>
                            {daysLeft < 0 ? `${daysLeft} (Overdue)` : daysLeft}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Box display="flex" gap={1} justifyContent="center">
                          <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => setViewContractId(row.contractId)}>View</Button>
                          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteContract(row.contractId)}>Delete</Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* View/Edit Dialog */}
      <Dialog open={!!viewContractId} onClose={handleCloseViewDialog} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              {contractDetails?.status === 'draft' ? (
                <Chip label="DRAFT MODE" color="info" />
              ) : (
                <>Contract Details</>
              )}
              {contractDetails?.progress && (
                <Chip
                  label={contractDetails.progress}
                  color={contractDetails.progress === 'Active' ? 'success' : 'default'}
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
              <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleDownloadPDF}>PDF</Button>
              <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>Print</Button>
            </Box>
            {!isEditing ? (
              <Box>
                <Button color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={() => handleDeleteContract()} sx={{ mr: 1 }}>
                  Delete
                </Button>
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>Edit Enable</Button>
                {contractDetails?.isTemp && (
                  <Button variant="contained" color="success" onClick={() => setIsEditing(true)} sx={{ ml: 1 }}>
                    Finalize
                  </Button>
                )}
              </Box>
            ) : (
              <Box display="flex" alignItems="center" gap={1}>
                {/* Auto Save Indicator */}
                {contractDetails?.status === 'draft' && (
                  <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                    {autoSaveStatus === 'saving' && <Typography variant="caption">Saving...</Typography>}
                    {autoSaveStatus === 'saved' && <Typography variant="caption">Draft Saved</Typography>}
                  </Box>
                )}

                {contractDetails?.status === 'draft' && (
                  <>
                    <Button color="error" onClick={() => handleDeleteContract()}>Discard Draft</Button>
                    <Button variant="outlined" startIcon={<Save />} onClick={handleSaveDraftManual}>Save Draft</Button>
                    <Button variant="contained" color="success" onClick={handleFinalize}>Finalize Contract</Button>
                  </>
                )}

                {contractDetails?.status !== 'draft' && (
                  <>
                    <Button color="error" onClick={() => setIsEditing(false)} sx={{ mr: 1 }}>Cancel Edit</Button>
                    {contractDetails?.isTemp ? (
                      <Button variant="contained" color="success" onClick={handleFinalize}>Confirm Finalize</Button>
                    ) : (
                      <Button variant="contained" color="primary" onClick={handleSaveEdit}>Save Changes</Button>
                    )}
                  </>
                )}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {notification && <Alert severity={notification.type} sx={{ mb: 2 }} onClose={() => setNotification(null)}>{notification.message}</Alert>}
          {isLoadingDetails ? (
            <Typography>Loading...</Typography>
          ) : contractDetailsError ? (
            <Box>
              <Typography color="error" gutterBottom>Failed to load contract details.</Typography>
              <Typography variant="body2" color="text.secondary">
                {(() => {
                  const error = contractDetailsError as any;
                  if (error?.response?.data?.error) {
                    return typeof error.response.data.error === 'string'
                      ? error.response.data.error
                      : JSON.stringify(error.response.data.error);
                  }
                  if (error?.message) {
                    return typeof error.message === 'string'
                      ? error.message
                      : JSON.stringify(error.message);
                  }
                  return 'Unknown error occurred';
                })()}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => queryClient.invalidateQueries(['contract', viewContractId])}
                sx={{ mt: 2 }}
              >
                Retry
              </Button>
            </Box>
          ) : contractDetails ? (
            <Box sx={{ mt: 2 }}>
              {contractDetails.isTemp && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  This is a <strong>TEMPORARY CONTRACT</strong>. Please add missing details and click <strong>Finalize</strong> to convert it.
                </Alert>
              )}
              {/* Header */}
              <Grid container spacing={2} sx={{ mb: 3, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
                <Grid item xs={12} sm={3}>
                  <Typography variant="subtitle2" color="textSecondary">Contract No</Typography>
                  <Typography variant="h6">{contractDetails.contractNumber}</Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  {isEditing ? (
                    <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                      value={editFormData.contractDate} onChange={e => setEditFormData({ ...editFormData, contractDate: e.target.value })} />
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="textSecondary">Date</Typography>
                      <Typography variant="h6">{new Date(contractDetails.contractDate).toLocaleDateString()}</Typography>
                    </>
                  )}
                </Grid>
                <Grid item xs={12} sm={3}>
                  {isEditing ? (
                    <TextField label="PO Number" fullWidth
                      value={editFormData.poNumber} onChange={e => setEditFormData({ ...editFormData, poNumber: e.target.value })} />
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="textSecondary">PO Number</Typography>
                      <Typography variant="h6">{contractDetails.poNumber}</Typography>
                    </>
                  )}
                </Grid>
              </Grid>
              <Divider sx={{ mb: 2 }} />

              {/* Edit Form Area */}
              {isEditing && renderItemForm(true)}



              {/* List Area */}
              <Typography variant="h6" gutterBottom>Items</Typography>
              {renderItemsTable(isEditing ? editFormData.items : contractDetails.items || [], isEditing)}

              {/* Net Rate Display (View/Edit) */}
              <Box sx={{ mt: 2, p: 2, bgcolor: '#e3f2fd', borderRadius: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ mr: 2 }}>Contract Net Rate:</Typography>
                <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
                  {(isEditing ? editFormData.items : contractDetails.items || []).reduce((sum, item) => sum + (parseFloat(item.totalRate as string) || 0), 0).toFixed(2)}
                </Typography>
              </Box>

            </Box>
          ) : (
            <Typography color="error">No contract data available.</Typography>
          )}
        </DialogContent>
        <DialogActions><Button onClick={handleCloseViewDialog}>Close</Button></DialogActions>
      </Dialog>

      {/* Create Dialog REMOVED - using Draft workflow */}
      {/* Unlock Confirmation Dialog */}
      <Dialog open={confirmUnlockOpen} onClose={() => setConfirmUnlockOpen(false)}>
        <DialogTitle>Unlock Common Fields?</DialogTitle>
        <DialogContent>
          <Typography>
            These fields are same for all the Items in a Contract, Do you still want to override these fields?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUnlockOpen(false)}>No</Button>
          <Button onClick={confirmUnlock} variant="contained" color="warning">Yes, Override</Button>
        </DialogActions>
      </Dialog>

      {/* Gate Pass Prompt Dialog */}
      <Dialog open={showGatePassPrompt} onClose={() => setShowGatePassPrompt(false)}>
        <DialogTitle>Generate Gate Pass</DialogTitle>
        <DialogContent>
          <Typography>
            Contract created successfully! Do you want to generate a Gate Pass for this contract now?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGatePassPrompt(false)} color="secondary">
            No, Close
          </Button>
          <Button
            onClick={() => {
              setShowGatePassPrompt(false);
              // Navigate to Gate Passes with state
              navigate('/gate-passes', {
                state: {
                  openCreate: true,
                  contractId: lastCreatedContract?.id,
                  poNumber: lastCreatedContract?.poNumber,
                  contractNumber: lastCreatedContract?.contractNumber
                }
              });
            }}
            variant="contained"
            color="primary"
          >
            Yes, Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Temp Contract Dialog */}
      <Dialog open={openTempDialog} onClose={() => setOpenTempDialog(false)}>
        <DialogTitle>Create Temporary Contract</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" mb={2} mt={1}>
            Create a quick contract to start production immediately. You must finalize details later.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={tempFormData.contractDate}
                onChange={(e) => setTempFormData({ ...tempFormData, contractDate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="PO Number (Optional)" fullWidth
                value={tempFormData.poNumber}
                onChange={(e) => setTempFormData({ ...tempFormData, poNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Collection (Optional)" fullWidth
                value={tempFormData.collection}
                onChange={(e) => setTempFormData({ ...tempFormData, collection: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Item Description" fullWidth
                value={tempFormData.itemDescription}
                onChange={(e) => setTempFormData({ ...tempFormData, itemDescription: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Stitch (Est)" fullWidth type="number"
                value={tempFormData.stitch}
                onChange={(e) => setTempFormData({ ...tempFormData, stitch: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Pieces (Est)" fullWidth type="number"
                value={tempFormData.pieces}
                onChange={(e) => setTempFormData({ ...tempFormData, pieces: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTempDialog(false)} disabled={createTempContractMutation.isLoading}>Cancel</Button>
          <Button onClick={handleCreateTempContract} variant="contained" color="warning" disabled={createTempContractMutation.isLoading}>
            {createTempContractMutation.isLoading ? 'Creating...' : 'Create Temp'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box >
  );
};

export default Contracts;