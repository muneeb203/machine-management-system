import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface KPICardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    color?: string;
    showTrend?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, icon, color }) => {
    return (
        <Card sx={{ height: '100%', borderLeft: color ? `4px solid ${color}` : 'none' }}>
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography color="textSecondary" gutterBottom variant="subtitle2">
                            {title}
                        </Typography>
                        <Typography variant="h4" component="div">
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="textSecondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    {icon && (
                        <Box color={color || 'primary.main'} sx={{ opacity: 0.8 }}>
                            {icon}
                        </Box>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};
