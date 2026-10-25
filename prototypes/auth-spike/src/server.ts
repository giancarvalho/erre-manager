import { serve } from '@hono/node-server';
import { app } from './auth';

serve({ fetch: app.fetch, port: 3000 }, (info) => console.log(`auth spike on http://localhost:${info.port}`));
