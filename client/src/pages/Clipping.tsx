
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
    Box, Typography, Button, Card, CardContent, Grid, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Table, TableBody, TableCell, TableHead, TableRow,
    IconButton, Chip, FormControl, InputLabel, Select, MenuItem, Collapse
} from '@mui/material';
import { Add, Search, ExpandMore, ExpandLess, CheckCircle, AssignmentReturn, Print, PictureAsPdf, Visibility, Close, Edit, Delete, Person, Business } from '@mui/icons-material';
import { api } from '../apiClient';
import { getFactoryDetails, getPrintHeaderHTML, addPDFHeader } from '../utils/printHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tabs, Tab, Autocomplete, Alert } from '@mui/material';

// Types
interface ClippingItem {
    id: number;
    contractItemId: number;
    contractId?: number;
    contractInfo: string;
    description: string;
    collection?: string;
    designNo?: string;
    component?: string;
    yard?: number;
    quantitySent: number;
    dateSent: string;
    quantityReceived: number;
    lastReceivedDate: string | null;
    status: 'Sent' | 'Partially Received' | 'Completed';
}

interface Clipping {
    id: number;
    vendorId?: number;
    vendorName: string;
    contactNumber: string;
    cnic: string;
    address?: string;
    createdAt: string;
    items: ClippingItem[];
}

interface Contract {
    id: number;
    contractNumber: string;
    poNumber: string;
    items?: any[];
}

interface Vendor {
    id: number;
    vendor_name: string;
    contact_number: string;
    cnic: string;
    address: string;
    // Contract-based progress fields
    total_assigned: number;      // Number of contracts assigned
    total_completed: number;     // Number of completed contracts
    total_pending: number;       // Number of ongoing contracts
    work_status: 'Pending' | 'Ongoing' | 'Completed';
}

const Clipping: React.FC = () => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openReceiveDialog, setOpenReceiveDialog] = useState(false);
    const [openViewDialog, setOpenViewDialog] = useState(false);
    const [selectedClip, setSelectedClip] = useState<Clipping | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
    const [editingContractItemId, setEditingContractItemId] = useState<number | null>(null);

    // Create Form State (id optional - used when editing existing items)
    const [createForm, setCreateForm] = useState({
        vendorId: undefined as number | undefined,
        vendorName: '',
        contactNumber: '',
        cnic: '',
        address: '',
        items: [] as { id?: number; contractItemId: number; contractId?: number; description: string; quantitySent: string; dateSent: string }[]
    });

    // Vendor Management State
    const [currentTab, setCurrentTab] = useState(0);
    const [openVendorDialog, setOpenVendorDialog] = useState(false);
    const [openVendorProgressDialog, setOpenVendorProgressDialog] = useState(false);
    const [selectedVendorForProgress, setSelectedVendorForProgress] = useState<Vendor | null>(null);
    const [vendorProgressData, setVendorProgressData] = useState<any>(null);
    const [vendorForm, setVendorForm] = useState({
        id: undefined as number | undefined,
        vendorName: '',
        contactNumber: '',
        cnic: '',
        address: ''
    });

    // Temporary state for adding an item in Create Dialog
    const [tempItem, setTempItem] = useState({
        contractId: '',
        contractItemIdx: '', // Index in the selected contract's items array
        description: '',
        quantitySent: '',
        dateSent: new Date().toISOString().split('T')[0]
    });

    // Receive Form State
    const [receiveForm, setReceiveForm] = useState({
        clipId: 0,
        itemId: 0,
        quantity: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [receivingItem, setReceivingItem] = useState<ClippingItem | null>(null); // Added state

    // Queries
    const { data: clips, isLoading } = useQuery<Clipping[]>(
        ['clipping', searchTerm],
        () => api.get('/api/clipping', { params: { vendor: searchTerm } }).then(res => res.data.data)
    );

    const { data: contracts } = useQuery<Contract[]>(
        'activeContracts',
        () => api.get('/api/contracts', { params: { limit: 500, status: 'active' } }).then(res => res.data.data)
    );

    const { data: vendors, refetch: refetchVendors } = useQuery<Vendor[]>(
        'clippingVendors',
        () => api.get('/api/clipping-vendors').then(res => res.data.data)
    );

    // Fetch vendor progress details when a vendor is selected
    const { data: vendorProgress, isLoading: isLoadingVendorProgress } = useQuery(
        ['vendorProgress', selectedVendorForProgress?.id],
        () => api.get(`/api/clipping-vendors/${selectedVendorForProgress?.id}/progress`).then(res => res.data.data),
        {
            enabled: !!selectedVendorForProgress?.id,
            onSuccess: (data) => {
                setVendorProgressData(data);
            }
        }
    );

    // Fetch details for selected contract to get items
    const { data: selectedContractDetails } = useQuery<Contract>(
        ['contract', tempItem.contractId],
        () => api.get(`/api/contracts/${tempItem.contractId}`).then(res => res.data.data),
        {
            enabled: !!tempItem.contractId
        }
    );

    // Mutations
    const createClipMutation = useMutation(
        (newClip: any) => api.post('/api/clipping', newClip),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('clipping');
                setOpenCreateDialog(false);
                resetCreateForm();
            }
        }
    );

    const receiveWorkMutation = useMutation(
        (data: { clipId: number, itemId: number, quantity: string, date: string }) =>
            api.put(`/api/clipping/${data.clipId}/items/${data.itemId}/receive`, {
                quantity: data.quantity,
                date: data.date
            }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('clipping');
                setOpenReceiveDialog(false);
            }
        }
    );

    const updateClipMutation = useMutation(
        (data: { id: number, payload: any }) => api.put(`/api/clipping/${data.id}`, data.payload),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('clipping');
                setOpenCreateDialog(false);
                resetCreateForm();
            }
        }
    );

    const createVendorMutation = useMutation(
        (newVendor: any) => api.post('/api/clipping-vendors', newVendor),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('clippingVendors');
                setOpenVendorDialog(false);
                setVendorForm({ id: undefined, vendorName: '', contactNumber: '', cnic: '', address: '' });
                refetchVendors();
            },
            onError: (err: any) => {
                alert(err.response?.data?.message || 'Failed to create vendor.');
            }
        }
    );

    const updateVendorMutation = useMutation(
        (data: { id: number, payload: any }) => api.put(`/api/clipping-vendors/${data.id}`, data.payload),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('clippingVendors');
                setOpenVendorDialog(false);
                setVendorForm({ id: undefined, vendorName: '', contactNumber: '', cnic: '', address: '' });
                refetchVendors();
            }
        }
    );

    const deleteVendorMutation = useMutation(
        (id: number) => api.delete(`/api/clipping-vendors/${id}`),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('clippingVendors');
                refetchVendors();
            },
            onError: (err: any) => {
                alert(err.response?.data?.message || 'Failed to delete vendor');
            }
        }
    );

    // Handlers


    const handleVendorSubmit = () => {
        const payload = {
            vendorName: vendorForm.vendorName,
            contactNumber: vendorForm.contactNumber,
            cnic: vendorForm.cnic,
            address: vendorForm.address
        };
        if (vendorForm.id) {
            updateVendorMutation.mutate({ id: vendorForm.id, payload });
        } else {
            createVendorMutation.mutate(payload);
        }
    };

    const handleEditVendor = (v: Vendor) => {
        setVendorForm({
            id: v.id,
            vendorName: v.vendor_name,
            contactNumber: v.contact_number,
            cnic: v.cnic,
            address: v.address
        });
        setOpenVendorDialog(true);
    };

    const resetCreateForm = () => {
        setCreateForm({ vendorId: undefined, vendorName: '', contactNumber: '', cnic: '', address: '', items: [] });
        setTempItem({ contractId: '', contractItemIdx: '', description: '', quantitySent: '', dateSent: new Date().toISOString().split('T')[0] });
        setIsEditing(false);
        setEditId(null);
        setEditingItemIdx(null);
        setEditingContractItemId(null);
    };

    // When editing an item, auto-fill contractItemIdx once contract details load
    useEffect(() => {
        if (editingItemIdx !== null && editingContractItemId !== null && selectedContractDetails?.items?.length) {
            const idx = selectedContractDetails.items.findIndex(
                (i: any) => (i.id ?? i.ContractItemID) === editingContractItemId
            );
            if (idx >= 0) {
                setTempItem(prev => ({ ...prev, contractItemIdx: String(idx) }));
            }
            setEditingContractItemId(null);
        }
    }, [editingItemIdx, editingContractItemId, selectedContractDetails]);

    const handleAddItem = () => {
        if (!tempItem.contractId || tempItem.contractItemIdx === '' || !tempItem.quantitySent) return;

        const selectedItem = selectedContractDetails?.items?.[Number(tempItem.contractItemIdx)];

        if (selectedItem) {
            const newItem = {
                ...(editingItemIdx !== null && createForm.items[editingItemIdx]?.id && { id: createForm.items[editingItemIdx].id }),
                contractItemId: selectedItem.id || selectedItem.ContractItemID,
                contractId: Number(tempItem.contractId),
                description: tempItem.description || selectedItem.itemDescription,
                quantitySent: tempItem.quantitySent,
                dateSent: tempItem.dateSent
            };
            if (editingItemIdx !== null) {
                setCreateForm(prev => ({
                    ...prev,
                    items: prev.items.map((it, i) => i === editingItemIdx ? newItem : it)
                }));
                setEditingItemIdx(null);
            } else {
                setCreateForm(prev => ({
                    ...prev,
                    items: [...prev.items, newItem]
                }));
            }
            setTempItem({ contractId: '', contractItemIdx: '', description: '', quantitySent: '', dateSent: new Date().toISOString().split('T')[0] });
        }
    };

    const handleEditItemClick = (idx: number) => {
        const it = createForm.items[idx];
        setTempItem({
            contractId: String(it.contractId ?? ''),
            contractItemIdx: '',
            description: it.description,
            quantitySent: it.quantitySent,
            dateSent: it.dateSent
        });
        setEditingItemIdx(idx);
        setEditingContractItemId(it.contractItemId);
    };

    const handleCancelEditItem = () => {
        setTempItem({ contractId: '', contractItemIdx: '', description: '', quantitySent: '', dateSent: new Date().toISOString().split('T')[0] });
        setEditingItemIdx(null);
        setEditingContractItemId(null);
    };



    const handleEditClip = (clip: Clipping) => {
        setCreateForm({
            vendorId: clip.vendorId,
            vendorName: clip.vendorName,
            contactNumber: clip.contactNumber,
            cnic: clip.cnic,
            address: clip.address || '',
            items: clip.items.map(item => ({
                id: item.id,
                contractItemId: item.contractItemId,
                contractId: item.contractId,
                description: item.description,
                quantitySent: String(item.quantitySent ?? ''),
                dateSent: item.dateSent ? new Date(item.dateSent).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            }))
        });
        setEditId(clip.id);
        setIsEditing(true);
        setOpenCreateDialog(true);
        setOpenViewDialog(false);
    };

    const handleCreateSubmit = () => {
        const payload = {
            ...createForm,
            items: createForm.items.map(it => ({
                ...(it.id && { id: it.id }),
                contractItemId: it.contractItemId,
                description: it.description,
                quantitySent: Number(it.quantitySent) || 0,
                dateSent: it.dateSent
            }))
        };
        if (isEditing && editId) {
            updateClipMutation.mutate({ id: editId, payload });
        } else {
            createClipMutation.mutate(payload);
        }
    };

    const handleRemoveItem = (idx: number) => {
        setCreateForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== idx)
        }));
        if (editingItemIdx === idx) handleCancelEditItem();
        else if (editingItemIdx !== null && editingItemIdx > idx) setEditingItemIdx(editingItemIdx - 1);
    };

    const handleUpdateItem = (idx: number, field: 'quantitySent' | 'dateSent', value: string) => {
        setCreateForm(prev => ({
            ...prev,
            items: prev.items.map((it, i) => i === idx ? { ...it, [field]: value } : it)
        }));
    };

    const handleOpenReceive = (clipId: number, item: ClippingItem) => {
        setReceivingItem(item); // Set selected item
        setReceiveForm({
            clipId,
            itemId: item.id,
            quantity: '', // Reset input
            date: new Date().toISOString().split('T')[0]
        });
        setOpenReceiveDialog(true);
    };

    const handleReceiveSubmit = () => {
        receiveWorkMutation.mutate(receiveForm);
    };

    const handleViewClip = (clip: Clipping) => {
        setSelectedClip(clip);
        setOpenViewDialog(true);
    };

    const handlePrintClip = async (clip: Clipping) => {
        const factoryDetails = await getFactoryDetails();
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const headerHtml = getPrintHeaderHTML(factoryDetails, `Outsourced Work Challan #${clip.id}`);

        const htmlContent = `
            <html>
            <head>
                <title>Clipping Challan #${clip.id}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #666; }
                </style>
            </head>
            <body>
                ${headerHtml}
                
                <div style="margin-top:20px;">
                    <h3>Vendor: ${clip.vendorName}</h3>
                    <div class="info">
                        <div><strong>Date:</strong> ${new Date(clip.createdAt).toLocaleDateString()}</div>
                        <div><strong>Contact:</strong> ${clip.contactNumber}</div>
                        <div><strong>CNIC:</strong> ${clip.cnic}</div>
                        <div><strong>Address:</strong> ${clip.address || '-'}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item / Contract</th>
                            <th>Description</th>
                            <th>Sent Qty</th>
                            <th>Date Sent</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clip.items.map(item => `
                            <tr>
                                <td>${item.contractInfo}</td>
                                <td>${item.description}</td>
                                <td>${item.quantitySent}</td>
                                <td>${new Date(item.dateSent).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    ${factoryDetails?.footer_text || 'Generated on ' + new Date().toLocaleString()}
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleDownloadPDF = async (clip: Clipping) => {
        const factoryDetails = await getFactoryDetails();
        const doc = new jsPDF();

        const startY = addPDFHeader(doc, factoryDetails, "Outsourced Work Challan");

        doc.setFontSize(12);
        doc.text(`Vendor: ${clip.vendorName}`, 14, startY + 5);
        doc.text(`Contact: ${clip.contactNumber}`, 14, startY + 11);
        doc.text(`Date: ${new Date(clip.createdAt).toLocaleDateString()}`, 140, startY + 5);

        const tableColumn = ["Contract", "Description", "Qty Sent", "Date Sent"];
        const tableRows = clip.items.map(item => [
            item.contractInfo,
            item.description,
            item.quantitySent,
            new Date(item.dateSent).toLocaleDateString()
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: startY + 20,
        });

        if (factoryDetails?.footer_text) {
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(10);
            doc.text(factoryDetails.footer_text, 14, pageHeight - 10);
        }

        doc.save(`clipping_${clip.vendorName}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Render Helpers
    const ItemRow = ({ item, clipId }: { item: ClippingItem, clipId: number }) => (
        <TableRow key={item.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
            <TableCell>{item.contractInfo}</TableCell>
            <TableCell>{item.description}</TableCell>
            <TableCell>{item.collection ?? '-'}</TableCell>
            <TableCell>{item.designNo ?? '-'}</TableCell>
            <TableCell>{item.component ?? '-'}</TableCell>
            <TableCell>{item.yard != null ? Number(item.yard).toFixed(2) : '-'}</TableCell>
            <TableCell>{item.dateSent ? new Date(item.dateSent).toLocaleDateString() : '-'}</TableCell>
            <TableCell>{Number(item.quantitySent).toFixed(2)}</TableCell>
            <TableCell>{Number(item.quantityReceived).toFixed(2)}</TableCell>
            <TableCell>
                <Chip
                    label={item.status}
                    color={item.status === 'Completed' ? 'success' : item.status === 'Partially Received' ? 'warning' : 'default'}
                    size="small"
                />
            </TableCell>
            <TableCell>
                {item.status !== 'Completed' && (
                    <Button
                        size="small"
                        startIcon={<AssignmentReturn />}
                        onClick={() => handleOpenReceive(clipId, item)}
                    >
                        Receive
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a237e' }}>
                    Clipping & Outsourcing
                </Typography>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={currentTab} onChange={(e, newVal) => setCurrentTab(newVal)}>
                    <Tab label="Clipping Orders" icon={<AssignmentReturn />} iconPosition="start" />
                    <Tab label="Vendor Management" icon={<Business />} iconPosition="start" />
                </Tabs>
            </Box>

            {/* TAB 0: CLIPPING ORDERS */}
            {currentTab === 0 && (
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                        <TextField
                            placeholder="Search by Vendor Name..."
                            variant="outlined"
                            size="small"
                            InputProps={{ startAdornment: <Search color="action" sx={{ mr: 1 }} /> }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            sx={{ width: 300, bgcolor: 'white' }}
                        />
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => setOpenCreateDialog(true)}
                            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
                        >
                            Create Clip
                        </Button>
                    </Box>

                    <Grid container spacing={2}>
                        {isLoading ? (
                            <Typography>Loading...</Typography>
                        ) : clips?.map((clip) => (
                            <Grid item xs={12} key={clip.id}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Grid container alignItems="center" spacing={2}>
                                            <Grid item xs={12} md={3}>
                                                <Typography variant="h6">{clip.vendorName}</Typography>
                                                <Typography variant="body2" color="textSecondary">📞 {clip.contactNumber}</Typography>
                                            </Grid>
                                            <Grid item xs={12} md={3}>
                                                <Typography variant="body2"><strong>CNIC:</strong> {clip.cnic}</Typography>
                                                {clip.address && <Typography variant="caption">{clip.address}</Typography>}
                                            </Grid>
                                            <Grid item xs={12} md={3}>
                                                <Typography variant="body2"><strong>Date:</strong> {new Date(clip.createdAt).toLocaleDateString()}</Typography>
                                            </Grid>
                                            <Grid item xs={12} md={3} sx={{ textAlign: 'right' }}>
                                                <IconButton size="small" onClick={() => handleViewClip(clip)} title="View Details"><Visibility /></IconButton>
                                                <IconButton size="small" onClick={() => handleEditClip(clip)} title="Edit Clip"><Edit /></IconButton>
                                                <IconButton size="small" onClick={() => handlePrintClip(clip)} title="Print"><Print /></IconButton>
                                                <IconButton size="small" onClick={() => handleDownloadPDF(clip)} title="Download PDF"><PictureAsPdf /></IconButton>
                                                <Chip label={`${clip.items.length} Items`} size="small" sx={{ ml: 1 }} />
                                            </Grid>
                                        </Grid>

                                        {/* Items Table */}
                                        <Box sx={{ mt: 2, bgcolor: '#f5f5f5', borderRadius: 1, p: 1 }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Contract / Item</TableCell>
                                                        <TableCell>Description</TableCell>
                                                        <TableCell>Collection</TableCell>
                                                        <TableCell>Design No</TableCell>
                                                        <TableCell>Component</TableCell>
                                                        <TableCell>Yard</TableCell>
                                                        <TableCell>Sent Date</TableCell>
                                                        <TableCell>Sent Qty</TableCell>
                                                        <TableCell>Recv Qty</TableCell>
                                                        <TableCell>Status</TableCell>
                                                        <TableCell>Action</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {clip.items.map(item => <ItemRow key={item.id} item={item} clipId={clip.id} />)}
                                                </TableBody>
                                            </Table>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                        {clips?.length === 0 && <Typography sx={{ p: 2 }}>No clipping records found.</Typography>}
                    </Grid>
                </Box>
            )}

            {/* TAB 1: VENDOR MANAGEMENT */}
            {currentTab === 1 && (
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button variant="contained" startIcon={<Add />} onClick={() => { setVendorForm({ id: undefined, vendorName: '', contactNumber: '', cnic: '', address: '' }); setOpenVendorDialog(true); }}>
                            Add New Vendor
                        </Button>
                    </Box>

                    {/* Vendor Summary Cards */}
                    {vendors && vendors.length > 0 && (
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                            {vendors.length}
                                        </Typography>
                                        <Typography variant="body2">
                                            Total Vendors
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                            {vendors.filter(v => (v.work_status || 'Pending') === 'Completed').length}
                                        </Typography>
                                        <Typography variant="body2">
                                            Vendors Completed
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                            {vendors.filter(v => (v.work_status || 'Pending') === 'Ongoing').length}
                                        </Typography>
                                        <Typography variant="body2">
                                            Vendors Ongoing
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ bgcolor: 'grey.300', color: 'text.primary' }}>
                                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                            {vendors.reduce((sum, v) => sum + (v.total_pending || 0), 0)}
                                        </Typography>
                                        <Typography variant="body2">
                                            Total Ongoing Contracts
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}

                    <Card>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Vendor Name</TableCell>
                                    <TableCell>Contact Number</TableCell>
                                    <TableCell>CNIC</TableCell>
                                    <TableCell>Address</TableCell>
                                    <TableCell>Total Assigned</TableCell>
                                    <TableCell>Completed</TableCell>
                                    <TableCell>Ongoing</TableCell>
                                    <TableCell align="center">Work Status</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {vendors?.map((vendor) => (
                                    <TableRow key={vendor.id}>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                {vendor.vendor_name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{vendor.contact_number}</TableCell>
                                        <TableCell>{vendor.cnic || '-'}</TableCell>
                                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {vendor.address || '-'}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                {(vendor.total_assigned || 0)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                contracts
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                                                {(vendor.total_completed || 0)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                completed
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'bold' }}>
                                                {(vendor.total_pending || 0)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                ongoing
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={vendor.work_status || 'Pending'}
                                                size="small"
                                                color={
                                                    vendor.work_status === 'Completed' ? 'success' :
                                                    vendor.work_status === 'Ongoing' ? 'warning' : 'default'
                                                }
                                                variant={(!vendor.work_status || vendor.work_status === 'Pending') ? 'outlined' : 'filled'}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <IconButton 
                                                size="small" 
                                                color="primary"
                                                onClick={() => {
                                                    setSelectedVendorForProgress(vendor);
                                                    setOpenVendorProgressDialog(true);
                                                }}
                                                title="View Progress"
                                            >
                                                <Visibility />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleEditVendor(vendor)} title="Edit Vendor">
                                                <Edit />
                                            </IconButton>
                                            <IconButton 
                                                size="small" 
                                                color="error" 
                                                onClick={() => { 
                                                    if (window.confirm('Delete Vendor?')) 
                                                        deleteVendorMutation.mutate(vendor.id); 
                                                }}
                                                title="Delete Vendor"
                                            >
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!vendors || vendors.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={9} align="center">
                                            <Typography variant="body2" color="text.secondary">
                                                No vendors found.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </Box>
            )}


            {/* Create/Edit Dialog */}
            <Dialog open={openCreateDialog} onClose={() => { setOpenCreateDialog(false); resetCreateForm(); }} maxWidth="md" fullWidth>
                <DialogTitle>{isEditing ? 'Edit Clip Details' : 'Create New Clip (Outsource)'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>Vendor Details</Typography>

                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Autocomplete
                                    options={vendors || []}
                                    getOptionLabel={(option) => `${option.vendor_name} (${option.contact_number})`}
                                    value={vendors?.find(v => v.id === createForm.vendorId) || null}
                                    onChange={(e, newVal) => {
                                        if (newVal) {
                                            setCreateForm(prev => ({
                                                ...prev,
                                                vendorId: newVal.id,
                                                vendorName: newVal.vendor_name,
                                                contactNumber: newVal.contact_number,
                                                cnic: newVal.cnic || '',
                                                address: newVal.address || ''
                                            }));
                                        } else {
                                            // Clear
                                            setCreateForm(prev => ({ ...prev, vendorId: undefined, vendorName: '', contactNumber: '', cnic: '', address: '' }));
                                        }
                                    }}
                                    renderInput={(params) => <TextField {...params} label="Select Vendor" fullWidth />}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Button startIcon={<Add />} onClick={() => setOpenVendorDialog(true)}>Quick Add Vendor</Button>
                            </Grid>

                            <Grid item xs={12}>
                                {/* Read Only Details Preview */}
                                {createForm.vendorId && (
                                    <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                        <Typography variant="body2"><strong>Contact:</strong> {createForm.contactNumber} | <strong>CNIC:</strong> {createForm.cnic}</Typography>
                                        <Typography variant="body2"><strong>Address:</strong> {createForm.address}</Typography>
                                    </Box>
                                )}
                            </Grid>
                        </Grid>

                        {/* Divider */}
                        <Box sx={{ my: 2, height: 1, bgcolor: 'divider' }} />

                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>Items to Outsource</Typography>
                        {editingItemIdx !== null && (
                            <Alert severity="info" sx={{ mb: 1 }} onClose={handleCancelEditItem}>
                                Editing item: <strong>{createForm.items[editingItemIdx]?.description}</strong> — Update fields above and click &quot;Update Item&quot; to save.
                            </Alert>
                        )}
                        <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, mb: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Select Contract</InputLabel>
                                        <Select
                                            label="Select Contract"
                                            value={tempItem.contractId || ''}
                                            onChange={e => setTempItem({ ...tempItem, contractId: e.target.value, contractItemIdx: '' })}
                                        >
                                            {contracts?.map(c => (
                                                <MenuItem key={c.id} value={String(c.id)}>{c.contractNumber} (PO: {c.poNumber})</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={4}>
                                    <FormControl fullWidth size="small" disabled={!tempItem.contractId}>
                                        <InputLabel>Select Item</InputLabel>
                                        <Select
                                            label="Select Item"
                                            value={tempItem.contractItemIdx}
                                            onChange={e => setTempItem({ ...tempItem, contractItemIdx: e.target.value })}
                                        >
                                            {selectedContractDetails?.items?.map((item: any, idx: number) => (
                                                <MenuItem key={idx} value={String(idx)}>{item.itemDescription || item.ItemDescription} ({item.color})</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={4}>
                                    <TextField
                                        label="Description (Optional)"
                                        size="small"
                                        fullWidth
                                        value={tempItem.description}
                                        onChange={e => setTempItem({ ...tempItem, description: e.target.value })}
                                    />
                                </Grid>
                                {/* Read-only fields from selected contract item */}
                                {tempItem.contractId && tempItem.contractItemIdx !== '' && selectedContractDetails?.items?.[Number(tempItem.contractItemIdx)] && (
                                    <>
                                        <Grid item xs={3}>
                                            <TextField label="Collection" size="small" fullWidth value={selectedContractDetails.items[Number(tempItem.contractItemIdx)].collection || '-'} InputProps={{ readOnly: true }} />
                                        </Grid>
                                        <Grid item xs={3}>
                                            <TextField label="Design No" size="small" fullWidth value={selectedContractDetails.items[Number(tempItem.contractItemIdx)].designNo || '-'} InputProps={{ readOnly: true }} />
                                        </Grid>
                                        <Grid item xs={3}>
                                            <TextField label="Component" size="small" fullWidth value={selectedContractDetails.items[Number(tempItem.contractItemIdx)].component || '-'} InputProps={{ readOnly: true }} />
                                        </Grid>
                                        <Grid item xs={3}>
                                            <TextField label="Yard" size="small" fullWidth value={selectedContractDetails.items[Number(tempItem.contractItemIdx)].yards ?? selectedContractDetails.items[Number(tempItem.contractItemIdx)].yard ?? '-'} InputProps={{ readOnly: true }} />
                                        </Grid>
                                        {/* Remaining Stitches & Repeats - so user knows how many can be sent to clipping */}
                                        <Grid item xs={12}>
                                            <Box sx={{ p: 1.5, bgcolor: 'info.light', borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                                                <Typography variant="subtitle2" color="info.dark" gutterBottom>Available for Clipping</Typography>
                                                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                                    <Typography variant="body2">
                                                        <strong>Remaining Stitches:</strong>{' '}
                                                        {(() => {
                                                            const it = selectedContractDetails.items[Number(tempItem.contractItemIdx)];
                                                            const stitch = Number(it.stitch || 0);
                                                            const pieces = Number(it.pieces || 0);
                                                            const usedStitches = Number(it.usedStitches || 0);
                                                            const totalPlanned = stitch * pieces;
                                                            const remaining = Math.max(0, totalPlanned - usedStitches);
                                                            return `${remaining.toLocaleString()} (of ${totalPlanned.toLocaleString()} total)`;
                                                        })()}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        <strong>Remaining Repeats:</strong>{' '}
                                                        {(() => {
                                                            const it = selectedContractDetails.items[Number(tempItem.contractItemIdx)];
                                                            const repeat = Number(it.repeat || 0);
                                                            const usedRepeats = Number(it.usedRepeats || 0);
                                                            const remaining = Math.max(0, repeat - usedRepeats);
                                                            return `${remaining.toLocaleString()} (of ${repeat.toLocaleString()} total)`;
                                                        })()}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Grid>
                                    </>
                                )}
                                <Grid item xs={3}>
                                    <TextField
                                        label="Quantity Sent"
                                        type="number"
                                        size="small"
                                        fullWidth
                                        value={tempItem.quantitySent}
                                        onChange={e => setTempItem({ ...tempItem, quantitySent: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={3}>
                                    <TextField
                                        label="Date Sent"
                                        type="date"
                                        size="small"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={tempItem.dateSent}
                                        onChange={e => setTempItem({ ...tempItem, dateSent: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                    {editingItemIdx !== null ? (
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button variant="contained" size="small" onClick={handleAddItem}>Update Item</Button>
                                            <Button variant="outlined" size="small" onClick={handleCancelEditItem}>Cancel</Button>
                                        </Box>
                                    ) : (
                                        <Button variant="outlined" onClick={handleAddItem}>Add Item</Button>
                                    )}
                                </Grid>
                            </Grid>
                        </Box>

                        {/* Added Items List (editable in create/edit) */}
                        {createForm.items.length > 0 && (
                            <Table size="small" sx={{ mt: 1 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Item / Description</TableCell>
                                        <TableCell>Qty Sent</TableCell>
                                        <TableCell>Date Sent</TableCell>
                                        <TableCell align="right" padding="none">Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {createForm.items.map((it, idx) => (
                                        <TableRow key={it.id ?? idx} sx={editingItemIdx === idx ? { bgcolor: 'action.hover' } : {}}>
                                            <TableCell>{it.description}</TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    value={it.quantitySent}
                                                    onChange={e => handleUpdateItem(idx, 'quantitySent', e.target.value)}
                                                    sx={{ width: 100 }}
                                                    inputProps={{ min: 0, step: 0.01 }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="date"
                                                    size="small"
                                                    value={it.dateSent}
                                                    onChange={e => handleUpdateItem(idx, 'dateSent', e.target.value)}
                                                    InputLabelProps={{ shrink: true }}
                                                    sx={{ width: 150 }}
                                                />
                                            </TableCell>
                                            <TableCell align="right" padding="none">
                                                <IconButton size="small" color="primary" onClick={() => handleEditItemClick(idx)} title="Edit in form above">
                                                    <Edit />
                                                </IconButton>
                                                <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)} title="Remove item">
                                                    <Delete />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setOpenCreateDialog(false); resetCreateForm(); }}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateSubmit} disabled={createForm.items.length === 0 || !createForm.vendorName}>
                        {isEditing ? 'Save Changes' : 'Create Clip'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Receive Dialog */}
            <Dialog open={openReceiveDialog} onClose={() => setOpenReceiveDialog(false)}>
                <DialogTitle>Receive Work</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1, minWidth: 300 }}>
                        {receivingItem && (
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                <strong>Item:</strong> {receivingItem.description}<br />
                                <strong>Sent:</strong> {receivingItem.quantitySent} | <strong>Already Recv:</strong> {receivingItem.quantityReceived}<br />
                                <strong>Remaining:</strong> {(receivingItem.quantitySent - receivingItem.quantityReceived).toFixed(2)}
                            </Typography>
                        )}
                        <TextField
                            label="Received Quantity"
                            type="number"
                            fullWidth
                            sx={{ mb: 2 }}
                            value={receiveForm.quantity}
                            onChange={e => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                            error={receivingItem ? (Number(receiveForm.quantity) > (receivingItem.quantitySent - receivingItem.quantityReceived)) : false}
                            helperText={
                                receivingItem && Number(receiveForm.quantity) > (receivingItem.quantitySent - receivingItem.quantityReceived)
                                    ? `Cannot exceed remaining (${(receivingItem.quantitySent - receivingItem.quantityReceived).toFixed(2)})`
                                    : receivingItem ? `Remaining: ${(receivingItem.quantitySent - receivingItem.quantityReceived).toFixed(2)}` : ''
                            }
                        />
                        <TextField
                            label="Received Date"
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={receiveForm.date}
                            onChange={e => setReceiveForm({ ...receiveForm, date: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenReceiveDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleReceiveSubmit}
                        disabled={
                            !receiveForm.quantity ||
                            !receivingItem ||
                            (Number(receiveForm.quantity) > (receivingItem.quantitySent - receivingItem.quantityReceived))
                        }
                    >
                        Confirm Receive
                    </Button>
                </DialogActions>
            </Dialog>

            {/* View Details Dialog */}
            <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Clip Details
                    <Box>
                        <IconButton onClick={() => selectedClip && handleEditClip(selectedClip)} title="Edit Details"><Edit /></IconButton>
                        <IconButton onClick={() => selectedClip && handlePrintClip(selectedClip)}><Print /></IconButton>
                        <IconButton onClick={() => selectedClip && handleDownloadPDF(selectedClip)}><PictureAsPdf /></IconButton>
                        <IconButton onClick={() => setOpenViewDialog(false)}><Close /></IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedClip && (
                        <Box>
                            <Typography variant="h6" gutterBottom>{selectedClip.vendorName}</Typography>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={6}><Typography><strong>Contact:</strong> {selectedClip.contactNumber}</Typography></Grid>
                                <Grid item xs={6}><Typography><strong>CNIC:</strong> {selectedClip.cnic}</Typography></Grid>
                                <Grid item xs={12}><Typography><strong>Address:</strong> {selectedClip.address || 'N/A'}</Typography></Grid>
                            </Grid>

                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Contract</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Sent</TableCell>
                                        <TableCell>Received</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {selectedClip.items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.contractInfo}</TableCell>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell>{item.quantitySent}</TableCell>
                                            <TableCell>{item.quantityReceived}</TableCell>
                                            <TableCell>
                                                <Chip label={item.status} size="small" color={item.status === 'Completed' ? 'success' : 'default'} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* Vendor Management Dialog */}
            <Dialog open={openVendorDialog} onClose={() => setOpenVendorDialog(false)}>
                <DialogTitle>{vendorForm.id ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400 }}>
                        <TextField label="Vendor Name" fullWidth value={vendorForm.vendorName} onChange={e => setVendorForm({ ...vendorForm, vendorName: e.target.value })} />
                        <TextField label="Contact Number" fullWidth value={vendorForm.contactNumber} onChange={e => setVendorForm({ ...vendorForm, contactNumber: e.target.value })} />
                        <TextField label="CNIC" fullWidth value={vendorForm.cnic} onChange={e => setVendorForm({ ...vendorForm, cnic: e.target.value })} />
                        <TextField label="Address" fullWidth multiline rows={2} value={vendorForm.address} onChange={e => setVendorForm({ ...vendorForm, address: e.target.value })} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenVendorDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleVendorSubmit} disabled={!vendorForm.vendorName || !vendorForm.contactNumber}>
                        {vendorForm.id ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Vendor Progress Dialog */}
            <Dialog 
                open={openVendorProgressDialog} 
                onClose={() => {
                    setOpenVendorProgressDialog(false);
                    setSelectedVendorForProgress(null);
                    setVendorProgressData(null);
                }} 
                maxWidth="lg" 
                fullWidth
            >
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
                    Vendor Progress - {selectedVendorForProgress?.vendor_name}
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    {isLoadingVendorProgress ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <Typography>Loading vendor progress...</Typography>
                        </Box>
                    ) : vendorProgressData ? (
                        <Box>
                            {/* Vendor Info */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="subtitle2" color="text.secondary">Contact</Typography>
                                            <Typography variant="body1">{vendorProgressData.vendor.contact_number}</Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="subtitle2" color="text.secondary">CNIC</Typography>
                                            <Typography variant="body1">{vendorProgressData.vendor.cnic || 'N/A'}</Typography>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                                            <Typography variant="body1">{vendorProgressData.vendor.address || 'N/A'}</Typography>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>

                            {/* Progress Summary */}
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
                                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                                {vendorProgressData.summary.total_assigned || 0}
                                            </Typography>
                                            <Typography variant="body2">Total Contracts</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                                {vendorProgressData.summary.total_completed || 0}
                                            </Typography>
                                            <Typography variant="body2">Completed</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                                {vendorProgressData.summary.total_ongoing || 0}
                                            </Typography>
                                            <Typography variant="body2">Ongoing</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Card sx={{ bgcolor: 'grey.300', color: 'text.primary' }}>
                                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                                {vendorProgressData.summary.total_items || 0}
                                            </Typography>
                                            <Typography variant="body2">Total Work Items</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            {/* Detailed Contracts Table */}
                            <Typography variant="h6" gutterBottom>Contract Details</Typography>
                            {vendorProgressData.contracts && vendorProgressData.contracts.length > 0 ? (
                                <Box>
                                    {vendorProgressData.contracts.map((contract: any) => (
                                        <Card key={contract.id} sx={{ mb: 2 }}>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                    <Typography variant="h6">
                                                        Contract #{contract.id}
                                                    </Typography>
                                                    <Chip
                                                        label={contract.contract_status}
                                                        size="small"
                                                        color={
                                                            contract.contract_status === 'Completed' ? 'success' :
                                                            contract.contract_status === 'Ongoing' ? 'warning' : 'default'
                                                        }
                                                        variant={contract.contract_status === 'Pending' ? 'outlined' : 'filled'}
                                                    />
                                                </Box>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                    Created: {new Date(contract.created_at).toLocaleDateString()} | 
                                                    Items: {contract.total_items} | 
                                                    Completed: {contract.completed_items} | 
                                                    Ongoing: {contract.ongoing_items} | 
                                                    Pending: {contract.pending_items}
                                                </Typography>
                                                
                                                {contract.items && contract.items.length > 0 && (
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Contract</TableCell>
                                                                <TableCell>Description</TableCell>
                                                                <TableCell>Collection/Design</TableCell>
                                                                <TableCell align="right">Sent</TableCell>
                                                                <TableCell align="right">Received</TableCell>
                                                                <TableCell align="right">Pending</TableCell>
                                                                <TableCell>Date Sent</TableCell>
                                                                <TableCell>Last Received</TableCell>
                                                                <TableCell align="center">Status</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {contract.items.map((item: any) => (
                                                                <TableRow key={item.id}>
                                                                    <TableCell>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                                            {item.contract_number}
                                                                        </Typography>
                                                                        {item.po_number && (
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                PO: {item.po_number}
                                                                            </Typography>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell sx={{ maxWidth: 200 }}>
                                                                        <Typography variant="body2">{item.description}</Typography>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {item.collection && (
                                                                            <Typography variant="body2">{item.collection}</Typography>
                                                                        )}
                                                                        {item.design_no && (
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                Design: {item.design_no}
                                                                            </Typography>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell align="right">
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                                            {parseFloat(item.quantity_sent).toFixed(2)}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="right">
                                                                        <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                                                                            {parseFloat(item.quantity_received || 0).toFixed(2)}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="right">
                                                                        <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'bold' }}>
                                                                            {(parseFloat(item.quantity_sent) - parseFloat(item.quantity_received || 0)).toFixed(2)}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2">
                                                                            {new Date(item.date_sent).toLocaleDateString()}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2">
                                                                            {item.last_received_date ? new Date(item.last_received_date).toLocaleDateString() : '-'}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="center">
                                                                        <Chip
                                                                            label={item.status}
                                                                            size="small"
                                                                            color={
                                                                                item.status === 'Completed' ? 'success' :
                                                                                item.status === 'Partially Received' ? 'warning' : 'default'
                                                                            }
                                                                            variant={item.status === 'Sent' ? 'outlined' : 'filled'}
                                                                        />
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No work items assigned to this vendor yet.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="body1" color="text.secondary">
                                No progress data available.
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setOpenVendorProgressDialog(false);
                        setSelectedVendorForProgress(null);
                        setVendorProgressData(null);
                    }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default Clipping;
