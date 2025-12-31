import React from 'react';
import { Typography, Box } from '@mui/material';

const Admin: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Administration
      </Typography>
      <Typography>
        Rate management, user administration, system configuration, and data backup will be implemented here.
      </Typography>
    </Box>
  );
};

export default Admin;