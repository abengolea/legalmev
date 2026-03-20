import { config } from 'dotenv';
config();

import '@/ai/flows/client-intake-automation.ts';
import '@/ai/flows/generate-legal-draft.ts';
import '@/ai/flows/ai-case-analysis.ts';
import '@/ai/flows/monitor-mev-flow.ts';
import '@/ai/flows/scba-summarize-flow.ts';
