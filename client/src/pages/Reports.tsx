import React from 'react';
import { Typography, Box } from '@mui/material';

const Reports: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports & Analytics
      </Typography>
      <Typography>
        Production reports, billing summaries, audit trails, and reconciliation reports will be implemented here.
      </Typography>
    </Box>
  );
};

export default Reports;