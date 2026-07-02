import { getSql } from '../src/core/db/index.js';
import { runScrapingSession } from '../src/modules/scraping/engine/session.js';

const sql = getSql();
const WORKER_ID = 'home-pc';

async function updateHeartbeat() {
    await sql`
        INSERT INTO local_workers (id, heartbeat_at, status, updated_at)
        VALUES (${WORKER_ID}, NOW(), 'idle', NOW())
        ON CONFLICT (id) DO UPDATE 
        SET heartbeat_at = NOW(),
            updated_at = NOW();
    `;
}

async function checkJob(): Promise<number | null> {
    const rows = await sql`
        SELECT current_job FROM local_workers 
        WHERE id = ${WORKER_ID} AND current_job IS NOT NULL
    `;
    return rows.length > 0 ? rows[0].current_job : null;
}

async function clearJobAndSetStatus(status: string) {
    await sql`
        UPDATE local_workers 
        SET current_job = NULL, status = ${status}, updated_at = NOW()
        WHERE id = ${WORKER_ID}
    `;
}

async function setStatus(status: string) {
    await sql`
        UPDATE local_workers 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${WORKER_ID}
    `;
}

async function startWorker() {
    console.log(`🚀 Local PC Worker [${WORKER_ID}] started!`);
    console.log('📡 Waiting for scraping jobs from the Admin Dashboard...');

    // Initial heartbeat
    await updateHeartbeat();

    while (true) {
        try {
            // Send heartbeat every 5 seconds
            await updateHeartbeat();

            // Check if there is a job queued
            const jobId = await checkJob();
            if (jobId) {
                console.log(`\n===========================================`);
                console.log(`⚡ JOB RECEIVED: Scraping retailer ID ${jobId}...`);
                console.log(`===========================================`);
                
                await clearJobAndSetStatus('scraping');
                
                try {
                    await runScrapingSession(jobId);
                    console.log('✅ Local scraping job completed successfully.');
                } catch (err: any) {
                    console.error('❌ Local scraping job failed:', err.message);
                } finally {
                    await setStatus('idle');
                    console.log('📡 Back to waiting for jobs...');
                }
            }
        } catch (err) {
            console.error('⚠️ Worker loop error (will retry):', err);
        }

        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down local worker...');
    try {
        await setStatus('offline');
    } catch {}
    process.exit(0);
});

startWorker();
