import React from 'react';
import {
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    LinearProgress,
    Box,
    Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface ContractProgress {
    id: number;
    contractNo: string;
    client: string;
    completionPct: number;
    daysRemaining: number;
}

interface ContractSnapshotProps {
    contracts: ContractProgress[];
}

const ContractSnapshot: React.FC<ContractSnapshotProps> = ({ contracts }) => {
    const navigate = useNavigate();

    return (
        <Paper sx={{ p: 2, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" component="div">
                    Contract Progress
                </Typography>
                <Button size="small" onClick={() => navigate('/contracts')}>
                    View All
                </Button>
            </Box>
            <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Contract #</TableCell>
                            <TableCell>Progress</TableCell>
                            <TableCell align="right">Days Left</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {contracts.map((row) => (
                            <TableRow key={row.id} hover>
                                <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                                    {row.contractNo}
                                </TableCell>
                                <TableCell>
                                    <Box display="flex" alignItems="center">
                                        <Box width="100%" mr={1}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={row.completionPct}
                                                color={row.completionPct >= 90 ? 'success' : row.completionPct < 50 ? 'error' : 'warning'}
                                            />
                                        </Box>
                                        <Box minWidth={35}>
                                            <Typography variant="body2" color="textSecondary">{`${Math.round(
                                                row.completionPct,
                                            )}%`}</Typography>
                                        </Box>
                                    </Box>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        color={row.daysRemaining < 0 ? 'error' : row.daysRemaining < 7 ? 'warning.main' : 'success.main'}
                                        fontWeight={row.daysRemaining < 7 ? 'bold' : 'normal'}
                                    >
                                        {row.daysRemaining} days
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                        {contracts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} align="center">No active contracts</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default ContractSnapshot;
