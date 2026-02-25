import React from 'react';
import {
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Paper,
    Typography,
    Chip,
    Box,
    Divider
} from '@mui/material';
import {
    PrecisionManufacturing,
    Description,
    LocalShipping,
    Assignment
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
    type: 'production' | 'gatepass' | 'clipping' | 'contract';
    id: number;
    date: string;
    summary: string;
}

interface ActivityFeedProps {
    activities: ActivityItem[];
}

const getIcon = (type: string) => {
    switch (type) {
        case 'production': return <PrecisionManufacturing color="primary" />;
        case 'gatepass': return <Description color="secondary" />;
        case 'clipping': return <LocalShipping color="action" />;
        case 'contract': return <Assignment color="success" />;
        default: return <Assignment />;
    }
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
    return (
        <Paper sx={{ p: 2, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom component="div">
                Recent Activity
            </Typography>
            <Box sx={{ overflowY: 'auto', flexGrow: 1, maxHeight: 400 }}>
                <List>
                    {activities.length === 0 ? (
                        <ListItem>
                            <ListItemText primary="No recent activity" />
                        </ListItem>
                    ) : (
                        activities.map((item, index) => (
                            <React.Fragment key={`${item.type}-${item.id}-${index}`}>
                                <ListItem alignItems="flex-start">
                                    <ListItemIcon>
                                        {getIcon(item.type)}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.summary}
                                        secondary={
                                            <React.Fragment>
                                                <Typography
                                                    component="span"
                                                    variant="body2"
                                                    color="text.primary"
                                                >
                                                    {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                                                </Typography>
                                            </React.Fragment>
                                        }
                                    />
                                    <Chip
                                        label={item.type}
                                        size="small"
                                        variant="outlined"
                                        sx={{ textTransform: 'capitalize', ml: 1 }}
                                    />
                                </ListItem>
                                {index < activities.length - 1 && <Divider variant="inset" component="li" />}
                            </React.Fragment>
                        ))
                    )}
                </List>
            </Box>
        </Paper>
    );
};

export default ActivityFeed;
