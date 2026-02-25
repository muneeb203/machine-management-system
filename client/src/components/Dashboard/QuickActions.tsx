import React from 'react';
import {
    Paper,
    Typography,
    Box,
    Button,
    Stack
} from '@mui/material';
import {
    AddCircleOutline,
    NoteAdd,
    LocalShipping,
    ContentCut
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const QuickActions: React.FC = () => {
    const navigate = useNavigate();

    const actions = [
        { label: 'Add Production', icon: <AddCircleOutline />, path: '/production' },
        { label: 'Create Contract', icon: <NoteAdd />, path: '/contracts' },
        { label: 'Create Gate Pass', icon: <LocalShipping />, path: '/gate-passes' },
        { label: 'Create Clipping', icon: <ContentCut />, path: '/clipping' },
    ];

    return (
        <Paper sx={{ p: 2, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ mr: 3 }}>
                    Quick Actions
                </Typography>
                <Stack direction="row" spacing={2} sx={{ flexGrow: 1, overflowX: 'auto' }}>
                    {actions.map((action, index) => (
                        <Button
                            key={index}
                            variant="outlined"
                            startIcon={action.icon}
                            onClick={() => navigate(action.path)}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {action.label}
                        </Button>
                    ))}
                </Stack>
            </Box>
        </Paper>
    );
};

export default QuickActions;
