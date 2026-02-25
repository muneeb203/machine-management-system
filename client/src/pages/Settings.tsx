import React, { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Card, CardContent, Grid,
    Avatar, Alert, Divider
} from '@mui/material';
import { Save, CloudUpload } from '@mui/icons-material';
import { api } from '../apiClient'; // Ensure this uses your axios instance

interface FactoryDetails {
    id?: number;
    factory_name: string;
    address: string;
    phone: string;
    email: string;
    tax_registration: string;
    website: string;
    logo_url: string;
    footer_text: string;
}

const Settings: React.FC = () => {
    const [details, setDetails] = useState<FactoryDetails>({
        factory_name: '', address: '', phone: '', email: '',
        tax_registration: '', website: '', logo_url: '', footer_text: ''
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDetails();
    }, []);

    const fetchDetails = async () => {
        try {
            const res = await api.get('/api/settings/factory');
            if (res.data.data) {
                setDetails(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch settings');
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setMessage(null);
        try {
            await api.put('/api/settings/factory', details);

            if (logoFile) {
                const formData = new FormData();
                formData.append('logo', logoFile);
                const logoRes = await api.post('/api/settings/factory/logo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setDetails(prev => ({ ...prev, logo_url: logoRes.data.logoUrl }));
                setLogoFile(null);
            }

            setMessage({ type: 'success', text: 'Settings updated successfully. Refresh page to see changes in header.' });
            // Optionally force reload or update context
            setTimeout(() => window.location.reload(), 1500);

        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update settings.' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogoFile(e.target.files[0]);
        }
    };

    return (
        <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3, color: '#1a237e' }}>
                System Settings
            </Typography>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Factory Identity</Typography>
                    {message && (
                        <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>
                    )}

                    <Grid container spacing={3}>
                        {/* Logo Section */}
                        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box sx={{ width: 150, height: 150, border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, overflow: 'hidden', borderRadius: 2 }}>
                                {logoFile ? (
                                    <img src={URL.createObjectURL(logoFile)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                ) : details.logo_url ? (
                                    <img src={details.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                ) : (
                                    <Typography color="textSecondary">No Logo</Typography>
                                )}
                            </Box>
                            <Button
                                variant="outlined"
                                component="label"
                                startIcon={<CloudUpload />}
                                size="small"
                            >
                                Upload Logo
                                <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                            </Button>
                            <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
                                Recommended: 300x100px PNG/JPG
                            </Typography>
                        </Grid>

                        {/* Form Section */}
                        <Grid item xs={12} md={8}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Factory Name (Required)"
                                        fullWidth
                                        value={details.factory_name}
                                        onChange={e => setDetails({ ...details, factory_name: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Address"
                                        fullWidth
                                        multiline
                                        rows={2}
                                        value={details.address}
                                        onChange={e => setDetails({ ...details, address: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="Phone"
                                        fullWidth
                                        value={details.phone}
                                        onChange={e => setDetails({ ...details, phone: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="Email"
                                        fullWidth
                                        value={details.email}
                                        onChange={e => setDetails({ ...details, email: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="Tax / Reg ID"
                                        fullWidth
                                        value={details.tax_registration}
                                        onChange={e => setDetails({ ...details, tax_registration: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="Website"
                                        fullWidth
                                        value={details.website}
                                        onChange={e => setDetails({ ...details, website: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Footer Text (for Documents)"
                                        fullWidth
                                        value={details.footer_text}
                                        onChange={e => setDetails({ ...details, footer_text: e.target.value })}
                                        helperText="Short text like 'Generated by ERP' or copyright info."
                                    />
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<Save />}
                            onClick={handleSave}
                            disabled={loading || !details.factory_name}
                        >
                            {loading ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </Box>

                </CardContent>
            </Card>
        </Box>
    );
};

export default Settings;
