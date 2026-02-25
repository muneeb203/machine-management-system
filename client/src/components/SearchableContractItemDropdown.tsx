import React, { useState, useEffect, useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useQuery } from 'react-query';
import api from '../apiClient';

interface ContractItem {
  itemId?: number; // Optional since contracts without items won't have this
  contractId: number;
  contractNumber: string | number;
  poNumber: string;
  contractDate: string;
  collection?: string;
  designNo?: string;
  component?: string;
  itemDescription?: string;
  fabric?: string;
  color?: string;
  hasItems?: number; // 1 if contract has items, 0 if not
}

interface SearchableContractItemDropdownProps {
  value: string;
  onChange: (contractId: string, itemData?: ContractItem) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

const SearchableContractItemDropdown: React.FC<SearchableContractItemDropdownProps> = ({
  value,
  onChange,
  label = "Link Contract",
  placeholder = "Search by Contract No, PO No, Collection, Design No...",
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

  // Fetch contract items with search functionality
  const { data: contractItems = [], isLoading } = useQuery(
    ['contract-items-search', debouncedSearchTerm],
    async () => {
      const params: any = {
        limit: 50, // Reasonable limit for dropdown performance
      };
      
      // Add search parameter if there's a search term
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }

      const response = await api.get('/api/contracts/dropdown-items', { params });
      return response.data?.data || [];
    },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 5 * 60 * 1000, // 5 minutes
      keepPreviousData: true, // Keep previous results while loading new ones
    }
  );

  // Group items by contract for better organization
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: ContractItem[] } = {};
    contractItems.forEach((item: ContractItem) => {
      const key = `${item.contractNumber}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    return groups;
  }, [contractItems]);

  // Find selected contract item
  const selectedItem = contractItems.find((item: ContractItem) => 
    String(item.contractId) === value
  ) || null;

  // Format option display for autocomplete input
  const getOptionLabel = (item: ContractItem) => {
    const parts = [];
    
    if (item.contractNumber) {
      parts.push(`#${item.contractNumber}`);
    }
    
    if (item.poNumber) {
      parts.push(`PO: ${item.poNumber}`);
    }
    
    // Only add item details if the contract has items
    if (item.hasItems === 1) {
      if (item.collection) {
        parts.push(item.collection);
      }

      if (item.designNo) {
        parts.push(item.designNo);
      }

      if (item.component) {
        parts.push(`(${item.component})`);
      }
    } else {
      parts.push('(No Items)');
    }

    return parts.join(' • ') || `Contract ${item.contractId}`;
  };

  // Custom option rendering with detailed information
  const renderOption = (props: any, item: ContractItem) => {
    const hasItems = item.hasItems === 1;
    
    return (
      <Box component="li" {...props} key={`${item.contractId}-${item.itemId || 'contract'}`}>
        <Box sx={{ width: '100%', py: 1.5, px: 1 }}>
          {/* Contract Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight="bold" color="primary">
                Contract #{item.contractNumber}
              </Typography>
              <Chip 
                label="Active" 
                size="small" 
                color="success"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
              {!hasItems && (
                <Chip 
                  label="No Items" 
                  size="small" 
                  color="warning"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}
            </Box>
            {item.contractDate && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {new Date(item.contractDate).toLocaleDateString()}
              </Typography>
            )}
          </Box>
          
          {/* Main Details Card */}
          <Box sx={{ 
            bgcolor: hasItems ? 'grey.50' : 'orange.50',
            borderRadius: 1,
            p: 1.5,
            border: '1px solid',
            borderColor: hasItems ? 'grey.200' : 'orange.200'
          }}>
            {/* PO Number - Prominent */}
            {item.poNumber && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight="600" color="text.primary">
                  PO: {item.poNumber}
                </Typography>
              </Box>
            )}

            {hasItems ? (
              <>
                {/* Contract Details Grid - Only show if has items */}
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: 1.5,
                  mb: 1
                }}>
                  {/* Left Column */}
                  <Box>
                    {item.collection && (
                      <Box sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Collection
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                          {item.collection}
                        </Typography>
                      </Box>
                    )}
                    
                    {item.designNo && (
                      <Box sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Design No
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                          {item.designNo}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  
                  {/* Right Column */}
                  <Box>
                    {item.component && (
                      <Box sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Component
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                          {item.component}
                        </Typography>
                      </Box>
                    )}
                    
                    {item.fabric && (
                      <Box sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Fabric
                        </Typography>
                        <Typography variant="body2" color="text.primary">
                          {item.fabric}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Additional Details Row */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {item.color && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Color:
                      </Typography>
                      <Chip 
                        label={item.color} 
                        size="small" 
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Item Description */}
                {item.itemDescription && (
                  <Box sx={{ 
                    mt: 1,
                    pt: 1,
                    borderTop: '1px solid',
                    borderTopColor: 'grey.300'
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block' }}>
                      Description
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ fontStyle: 'italic' }}>
                      {item.itemDescription}
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              /* Contract without items - Show basic info */
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  This contract doesn't have any items yet.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  You can still link this contract to the gate pass.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  // Custom grouping for better UX
  const renderGroup = (params: any) => (
    <Box key={params.key}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          px: 2, 
          py: 1, 
          bgcolor: 'grey.100', 
          fontWeight: 'bold',
          borderBottom: '1px solid',
          borderBottomColor: 'grey.300'
        }}
      >
        Contract #{params.group}
      </Typography>
      {params.children}
    </Box>
  );

  return (
    <Autocomplete
      value={selectedItem}
      onChange={(_, newValue) => {
        if (newValue) {
          onChange(String(newValue.contractId), newValue);
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
      options={contractItems}
      getOptionLabel={getOptionLabel}
      renderOption={renderOption}
      loading={isLoading}
      disabled={disabled}
      fullWidth={fullWidth}
      clearOnBlur={false}
      selectOnFocus
      handleHomeEndKeys
      filterOptions={(x) => x} // Disable built-in filtering since we handle it ourselves
      ListboxProps={{
        style: { maxHeight: '500px' } // Increase max height for detailed options
      }}
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
            ? "No contract items found matching your search"
            : "Start typing to search contracts..."
      }
    />
  );
};

export default SearchableContractItemDropdown;