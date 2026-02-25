import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  Add,
  Delete,
  Visibility,
  Print as PrintIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';
import SearchableContractItemDropdown from '../components/SearchableContractItemDropdown';

interface GatePassItem {
  itemType: string;
  description: string;
  quantity: string;
  unit: string;
  collection?: string; // Optional/legacy if not needed, but keep if useful for tracking
  designNo?: string;
  component?: string;
  repeat?: string;
  itemRemarks?: string;
  yards?: string | number; // Renamed from Gazana
  gazana?: string; // Re-added for compatibility
}

interface QuantityState {
  gazz: boolean;
  gazzQty: string;
  piece: boolean;
  pieceQty: string;
  lace: boolean;
  laceQty: string;
}

const GatePasses: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Track edit mode
  const [selectedPass, setSelectedPass] = useState<any>(null);
  const [createBillDialog, setCreateBillDialog] = useState(false);
  const [createdGatePassData, setCreatedGatePassData] = useState<any>(null);
  const queryClient = useQueryClient();

  // Filters
  const [collectionFilter, setCollectionFilter] = useState('');

  // New Pass State
  const [newPass, setNewPass] = useState({
    type: 'Outward', // Default
    passDate: new Date().toISOString().split('T')[0],
    contractId: '',
    carrierName: '',
    vehicleNumber: '',
    driverName: '',

    remarks: '',
    poNumber: '',
    items: [] as GatePassItem[],
  });

  const [newItem, setNewItem] = useState<GatePassItem>({
    itemType: '',
    description: '',
    quantity: '',
    unit: '',
  });

  // State for Simplified Item Entry
  // Replacing old cascading dropdowns with direct inputs
  const [itemEntry, setItemEntry] = useState({
    repeat: '',
    remarks: '',
    gazzQty: '',
    pieceQty: '',
    laceQty: '',
    collection: '', // Added
    designNo: '', // Added
    component: '', // Added
    yards: '', // Renamed from Gazana
    gazana: '', // Added
  });

  // Old states removed/ignored: selectedContractDetails, selectedCollection, etc. (Can clean up further if needed)

  // Track which item is being edited (null = new item)
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null);

  // Auto-Open Dialog from Navigation State
  useEffect(() => {
    if (location.state && (location.state as any).openCreate) {
      const state = location.state as any;
      setNewPass(prev => ({
        ...prev,
        contractId: state.contractId || '',
        poNumber: state.poNumber || '',
        remarks: state.poNumber ? `Generated from Contract PO: ${state.poNumber}` : '',
      }));
      setOpenDialog(true);

      // Clear state to prevent reopening? 
      // React Router state persists on refresh usually, but clearing it explicitly is hard without navigating again.
      // Usually handled by checking if dialog is already processed or just accept it re-opens on refresh if on same "navigation".
      // We can use history.replace() to clear state but let's keep it simple.
      window.history.replaceState({}, document.title)
    }
  }, [location]);

  // Handle pre-filled data from Daily Production
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromProduction && state?.productionData) {
      const prodData = state.productionData;
      
      // Pre-fill gate pass form with production data
      setNewPass(prev => ({
        ...prev,
        passDate: prodData.productionDate || new Date().toISOString().split('T')[0],
        poNumber: prodData.contractNo || '',
        remarks: `From Production: ${prodData.operatorName || ''} - ${prodData.shift || ''} shift${prodData.notes ? ' - ' + prodData.notes : ''}`
      }));

      // Pre-fill item entry with production data
      if (prodData.collection || prodData.itemDescription) {
        setItemEntry(prev => ({
          ...prev,
          collection: prodData.collection || '',
          designNo: '', // Design number not directly available from production
          component: prodData.color || '',
          repeat: prodData.repeats?.toString() || '',
          pieceQty: prodData.repeats?.toString() || '',
          remarks: prodData.itemDescription || ''
        }));
      }

      // Open the create dialog
      setOpenDialog(true);

      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const [selectedContractDetails, setSelectedContractDetails] = useState<any>(null); // Keep for contract fetch if needed

  const { data: itemReferences } = useQuery('itemReferences', async () => {
    const res = await api.get('/api/contracts/items-lookup');
    return res.data?.data || [];
  });



  // --- Data Fetching ---
  const { data: gatePasses, isLoading } = useQuery(
    ['gatePasses', collectionFilter],
    async () => {
      // Fetch ALL gate passes (no type filter) or search by collection
      const params: any = {};
      if (collectionFilter) params.collection = collectionFilter;
      const response = await api.get(`/api/gate-passes`, { params });
      return response.data?.data || [];
    }
  );

  // Calculate counts for summary cards
  const today = new Date().toISOString().split('T')[0];
  const outwardToday = gatePasses?.filter((p: any) => p.Type === 'Outward' && p.PassDate.startsWith(today)).length || 0;
  const inwardToday = gatePasses?.filter((p: any) => p.Type === 'Inward' && p.PassDate.startsWith(today)).length || 0;

  const createMutation = useMutation(
    (data: any) => api.post('/api/gate-passes', data),
    {
      onSuccess: (response) => {
        setOpenDialog(false);
        queryClient.invalidateQueries(['gatePasses']);
        
        // Store created gatepass data and show create bill dialog
        setCreatedGatePassData({
          gatePassId: response.data.id,
          contractId: newPass.contractId,
          contractNo: newPass.poNumber // Store contract number for reference
        });
        setCreateBillDialog(true);
        
        resetForm();
      },
    }
  );

  const updateMutation = useMutation(
    (data: any) => api.put(`/api/gate-passes/${data.id}`, data.payload),
    {
      onSuccess: () => {
        setOpenDialog(false);
        setIsEditing(false); // Reset edit mode
        queryClient.invalidateQueries(['gatePasses']);
        resetForm();
      },
    }
  );

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/api/gate-passes/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['gatePasses']);
        setViewDialogOpen(false);
        setSelectedPass(null);
      }
    }
  );

  const resetForm = () => {
    setNewPass({
      type: 'Outward',
      passDate: new Date().toISOString().split('T')[0],
      contractId: '',
      carrierName: '',
      vehicleNumber: '',
      driverName: '',

      remarks: '',
      poNumber: '',
      items: [],
    });
    setItemEntry({
      repeat: '',
      remarks: '',
      gazzQty: '',
      pieceQty: '',
      laceQty: '',
      collection: '',
      designNo: '',
      component: '',
      yards: '',
      gazana: ''
    });
    setIsEditing(false);
    setEditItemIndex(null); // Reset item edit
  };

  const addItemToPass = () => {
    const { repeat, remarks, gazzQty, pieceQty, laceQty, collection, designNo, component, yards, gazana } = itemEntry;

    // Check if we are updating an existing item (Single Item per row usually in edit mode for simplicity, or complex logic)
    if (editItemIndex !== null) {
      // Update existing item at index
      // Since edit maps back to one of the qty fields, we reconstruct it.
      // Limitation: If original item was split (Gazz + Piece), editing one might overlap. 
      // Simplified: We assume user is editing one "row" which is one item object in array.
      // But our "Add" logic pushes multiple if multiple Qtys filled.
      // For Edit: We should only listen to the field matching the item's type, OR replace the item entirely if type changes?
      // Better: Update the specific item at index.

      // We need to know which Qty field corresponds to this item to update it properly.
      // Or just create the item object based on what's filled (assuming only one qty type filled for single item edit).

      let quantity = '';
      let unit = '';
      let itemType = '';

      if (gazzQty) { quantity = gazzQty; unit = 'Gazz'; itemType = 'Gazz'; }
      else if (pieceQty) { quantity = pieceQty; unit = 'Pcs'; itemType = 'Piece'; }
      else if (laceQty) { quantity = laceQty; unit = 'Yards'; itemType = 'Lace'; }

      if (!quantity) return; // Validation: Must have qty

      const updatedItem: GatePassItem = {
        itemType,
        description: `Repeat: ${repeat || '-'}`,
        quantity,
        unit,
        repeat,
        itemRemarks: remarks,
        collection,
        designNo,
        component,
        yards,
        gazana
      };

      const updatedItems = [...newPass.items];
      updatedItems[editItemIndex] = updatedItem;

      setNewPass({ ...newPass, items: updatedItems });
      setEditItemIndex(null); // Clear edit mode

      // Clear form
      setItemEntry({
        repeat: '',
        remarks: '',
        gazzQty: '',
        pieceQty: '',
        laceQty: '',
        collection: '', // Added
        designNo: '', // Added
        component: '', // Added

        yards: '', // Renamed from Gazana
        gazana: '', // Added
      });
      return;
    }

    const itemsToAdd: GatePassItem[] = [];

    if (gazzQty) {
      itemsToAdd.push({
        itemType: 'Gazz',
        description: `Repeat: ${repeat || '-'}`,
        quantity: gazzQty,
        unit: 'Gazz',
        repeat: repeat,
        itemRemarks: remarks,
        collection,
        designNo,
        component,
        gazana
      });
    }
    if (pieceQty) {
      itemsToAdd.push({
        itemType: 'Piece',
        description: `Repeat: ${repeat || '-'}`,
        quantity: pieceQty,
        unit: 'Pcs',
        repeat: repeat,
        itemRemarks: remarks,
        collection,
        designNo,
        component,
        gazana
      });
    }
    if (laceQty) {
      itemsToAdd.push({
        itemType: 'Lace',
        description: `Repeat: ${repeat || '-'}`,
        quantity: laceQty,
        unit: 'Yards',
        repeat: repeat,
        itemRemarks: remarks,
        collection,
        designNo,
        component,
        gazana
      });
    }

    if (itemsToAdd.length > 0) {
      setNewPass({ ...newPass, items: [...newPass.items, ...itemsToAdd] });
      // Clear quantities and maybe remarks? Keep repeat? User might enter multiple lines with same repeat.
      // Let's clear quantities and remarks, keep repeat for convenience? 
      // Or clear all? Let's clear all for fresh entry unless requested otherwise.
      setItemEntry({
        repeat: '',
        remarks: '',
        gazzQty: '',
        pieceQty: '',
        laceQty: '',
        collection: '',
        designNo: '',
        component: '',

        yards: '',
        gazana: ''
      });
    }
  };

  const removeItemFromPass = (index: number) => {
    const updated = [...newPass.items];
    updated.splice(index, 1);
    setNewPass({ ...newPass, items: updated });

    // If deleting the item currently being edited, reset form
    if (editItemIndex === index) {
      setEditItemIndex(null);
      setItemEntry({
        repeat: '',
        remarks: '',
        gazzQty: '',
        pieceQty: '',
        laceQty: '',
        collection: '',
        designNo: '',
        component: '',
        yards: '',
        gazana: ''
      });
    }
  };

  const handleEditItem = (index: number) => {
    const item = newPass.items[index];
    setEditItemIndex(index);

    // Map item back to entry form
    setItemEntry({
      repeat: item.repeat || '',
      remarks: item.itemRemarks || '',
      gazzQty: item.itemType === 'Gazz' ? item.quantity : '',
      pieceQty: item.itemType === 'Piece' ? item.quantity : '',
      laceQty: item.itemType === 'Lace' ? item.quantity : '',
      collection: item.collection || '',
      designNo: item.designNo || '',
      component: item.component || '',
      yards: item.yards ? String(item.yards) : '', // Ensure string for input
      gazana: item.gazana || '',
    });
  };

  const handleSubmit = () => {
    if (isEditing && selectedPass) {
      updateMutation.mutate({ id: selectedPass.GatePassID, payload: newPass });
    } else {
      createMutation.mutate(newPass);
    }
  };

  const handleCreateBillYes = () => {
    setCreateBillDialog(false);
    
    // Navigate to billing page with pre-filled contract data
    navigate('/billing', {
      state: {
        fromGatePass: true,
        gatePassId: createdGatePassData?.gatePassId,
        contractId: createdGatePassData?.contractId,
        contractNo: createdGatePassData?.contractNo
      }
    });
  };

  const handleCreateBillNo = () => {
    setCreateBillDialog(false);
    setCreatedGatePassData(null);
  };

  const handleEdit = async (pass: any) => {
    // Populate form with pass data
    // Need full details if items missing
    let passData = pass;
    if (!pass.items) {
      passData = await fetchPassDetails(pass.GatePassID);
    }

    setSelectedPass(passData);
    setNewPass({
      type: passData.Type,
      passDate: new Date(passData.PassDate).toISOString().split('T')[0],
      contractId: passData.ContractID || '',
      carrierName: passData.CarrierName || '',
      vehicleNumber: passData.VehicleNumber || '',
      driverName: passData.DriverName || '',
      remarks: passData.Remarks || '',
      items: passData.items.map((i: any) => ({
        itemType: i.ItemType,
        description: i.Description,
        quantity: i.Quantity,
        unit: i.Unit,
        repeat: i.Repeat,
        itemRemarks: i.ItemRemarks,
        collection: i.Collection,
        designNo: i.DesignNo,
        component: i.Component,
        yards: i.Yards, // Map from backend Yards
        gazana: i.Gazana // Map from backend Gazana if present
      })),
      poNumber: passData.PONumber || '',
    });
    setIsEditing(true);
    setViewDialogOpen(false); // Close view dialog if open
    setOpenDialog(true);      // Open edit dialog
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this Gate Pass? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  // --- Print & PDF Logic ---
  const fetchPassDetails = async (id: number) => {
    try {
      const res = await api.get(`/api/gate-passes/${id}`);
      return res.data?.data;
    } catch (error) {
      console.error("Failed to fetch pass details", error);
      alert("Could not load pass details.");
      return null;
    }
  };

  const handleView = async (pass: any) => {
    // If items not fully loaded in list, fetch details
    if (!pass.items) {
      const fullDetails = await fetchPassDetails(pass.GatePassID);
      setSelectedPass(fullDetails);
    } else {
      setSelectedPass(pass);
    }
    setViewDialogOpen(true);
  };

  const handlePrint = async (passId: number) => {
    const pass = await fetchPassDetails(passId);
    if (!pass) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gate Pass #${pass.PassNumber}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { margin: 0; text-transform: uppercase; letter-spacing: 2px; }
          .header h3 { margin: 5px 0 0; color: #666; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-radius: 4px; }
          .info-item label { display: block; font-size: 0.85em; color: #666; font-weight: bold; }
          .info-item span { font-size: 1.1em; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9em; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; font-size: 0.8em; }
          tr:nth-child(even) { background-color: #fafafa; }
          .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #888; border-top: 1px solid #eee; padding-top: 10px;}
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
          .sig-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; }
          @media print {
            body { padding: 0; }
            th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Gate Pass</h1>
          <h3>${pass.Type} (${pass.Status})</h3>
        </div>
        
        <div class="info-grid">
          <div class="info-item"><label>Pass Number</label><span>${pass.PassNumber}</span></div>
          <div class="info-item"><label>Date</label><span>${new Date(pass.PassDate).toLocaleDateString()}</span></div>
          <div class="info-item"><label>Contract</label><span>${pass.ContractNo ? '#' + pass.ContractNo : 'N/A'}</span></div>
          <div class="info-item"><label>PO Number</label><span>${pass.PONumber || 'N/A'}</span></div>
          <div class="info-item"><label>Carrier</label><span>${pass.CarrierName || '-'}</span></div>
          <div class="info-item"><label>Vehicle / Driver</label><span>${pass.VehicleNumber || '-'} / ${pass.DriverName || '-'}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Collection / Design</th>
              <th>Component / Gazana</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            ${(pass.items || []).map((item: any) => `
              <tr>
                <td>${item.ItemType || '-'}</td>
                <td>${item.Collection || ''} / ${item.DesignNo || ''}</td>
                <td>${item.Component || ''} / ${item.Gazana || ''}</td>
                <td>${item.Description}</td>
                <td>${item.Quantity}</td>
                <td>${item.Unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${pass.Remarks ? `<p><strong>Remarks:</strong> ${pass.Remarks}</p>` : ''}

        <div class="signatures">
          <div class="sig-line">Prepared By</div>
          <div class="sig-line">Carrier Signature</div>
          <div class="sig-line">Security Check</div>
        </div>

        <div class="footer">
          Generated on ${new Date().toLocaleString()}
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

  const handleDownloadPDF = async (passId: number) => {
    const pass = await fetchPassDetails(passId);
    if (!pass) return;

    const doc = new jsPDF();

    // 1. Header (Centered, Uppercase)
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`GATE PASS`, 105, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`${pass.Type} (${pass.Status})`, 105, 28, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(0);

    // 2. Info Grid (Mimic HTML 2-column layout)
    const leftColX = 14;
    const rightColX = 120;
    let startY = 40;
    const lineHeight = 7;

    const drawInfoItem = (label: string, value: string, x: number, y: number) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100); // Gray label
      doc.text(label, x, y);

      const labelWidth = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);   // Black value
      // Indent value slightly, or put on next line? HTML puts it below. 
      // Let's put it next to label for PDF compactness, or below to match HTML "block" style.
      // HTML style: Block.
      doc.text(value, x, y + 5);
    };

    // Row 1
    drawInfoItem("Pass Number", pass.PassNumber, leftColX, startY);
    drawInfoItem("Carrier", pass.CarrierName || '-', rightColX, startY);

    // Row 2
    startY += 12; // Gap
    drawInfoItem("Date", new Date(pass.PassDate).toLocaleDateString(), leftColX, startY);
    drawInfoItem("Vehicle / Driver", `${pass.VehicleNumber || '-'} / ${pass.DriverName || '-'}`, rightColX, startY);

    // Row 3
    startY += 12;
    drawInfoItem("Contract", pass.ContractNo ? '#' + pass.ContractNo : 'N/A', leftColX, startY);
    // Extra PO Number line if contract exists
    const poText = pass.PONumber ? `PO: ${pass.PONumber}` : '';
    if (poText) {
      doc.setFontSize(9);
      doc.text(poText, leftColX, startY + 10);
      doc.setFontSize(10);
    }

    // 3. Table (Mimic HTML Table Styles)
    const tableColumn = ["Type", "Collection/Design", "Comp/Gazana", "Description", "Qty", "Unit"];
    const tableRows = (pass.items || []).map((item: any) => [
      item.ItemType || '-',
      `${item.Collection || ''} ${item.DesignNo ? '/ ' + item.DesignNo : ''}`,
      `${item.Component || ''} ${item.Gazana ? '/ ' + item.Gazana : ''}`,
      item.Description,
      item.Quantity,
      item.Unit
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: startY + 20,
      theme: 'grid', // 'grid' mimics the border: 1px solid #ddd style
      headStyles: {
        fillColor: [242, 242, 242], // #f2f2f2
        textColor: 0,
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      styles: {
        textColor: 0,
        lineWidth: 0.1,
        lineColor: [200, 200, 200] // #ddd
      }
    });

    // 4. Remarks
    const finalY = (doc as any).lastAutoTable.finalY || (startY + 20);

    if (pass.Remarks) {
      doc.setFont("helvetica", "bold");
      doc.text("Remarks:", 14, finalY + 10);
      doc.setFont("helvetica", "normal");
      doc.text(pass.Remarks, 35, finalY + 10);
    }

    // 5. Signatures (Mimic HTML Flexbox spaced layout)
    const sigY = finalY + 40;
    const sigLineLength = 50;

    // Helper for signature line
    const drawSigLine = (label: string, x: number) => {
      doc.setDrawColor(50);
      doc.line(x, sigY, x + sigLineLength, sigY); // Line
      doc.setFontSize(9);
      doc.text(label, x + (sigLineLength / 2), sigY + 5, { align: 'center' }); // Centered Label
    };

    drawSigLine("Prepared By", 14);
    drawSigLine("Carrier Signature", 80); // Middle-ish
    drawSigLine("Security Check", 145); // Right-ish

    // 6. Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 290, { align: 'center' }); // Bottom of page

    doc.save(`gatepass_${pass.PassNumber}.pdf`);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gate Pass Management</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
        >
          Create Gate Pass
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Today's Outward</Typography>
              <Typography variant="h5">{outwardToday}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Today's Inward</Typography>
              <Typography variant="h5">{inwardToday}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <Box mb={3}>
        <TextField
          label="Search by Collection"
          variant="outlined"
          size="small"
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          sx={{ width: 300, bgcolor: 'white' }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pass #</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Contract</TableCell>
              <TableCell>Carrier / Vehicle</TableCell>
              <TableCell align="center">View</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow>
            ) : gatePasses?.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center">No passes found.</TableCell></TableRow>
            ) : (
              gatePasses?.map((pass: any) => (
                <TableRow key={pass.GatePassID}>
                  <TableCell>{pass.PassNumber}</TableCell>
                  <TableCell>
                    <Chip
                      label={pass.Type}
                      size="small"
                      color={pass.Type === 'Inward' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>{new Date(pass.PassDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {pass.ContractNo ? `#${pass.ContractNo}` : '-'}
                  </TableCell>
                  <TableCell>
                    {pass.CarrierName} {pass.VehicleNumber ? `(${pass.VehicleNumber})` : ''}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      color="info"
                      size="small"
                      onClick={() => handleView(pass)}
                    >
                      View
                    </Button>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" title="Print" onClick={() => handlePrint(pass.GatePassID)}><PrintIcon /></IconButton>
                    <IconButton size="small" title="Download PDF" onClick={() => handleDownloadPDF(pass.GatePassID)} color="primary"><PictureAsPdfIcon /></IconButton>
                    <IconButton size="small" title="Delete" onClick={() => handleDelete(pass.GatePassID)} color="error"><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => { setOpenDialog(false); setIsEditing(false); resetForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>{isEditing ? 'Edit Gate Pass' : 'Create Gate Pass'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {/* Type Selection */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Pass Type</InputLabel>
                <Select
                  value={newPass.type}
                  label="Pass Type"
                  onChange={(e) => setNewPass({ ...newPass, type: e.target.value })}
                >
                  <MenuItem value="Outward">Outward (Dispatch)</MenuItem>
                  <MenuItem value="Inward">Inward (Returns)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={newPass.passDate}
                onChange={(e) => setNewPass({ ...newPass, passDate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SearchableContractItemDropdown
                value={newPass.contractId}
                onChange={(contractId, itemData) => {
                  setNewPass({ ...newPass, contractId });
                  if (itemData) {
                    setSelectedContractDetails(itemData);
                    if (itemData.poNumber) {
                      setNewPass(prev => ({ ...prev, poNumber: itemData.poNumber }));
                    }
                  }
                }}
                label="Link Contract Item (Optional)"
                placeholder="Search by Contract No, PO No, Collection, Design No..."
                helperText="Search and select a specific contract item to link with this gate pass"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="PO Number"
                fullWidth
                value={newPass.poNumber}
                onChange={(e) => setNewPass({ ...newPass, poNumber: e.target.value })}
                helperText="Auto-filled from contract, editable"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Carrier Name"
                fullWidth
                value={newPass.carrierName}
                onChange={(e) => setNewPass({ ...newPass, carrierName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Vehicle No."
                fullWidth
                value={newPass.vehicleNumber}
                onChange={(e) => setNewPass({ ...newPass, vehicleNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Driver Name"
                fullWidth
                value={newPass.driverName}
                onChange={(e) => setNewPass({ ...newPass, driverName: e.target.value })}
              />
            </Grid>

            {/* Items Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Items</Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>

                {/* New Manual Fields */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6} sm={2.4}>
                    <TextField
                      label="Collection"
                      size="small"
                      fullWidth
                      value={itemEntry.collection}
                      onChange={(e) => setItemEntry({ ...itemEntry, collection: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6} sm={2.4}>
                    <TextField
                      label="Design No"
                      size="small"
                      fullWidth
                      value={itemEntry.designNo}
                      onChange={(e) => setItemEntry({ ...itemEntry, designNo: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6} sm={2.4}>
                    <TextField
                      label="Component"
                      size="small"
                      fullWidth
                      value={itemEntry.component}
                      onChange={(e) => setItemEntry({ ...itemEntry, component: e.target.value })}
                    />
                  </Grid>
                </Grid>

                {/* Existing Fields: Repeat, Qty, Remarks */}
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="Repeat"
                      size="small"
                      fullWidth
                      value={itemEntry.repeat}
                      onChange={(e) => setItemEntry({ ...itemEntry, repeat: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="Piece (Qty)"
                      type="number"
                      size="small"
                      fullWidth
                      value={itemEntry.pieceQty}
                      onChange={(e) => setItemEntry({ ...itemEntry, pieceQty: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="Lace (Qty)"
                      type="number"
                      size="small"
                      fullWidth
                      value={itemEntry.laceQty}
                      onChange={(e) => setItemEntry({ ...itemEntry, laceQty: e.target.value })}
                    />
                  </Grid>

                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="Yards"
                      size="small"
                      fullWidth
                      type="number"
                      value={itemEntry.yards}
                      onChange={(e) => setItemEntry({ ...itemEntry, yards: e.target.value })}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Remarks"
                      size="small"
                      fullWidth
                      value={itemEntry.remarks}
                      onChange={(e) => setItemEntry({ ...itemEntry, remarks: e.target.value })}
                    />
                  </Grid>
                </Grid>

                <Box mt={2} display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={addItemToPass}
                    disabled={!itemEntry.pieceQty && !itemEntry.laceQty && !itemEntry.gazzQty}
                    color={editItemIndex !== null ? "warning" : "primary"}
                  >
                    {editItemIndex !== null ? 'Update Item' : 'Add Item Row'}
                  </Button>
                </Box>

                {/* Items List */}
                <Box mt={2}>
                  {newPass.items.map((item, idx) => (
                    <Box key={idx} display="flex" justifyContent="space-between" alignItems="center" sx={{ borderBottom: '1px solid #eee', py: 1 }}>
                      <Box>
                        {/* Simplified Display: Item Type, Qty, and details */}
                        <Typography variant="body2" fontWeight="bold">
                          {item.itemType} (Qty: {item.quantity} {item.unit}) - {item.collection} / {item.designNo}
                        </Typography>
                        {(item.repeat || item.itemRemarks || item.component || item.gazana) && (
                          <Typography variant="caption" color="textSecondary">
                            {item.component ? `Comp: ${item.component} | ` : ''}
                            {item.yards ? `Yards: ${item.yards} | ` : ''}
                            {item.repeat ? `Repeat: ${item.repeat} | ` : ''}
                            {item.itemRemarks ? `Remarks: ${item.itemRemarks}` : ''}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        <IconButton size="small" onClick={() => handleEditItem(idx)} color="primary" sx={{ mr: 1 }}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => removeItemFromPass(idx)} color="error"><Delete fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Remarks / Notes"
                fullWidth
                multiline
                rows={2}
                value={newPass.remarks}
                onChange={(e) => setNewPass({ ...newPass, remarks: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={newPass.items.length === 0}>
            {isEditing ? 'Update Pass' : 'Create Pass'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <span>Gate Pass Details</span>
            <Box>
              <Button size="small" variant="outlined" onClick={() => handleEdit(selectedPass)} sx={{ mr: 1 }}>Edit</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => handleDelete(selectedPass?.GatePassID)} sx={{ mr: 1 }}>Delete</Button>
              <Button size="small" variant="contained" onClick={() => handlePrint(selectedPass?.GatePassID)} startIcon={<PrintIcon />}>Print</Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPass && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {/* Header Info */}
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Pass Number</Typography>
                  <Typography variant="body1" fontWeight="bold">{selectedPass.PassNumber}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Type</Typography>
                  <Chip
                    label={selectedPass.Type}
                    size="small"
                    color={selectedPass.Type === 'Inward' ? 'success' : 'warning'}
                  />
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Date</Typography>
                  <Typography variant="body1">{new Date(selectedPass.PassDate).toLocaleDateString()}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Contract</Typography>
                  <Typography variant="body1">{selectedPass.ContractNo ? `#${selectedPass.ContractNo}` : 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">PO Number</Typography>
                  <Typography variant="body1">{selectedPass.PONumber || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Carrier</Typography>
                  <Typography variant="body1">{selectedPass.CarrierName || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Vehicle / Driver</Typography>
                  <Typography variant="body1">{selectedPass.VehicleNumber || '-'} / {selectedPass.DriverName || '-'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">Remarks</Typography>
                  <Typography variant="body1">{selectedPass.Remarks || '-'}</Typography>
                </Grid>
              </Grid>

              {/* Items Table */}
              <Typography variant="h6" gutterBottom>Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Description/Ref detail</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Repeat</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPass.items || []).map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{item.ItemType}</TableCell>
                        <TableCell>{item.Description}</TableCell>
                        <TableCell>{item.Quantity}</TableCell>
                        <TableCell>{item.Unit}</TableCell>
                        <TableCell>{item.Repeat || '-'}</TableCell>
                        <TableCell>{item.ItemRemarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Bill Confirmation Dialog */}
      <Dialog 
        open={createBillDialog} 
        onClose={handleCreateBillNo}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip label="Success" color="success" size="small" />
            <Typography variant="h6" component="span">
              Gatepass Created Successfully
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Typography variant="body1" gutterBottom>
              Do you want to create a bill for this gatepass?
            </Typography>
            {createdGatePassData?.contractNo && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Contract: <strong>{createdGatePassData.contractNo}</strong>
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCreateBillNo} 
            variant="outlined"
            color="inherit"
          >
            No
          </Button>
          <Button 
            onClick={handleCreateBillYes} 
            variant="contained"
            color="primary"
            autoFocus
          >
            Yes, Create Bill
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GatePasses;