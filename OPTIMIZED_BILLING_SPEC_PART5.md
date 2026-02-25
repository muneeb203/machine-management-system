# Optimized Billing - Part 5: Frontend Implementation

## 6. Frontend Components & State Management

### 6.1 Main Component Structure

**File**: `client/src/pages/OptimizedBilling.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../apiClient';

interface BillHeader {
  party_name: string;
  bill_date: string;
  collection: string;
  design_no: string;
  notes: string;
  igp: string;
  code: string;
}

interface BillItem {
  id: string; // Temporary ID for UI
  design_no: string;
  collection: string;
  fabric: string;
  yards: number;
  stitches: number;
  rate_stitch: number;
  rate_per_yds: number;
  rate_repeat: number;
  repeats: number;
  pieces: number;
  amount: number;
  wte_ogp: string;
  h2h_po: string;
  formula_details: any;
}

interface DesignGroup {
  design_no: string;
  collection: string;
  variants: BillItem[];
}

const OptimizedBilling: React.FC = () => {
  // State
  const [header, setHeader] = useState<BillHeader>({
    party_name: '',
    bill_date: new Date().toISOString().split('T')[0],
    collection: '',
    design_no: '',
    notes: '',
    igp: '',
    code: ''
  });
  
  const [designGroups, setDesignGroups] = useState<DesignGroup[]>([]);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [openAddVariant, setOpenAddVariant] = useState(false);
  const [currentDesignIndex, setCurrentDesignIndex] = useState<number>(0);
  
  const queryClient = useQueryClient();
  
  // Queries
  const { data: factoryDetails } = useQuery('factoryDetails', 
    () => api.get('/api/settings/factory').then(res => res.data)
  );
  
  const { data: billHistory, isLoading } = useQuery('billHistory',
    () => api.get('/api/bills').then(res => res.data)
  );
  
  // Mutations
  const saveBillMutation = useMutation(
    (data: any) => editingBillId 
      ? api.put(`/api/bills/${editingBillId}`, data)
      : api.post('/api/bills', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('billHistory');
        resetForm();
        // Show success notification
      }
    }
  );
  
  // Handlers
  const handleAddDesign = () => {
    setDesignGroups([...designGroups, {
      design_no: '',
      collection: header.collection,
      variants: []
    }]);
  };
  
  const handleAddVariant = (designIndex: number, variantData: any) => {
    const newGroups = [...designGroups];
    newGroups[designIndex].variants.push({
      id: `temp-${Date.now()}`,
      design_no: newGroups[designIndex].design_no,
      collection: newGroups[designIndex].collection,
      fabric: variantData.fabric,
      yards: variantData.yards,
      stitches: 0,
      rate_stitch: 0,
      rate_per_yds: 0,
      rate_repeat: 0,
      repeats: 0,
      pieces: 0,
      amount: 0,
      wte_ogp: '',
      h2h_po: '',
      formula_details: {}
    });
    setDesignGroups(newGroups);
  };
  
  const handleFieldChange = (designIndex: number, variantIndex: number, field: string, value: any) => {
    const newGroups = [...designGroups];
    const variant = newGroups[designIndex].variants[variantIndex];
    variant[field] = value;
    
    // Recalculate dependent fields
    recalculateVariant(variant);
    
    setDesignGroups(newGroups);
  };
  
  const recalculateVariant = (variant: BillItem) => {
    // Formula: rate_per_yds = (d_stitch / 1000) * 2.77 * rate_stitch
    // Assuming d_stitch = 104 (can be made configurable)
    const d_stitch = 104;
    variant.rate_per_yds = (d_stitch / 1000) * 2.77 * variant.rate_stitch;
    
    // Formula: amount = yards * rate_per_yds
    variant.amount = variant.yards * variant.rate_per_yds;
    
    // Store formula details
    variant.formula_details = {
      method: 'STANDARD',
      inputs: {
        d_stitch,
        stitches: variant.stitches,
        rate_stitch: variant.rate_stitch,
        yards: variant.yards
      },
      calculated: {
        rate_per_yds: variant.rate_per_yds,
        amount: variant.amount
      },
      timestamp: new Date().toISOString()
    };
  };
  
  const calculateTotalBill = () => {
    return designGroups.reduce((total, group) => {
      return total + group.variants.reduce((sum, v) => sum + v.amount, 0);
    }, 0);
  };
  
  const handleSave = () => {
    // Validate
    if (!header.party_name || !header.bill_date) {
      alert('Please fill required fields');
      return;
    }
    
    // Flatten variants into items array
    const items = designGroups.flatMap(group => group.variants);
    
    if (items.length === 0) {
      alert('Please add at least one variant');
      return;
    }
    
    // Save
    saveBillMutation.mutate({ header, items });
  };
  
  const resetForm = () => {
    setHeader({
      party_name: '',
      bill_date: new Date().toISOString().split('T')[0],
      collection: '',
      design_no: '',
      notes: '',
      igp: '',
      code: ''
    });
    setDesignGroups([]);
    setEditingBillId(null);
  };
  
  const handleEdit = async (billId: number) => {
    const response = await api.get(`/api/bills/${billId}`);
    const bill = response.data.data;
    
    // Load header
    setHeader({
      party_name: bill.bill.party_name,
      bill_date: bill.bill.bill_date,
      collection: bill.bill.po_number,
      design_no: '',
      notes: bill.bill.notes,
      igp: '',
      code: ''
    });
    
    // Group items by design
    const groups = groupItemsByDesign(bill.items);
    setDesignGroups(groups);
    setEditingBillId(billId);
  };
  
  const groupItemsByDesign = (items: any[]) => {
    const grouped = new Map<string, BillItem[]>();
    
    items.forEach(item => {
      const key = `${item.design_no}-${item.collection}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });
    
    return Array.from(grouped.entries()).map(([key, variants]) => ({
      design_no: variants[0].design_no,
      collection: variants[0].collection,
      variants
    }));
  };
  
  return (
    <Box>
      {/* Component JSX - see next section */}
    </Box>
  );
};

export default OptimizedBilling;
```
