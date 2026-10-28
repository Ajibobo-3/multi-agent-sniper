import { telemetryServer } from './server/telemetryServer.js';
import { paperEngine } from './agents/execution/paperExecutor.js';
import axios from 'axios';
import { CONFIG } from './config/index.js';

async function testTelemetry() {
  console.log('Testing Telemetry Server Integration...');
  await telemetryServer.start();

  try {
    const url = `http://localhost:${CONFIG.TELEMETRY.PORT}/api/telemetry`;
    console.log(`Pinging ${url} with Bearer token...`);

    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CONFIG.TELEMETRY.BEARER_TOKEN}`,
      },
    });

    console.log('✅ Response Status:', res.status);
    console.log('✅ KPIs:', res.data.kpis);
    console.log('✅ Engine Status:', res.data.engineStatus);
    console.log('✅ Active Positions:', res.data.activePositions.length);
    console.log('✅ Ledger Entries:', res.data.ledger.length);
  } catch (err: any) {
    console.error('❌ Telemetry fetch failed:', err.response?.data || err.message);
  } finally {
    await telemetryServer.stop();
  }
}

testTelemetry();
