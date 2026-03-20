import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1beta',
    }),
  ],
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  enableTracingAndMetrics: process.env.NODE_ENV !== 'production',
});