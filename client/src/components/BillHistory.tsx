import React, { useState } from 'react';
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Collapse,
    Typography,
    Button,
    Chip,
    Pagination,
} from '@mui/material';
import {
    KeyboardArrowDown,
    KeyboardArrowUp,
    Edit,
    Print,
    GetApp,
    Delete,
} from '@mui/icons-material';
import api from '../apiClient';

interface Bill {
    bill_id: number;
    bill_number: string;
    bill_date: string;
    party_name: string;
    po_number?: string;
}

interface BillItem {
    bill_item_id: number;
    design_no?: string;
    item_description?: string;
    qty?: number;
    stitches: number;
    rate_type: string;
    rate_per_unit: number;
    amount: number;
}

interface BillHistoryProps {
    bills: Bill[];
    total: number;
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
    onEdit: (bill: Bill) => void;
    onDelete: (billId: number) => void;
}

const BillHistoryRow: React.FC<{ bill: Bill; onEdit: (bill: Bill) => void; onDelete: (billId: number) => void }> = ({ bill, onEdit, onDelete }) => {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<BillItem[]>([]);
    const [loading, setLoading] = useState(false);

    const loadItems = async () => {
        if (items.length === 0) {
            setLoading(true);
            try {
                const response = await api.get(`/api/bills/${bill.bill_id}`);
                setItems(response.data.data.items);
            } catch (error) {
                console.error('Failed to load bill items:', error);
            } finally {
                setLoading(false);
            }
        }
        setOpen(!open);
    };

    const handlePrint = () => {
        window.open(`/api/bills/${bill.bill_id}/export?format=pdf`, '_blank');
    };

    const handleDownloadPDF = async () => {
        try {
            const response = await api.post(`/api/bills/${bill.bill_id}/export?format=pdf`, {}, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `bill_${bill.bill_number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download PDF:', error);
        }
    };

    const totalStitches = items.reduce((sum, item) => sum + Number(item.stitches), 0);
    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    return (
        <>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                <TableCell>
                    <IconButton size="small" onClick={loadItems}>
                        {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                    </IconButton>
                </TableCell>
                <TableCell>{bill.bill_number}</TableCell>
                <TableCell>{new Date(bill.bill_date).toLocaleDateString()}</TableCell>
                <TableCell>{bill.party_name}</TableCell>
                <TableCell>{bill.po_number || '-'}</TableCell>
                <TableCell align="right">{items.length || '-'}</TableCell>
                <TableCell align="right">{items.length > 0 ? totalAmount.toFixed(2) : '-'}</TableCell>
                <TableCell align="center">
                    <IconButton size="small" onClick={() => onEdit(bill)} title="Edit">
                        <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={handlePrint} title="Print">
                        <Print fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={handleDownloadPDF} title="Download PDF">
                        <GetApp fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDelete(bill.bill_id)} title="Delete Bill" color="error">
                        <Delete fontSize="small" />
                    </IconButton>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Bill Items</Typography>
                            {loading ? (
                                <Typography variant="body2">Loading...</Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Design No</TableCell>
                                            <TableCell>Item</TableCell>
                                            <TableCell align="right">Qty</TableCell>
                                            <TableCell align="right">Stitches</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell align="right">Rate</TableCell>
                                            <TableCell align="right">Amount</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.bill_item_id}>
                                                <TableCell>{item.design_no || '-'}</TableCell>
                                                <TableCell>{item.item_description || '-'}</TableCell>
                                                <TableCell align="right">{item.qty || 0}</TableCell>
                                                <TableCell align="right">{Number(item.stitches).toLocaleString()}</TableCell>
                                                <TableCell>{item.rate_type}</TableCell>
                                                <TableCell align="right">{Number(item.rate_per_unit).toFixed(2)}</TableCell>
                                                <TableCell align="right">{Number(item.amount).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow>
                                            <TableCell colSpan={3} align="right"><strong>Totals:</strong></TableCell>
                                            <TableCell align="right"><strong>{totalStitches.toLocaleString()}</strong></TableCell>
                                            <TableCell colSpan={2}></TableCell>
                                            <TableCell align="right"><strong>{totalAmount.toFixed(2)}</strong></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            )}
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};

const BillHistory: React.FC<BillHistoryProps> = ({ bills, total, page, limit, onPageChange, onEdit, onDelete }) => {
    const totalPages = Math.ceil(total / limit);

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>Bill History</Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell />
                            <TableCell>Bill Number</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Party</TableCell>
                            <TableCell>PO Number</TableCell>
                            <TableCell align="right">Items</TableCell>
                            <TableCell align="right">Total Amount</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!bills || bills.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">No bills found</TableCell>
                            </TableRow>
                        ) : (
                            bills.map((bill) => (
                                <BillHistoryRow key={bill.bill_id} bill={bill} onEdit={onEdit} onDelete={onDelete} />
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination count={totalPages} page={page} onChange={(_, newPage) => onPageChange(newPage)} />
                </Box>
            )}
        </Box>
    );
};

export default BillHistory;
