import React, { useState, useEffect, useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useQuery } from 'react-query';
import api from '../apiClient';

interface Contract {
  id: number;
  contractNumber: string | number;
  poNumber: string;
  contractDate: string;
  collections?: string;
  designNos?: string;
  partyName?: string;
  status?: string;
}

interface SearchableContractDropdownProps {
  value: string;
  onChange: (contractId: string, contractData?: Contract) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

const SearchableContractDropdown: React.FC<SearchableContractDropdownProps> = ({
  value,
  onChange,
  label = "Link Contract",
  placeholder = "Search by Contract No, PO No, or Collection...",
  disabled = false,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch contracts with search functionality
  const { data: contracts = [], isLoading } = useQuery(
    ['contracts-search', debouncedSearchTerm],
    async () => {
      const params: any = {
        status: 'active',
        limit: 50, // Reasonable limit for dropdown performance
      };
      
      // Add search parameter if there's a search term
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }

      const response = await api.get('/api/contracts', { params });
      return response.data?.data || [];
    },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 5 * 60 * 1000, // 5 minutes
      keepPreviousData: true, // Keep previous results while loading new ones
    }
  );

  // Filter contracts based on search term (client-side filtering as backup)
  const filteredContracts = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return contracts;
    }

    const searchLower = debouncedSearchTerm.toLowerCase();
    return contracts.filter((contract: Contract) => {
      const contractNumber = String(contract.contractNumber || '').toLowerCase();
      const poNumber = String(contract.poNumber || '').toLowerCase();
      const collections = String(contract.collections || '').toLowerCase();
      const partyName = String(contract.partyName || '').toLowerCase();

      return (
        contractNumber.includes(searchLower) ||
        poNumber.includes(searchLower) ||
        collections.includes(searchLower) ||
        partyName.includes(searchLower)
      );
    });
  }, [contracts, debouncedSearchTerm]);

  // Find selected contract
  const selectedContract = contracts.find((c: Contract) => String(c.id) === value) || null;

  // Format option display
  const getOptionLabel = (contract: Contract) => {
    const parts = [];
    
    if (contract.contractNumber) {
      parts.push(`#${contract.contractNumber}`);
    }
    
    if (contract.poNumber) {
      parts.push(`PO: ${contract.poNumber}`);
    }
    
    if (contract.collections) {
      parts.push(contract.collections);
    }

    return parts.join(' • ') || `Contract ${contract.id}`;
  };

  // Custom option rendering
  const renderOption = (props: any, contract: Contract) => (
    <Box component="li" {...props} key={contract.id}>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="body2" fontWeight="bold">
            #{contract.contractNumber}
          </Typography>
          {contract.status && (
            <Chip 
              label={contract.status} 
              size="small" 
              color={contract.status === 'active' ? 'success' : 'default'}
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {contract.poNumber && (
            <Typography variant="caption" color="text.secondary">
              PO: {contract.poNumber}
            </Typography>
          )}
          
          {contract.collections && (
            <Typography variant="caption" color="text.secondary">
              Collection: {contract.collections}
            </Typography>
          )}
          
          {contract.contractDate && (
            <Typography variant="caption" color="text.secondary">
              Date: {new Date(contract.contractDate).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Autocomplete
      value={selectedContract}
      onChange={(_, newValue) => {
        if (newValue) {
          onChange(String(newValue.id), newValue);
        } else {
          onChange('');
        }
      }}
      inputValue={searchTerm}
      onInputChange={(_, newInputValue, reason) => {
        if (reason === 'input') {
          setSearchTerm(newInputValue);
        }
      }}
      options={filteredContracts}
      getOptionLabel={getOptionLabel}
      renderOption={renderOption}
      loading={isLoading}
      disabled={disabled}
      fullWidth={fullWidth}
      clearOnBlur={false}
      selectOnFocus
      handleHomeEndKeys
      filterOptions={(x) => x} // Disable built-in filtering since we handle it ourselves
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      noOptionsText={
        isLoading 
          ? "Searching contracts..."
          : debouncedSearchTerm.trim() 
            ? "No contracts found matching your search"
            : "Start typing to search contracts..."
      }
    />
  );
};

export default SearchableContractDropdown;