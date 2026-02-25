import React from 'react';
import {
  Typography,
  Box
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import OptimizedDailyBilling from '../components/OptimizedDailyBilling';

const Production: React.FC = () => {
  const { user } = useAuth();

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Daily Production
      </Typography>

      <OptimizedDailyBilling />
    </Box>
  );
};

export default Production;