
import { ContractService } from '../services/ContractService';
import { db } from '../database/connection';

async function syncAllContracts() {
    try {
        console.log('--- Starting Contract Progress Sync ---');

        // Get all contract IDs (Active only or All? Let's do All just in case)
        const contracts = await db('Contract').select('ContractID', 'ContractNo');

        console.log(`Found ${contracts.length} contracts to sync.`);

        for (const contract of contracts) {
            console.log(`Syncing Contract #${contract.ContractNo} (ID: ${contract.ContractID})...`);
            await ContractService.updateContractProgress(contract.ContractID);
        }

        console.log('--- Sync Completed Successfully ---');
    } catch (err) {
        console.error('Sync Failed:', err);
    } finally {
        await db.destroy();
    }
}

syncAllContracts();
