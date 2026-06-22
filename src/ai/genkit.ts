import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {GENKIT_GEMINI_MODEL} from '@/lib/gemini-model';

export const ai = genkit({
  plugins: [googleAI()],
  model: GENKIT_GEMINI_MODEL,
});
