import { db, logAudit, withTransaction } from '../database/connection';
import { Contract, Design, CreateContractRequest, CreateDesignRequest } from '../types';

export class ContractService {
  
  /**
   * Create a new contract
   */
  static async createContract(
    contractData: CreateContractRequest,
    userId: number
  ): Promise<Contract> {
    return withTransaction(async (trx) => {
      // Check if contract number already exists
      const existingContract = await trx('contracts')
        .where('contract_number', contractData.contractNumber)
        .whereNull('deleted_at')
        .first();
      
      if (existingContract) {
        throw new Error('Contract number already exists');
      }
      
      const contract = {
        contract_number: contractData.contractNumber,
        party_name: contractData.partyName,
        po_number: contractData.poNumber,
        gate_pass_number: contractData.gatePassNumber,
        start_date: new Date(contractData.startDate),
        end_date: contractData.endDate ? new Date(contractData.endDate) : null,
        collection_name: contractData.collectionName,
        status: 'active' as const,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      const [inserted] = await trx('contracts')
        .insert(contract)
        .returning('*');
      
      // Log audit trail
      await logAudit('contracts', inserted.id, 'insert', null, inserted, userId);
      
      return {
        id: inserted.id,
        contractNumber: inserted.contract_number,
        partyName: inserted.party_name,
        poNumber: inserted.po_number,
        gatePassNumber: inserted.gate_pass_number,
        startDate: inserted.start_date,
        endDate: inserted.end_date,
        collectionName: inserted.collection_name,
        status: inserted.status,
        createdBy: inserted.created_by,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      };
    });
  }
  
  /**
   * Create a design within a contract
   */
  static async createDesign(
    designData: CreateDesignRequest,
    userId: number
  ): Promise<Design> {
    return withTransaction(async (trx) => {
      // Validate contract exists
      const contract = await trx('contracts')
        .where('id', designData.contractId)
        .whereNull('deleted_at')
        .first();
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if design already exists for this contract
      const existingDesign = await trx('designs')
        .where({
          contract_id: designData.contractId,
          design_number: designData.designNumber,
          component: designData.component,
        })
        .whereNull('deleted_at')
        .first();
      
      if (existingDesign) {
        throw new Error('Design with this number and component already exists for this contract');
      }
      
      const design = {
        contract_id: designData.contractId,
        design_number: designData.designNumber,
        component: designData.component,
        repeat_type: designData.repeatType,
        repeat_value: designData.repeatValue,
        planned_quantity: designData.plannedQuantity,
        planned_stitch_count: designData.plannedStitchCount,
        status: 'pending' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      const [insertedDesign] = await trx('designs')
        .insert(design)
        .returning('*');
      
      // Create design rate elements (snapshot current rates)
      for (const rateElement of designData.rateElements) {
        const currentRate = await trx('rate_elements')
          .where('id', rateElement.rateElementId)
          .first();
        
        if (currentRate) {
          await trx('design_rate_elements').insert({
            design_id: insertedDesign.id,
            rate_element_id: rateElement.rateElementId,
            rate_per_stitch: currentRate.rate_per_stitch,
            is_selected: rateElement.isSelected,
            created_at: new Date(),
          });
        }
      }
      
      // Log audit trail
      await logAudit('designs', insertedDesign.id, 'insert', null, insertedDesign, userId);
      
      // Get design with rate elements
      const designWithRates = await this.getDesignById(insertedDesign.id);
      return designWithRates!;
    });
  }
  
  /**
   * Get contract by ID with designs
   */
  static async getContractById(contractId: number): Promise<Contract | null> {
    const contract = await db('contracts')
      .where('id', contractId)
      .whereNull('deleted_at')
      .first();
    
    if (!contract) return null;
    
    return {
      id: contract.id,
      contractNumber: contract.contract_number,
      partyName: contract.party_name,
      poNumber: contract.po_number,
      gatePassNumber: contract.gate_pass_number,
      startDate: contract.start_date,
      endDate: contract.end_date,
      collectionName: contract.collection_name,
      status: contract.status,
      createdBy: contract.created_by,
      createdAt: contract.created_at,
      updatedAt: contract.updated_at,
    };
  }
  
  /**
   * Get design by ID with rate elements
   */
  static async getDesignById(designId: number): Promise<Design | null> {
    const design = await db('designs')
      .join('contracts', 'designs.contract_id', 'contracts.id')
      .where('designs.id', designId)
      .whereNull('designs.deleted_at')
      .select(
        'designs.*',
        'contracts.contract_number',
        'contracts.party_name'
      )
      .first();
    
    if (!design) return null;
    
    const rateElements = await db('design_rate_elements')
      .join('rate_elements', 'design_rate_elements.rate_element_id', 'rate_elements.id')
      .where('design_rate_elements.design_id', designId)
      .select(
        'design_rate_elements.*',
        'rate_elements.name',
        'rate_elements.description'
      );
    
    return {
      id: design.id,
      contractId: design.contract_id,
      designNumber: design.design_number,
      component: design.component,
      repeatType: design.repeat_type,
      repeatValue: design.repeat_value,
      plannedQuantity: design.planned_quantity,
      plannedStitchCount: design.planned_stitch_count,
      status: design.status,
      createdAt: design.created_at,
      updatedAt: design.updated_at,
      contract: {
        id: design.contract_id,
        contractNumber: design.contract_number,
        partyName: design.party_name,
        startDate: new Date(),
        status: 'active' as const,
        createdBy: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      rateElements: rateElements.map(re => ({
        id: re.id,
        designId: re.design_id,
        rateElementId: re.rate_element_id,
        ratePerStitch: parseFloat(re.rate_per_stitch),
        isSelected: re.is_selected,
        createdAt: re.created_at,
        rateElement: {
          id: re.rate_element_id,
          name: re.name,
          description: re.description,
          ratePerStitch: parseFloat(re.rate_per_stitch),
          isActive: true,
          createdBy: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })),
    };
  }
  
  /**
   * Get all contracts with pagination
   */
  static async getAllContracts(
    page: number = 1,
    limit: number = 20,
    status?: string,
    partyName?: string
  ): Promise<{ contracts: Contract[]; total: number }> {
    let query = db('contracts')
      .whereNull('deleted_at');
    
    if (status) {
      query = query.where('status', status);
    }
    
    if (partyName) {
      query = query.where('party_name', 'ilike', `%${partyName}%`);
    }
    
    const total = await query.clone().count('id as count').first();
    
    const contracts = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    return {
      contracts: contracts.map(contract => ({
        id: contract.id,
        contractNumber: contract.contract_number,
        partyName: contract.party_name,
        poNumber: contract.po_number,
        gatePassNumber: contract.gate_pass_number,
        startDate: contract.start_date,
        endDate: contract.end_date,
        collectionName: contract.collection_name,
        status: contract.status,
        createdBy: contract.created_by,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      })),
      total: parseInt(String(total?.count || '0')),
    };
  }
  
  /**
   * Get designs for a contract
   */
  static async getDesignsByContract(contractId: number): Promise<Design[]> {
    const designs = await db('designs')
      .join('contracts', 'designs.contract_id', 'contracts.id')
      .where('designs.contract_id', contractId)
      .whereNull('designs.deleted_at')
      .select(
        'designs.*',
        'contracts.contract_number',
        'contracts.party_name'
      )
      .orderBy('designs.design_number');
    
    return designs.map(design => ({
      id: design.id,
      contractId: design.contract_id,
      designNumber: design.design_number,
      component: design.component,
      repeatType: design.repeat_type,
      repeatValue: design.repeat_value,
      plannedQuantity: design.planned_quantity,
      plannedStitchCount: design.planned_stitch_count,
      status: design.status,
      createdAt: design.created_at,
      updatedAt: design.updated_at,
      contract: {
        id: design.contract_id,
        contractNumber: design.contract_number,
        partyName: design.party_name,
        startDate: new Date(),
        status: 'active' as const,
        createdBy: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }
  
  /**
   * Update contract status
   */
  static async updateContractStatus(
    contractId: number,
    status: 'active' | 'completed' | 'cancelled',
    userId: number
  ): Promise<void> {
    const oldContract = await db('contracts')
      .where('id', contractId)
      .first();
    
    if (!oldContract) {
      throw new Error('Contract not found');
    }
    
    await db('contracts')
      .where('id', contractId)
      .update({
        status,
        updated_at: new Date(),
      });
    
    // Log audit trail
    await logAudit(
      'contracts',
      contractId,
      'update',
      oldContract,
      { ...oldContract, status },
      userId
    );
  }
  
  /**
   * Update design status
   */
  static async updateDesignStatus(
    designId: number,
    status: 'pending' | 'in_progress' | 'completed',
    userId: number
  ): Promise<void> {
    const oldDesign = await db('designs')
      .where('id', designId)
      .first();
    
    if (!oldDesign) {
      throw new Error('Design not found');
    }
    
    await db('designs')
      .where('id', designId)
      .update({
        status,
        updated_at: new Date(),
      });
    
    // Log audit trail
    await logAudit(
      'designs',
      designId,
      'update',
      oldDesign,
      { ...oldDesign, status },
      userId
    );
  }
  
  /**
   * Search contracts and designs
   */
  static async searchContractsAndDesigns(searchTerm: string): Promise<{
    contracts: Contract[];
    designs: Design[];
  }> {
    const contracts = await db('contracts')
      .where(function() {
        this.where('contract_number', 'ilike', `%${searchTerm}%`)
          .orWhere('party_name', 'ilike', `%${searchTerm}%`)
          .orWhere('po_number', 'ilike', `%${searchTerm}%`);
      })
      .whereNull('deleted_at')
      .limit(10);
    
    const designs = await db('designs')
      .join('contracts', 'designs.contract_id', 'contracts.id')
      .where(function() {
        this.where('designs.design_number', 'ilike', `%${searchTerm}%`)
          .orWhere('designs.component', 'ilike', `%${searchTerm}%`)
          .orWhere('contracts.contract_number', 'ilike', `%${searchTerm}%`);
      })
      .whereNull('designs.deleted_at')
      .select(
        'designs.*',
        'contracts.contract_number',
        'contracts.party_name'
      )
      .limit(10);
    
    return {
      contracts: contracts.map(contract => ({
        id: contract.id,
        contractNumber: contract.contract_number,
        partyName: contract.party_name,
        poNumber: contract.po_number,
        gatePassNumber: contract.gate_pass_number,
        startDate: contract.start_date,
        endDate: contract.end_date,
        collectionName: contract.collection_name,
        status: contract.status,
        createdBy: contract.created_by,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      })),
      designs: designs.map(design => ({
        id: design.id,
        contractId: design.contract_id,
        designNumber: design.design_number,
        component: design.component,
        repeatType: design.repeat_type,
        repeatValue: design.repeat_value,
        plannedQuantity: design.planned_quantity,
        plannedStitchCount: design.planned_stitch_count,
        status: design.status,
        createdAt: design.created_at,
        updatedAt: design.updated_at,
        contract: {
          id: design.contract_id,
          contractNumber: design.contract_number,
          partyName: design.party_name,
          startDate: new Date(),
          status: 'active' as const,
          createdBy: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })),
    };
  }
}