import React, { useState, useMemo, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress, Typography, Box, Grid } from '@mui/material';
import { throttle } from 'lodash';
import api from '../apiClient';

export interface ContractItemOption {
    contractItemId: number;
    contractId: number;
    contractNo: number | string;
    collection: string;
    itemLabel: string; // DesignNo or Description
    stitch: number;
    pieces: number;
    contractDate?: string;
    description?: string;
    assignedMachineIds?: string; // Comma-separated IDs
    usedStitches?: number;
    usedRepeats?: number;
    machinePending?: string; // Format: "ID:Pending,ID:Pending"
}

interface ContractItemSelectProps {
    value: ContractItemOption | null;
    onChange: (value: ContractItemOption | null) => void;
    label?: string;
    error?: boolean;
    helperText?: string;
    onlyPending?: boolean;
}

const ContractItemSelect: React.FC<ContractItemSelectProps> = ({
    value,
    onChange,
    label = "Select Collection / Item",
    error = false,
    helperText = "",
    onlyPending = false
}) => {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ContractItemOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');

    // Fetch logic with throttle
    const fetchOptions = useMemo(
        () =>
            throttle(async (request: { input: string }, callback: (results?: ContractItemOption[]) => void) => {
                try {
                    // Construct Query Map
                    // We'll use a simple search param 'q'
                    const params: any = { limit: 50 }; // Limit to 50 for performance
                    if (request.input) params.q = request.input;
                    if (onlyPending) params.onlyPending = 'true';

                    const response = await api.get('/api/contract-items', { params });
                    callback(response.data.data);
                } catch (error) {
                    console.error("Failed to fetch contract items", error);
                    callback([]);
                }
            }, 500),
        [onlyPending]
    );

    useEffect(() => {
        let active = true;

        if (!open) {
            return undefined;
        }

        setLoading(true);

        fetchOptions({ input: inputValue }, (results?: ContractItemOption[]) => {
            if (active) {
                let newOptions = [] as ContractItemOption[];

                if (results) {
                    newOptions = [...results];
                }

                setOptions(newOptions);
                setLoading(false);
            }
        });

        return () => {
            active = false;
        };
    }, [inputValue, fetchOptions, open]);

    return (
        <Autocomplete
            id="contract-item-select"
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            isOptionEqualToValue={(option, value) => option.contractItemId === value.contractItemId}
            getOptionLabel={(option) => {
                const total = Number(option.stitch || 0);
                const used = Number(option.usedStitches || 0);
                const remaining = Math.max(0, total - used);
                return `#${option.contractNo} — ${option.collection} — ${option.itemLabel} (Rem: ${remaining.toLocaleString()})`;
            }}
            options={options}
            loading={loading}
            value={value}
            onChange={(event, newValue) => {
                onChange(newValue);
            }}
            onInputChange={(event, newInputValue) => {
                setInputValue(newInputValue);
            }}
            filterOptions={(x) => x} // Disable client-side filtering since server handles it
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    fullWidth
                    error={error}
                    helperText={helperText}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <React.Fragment>
                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                            </React.Fragment>
                        ),
                    }}
                />
            )}
            renderOption={(props, option) => {
                return (
                    <li {...props} key={option.contractItemId}>
                        <Grid container alignItems="center">
                            <Grid item xs>
                                <Box component="span" sx={{ fontWeight: 'bold', display: 'block' }}>
                                    #{option.contractNo} — {option.collection}
                                </Box>
                                <Typography variant="body2" color="textSecondary">
                                    {option.itemLabel}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    Stitch: {option.stitch?.toLocaleString()} | Pcs: {option.pieces}
                                </Typography>
                            </Grid>
                        </Grid>
                    </li>
                );
            }}
            noOptionsText={
                inputValue !== '' ? (
                    <Box>
                        <Typography variant="body2">No items found.</Typography>
                        {/* Optional: Add "Create New" logic here if needed, but managing state uptream 
                    might be better. For now just text.
                 */}
                    </Box>
                ) : "Type to search..."
            }
        />
    );
};

export default ContractItemSelect;
