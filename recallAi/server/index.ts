import express from 'express';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.ts';
import { sendError } from './generate.ts';

const distDirectory = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
app.use(express.static(distDirectory));
app.use((request, response) => {
  if (request.path === '/api' || request.path.startsWith('/api/')) {
    sendError(response, 404, 'INVALID_INPUT', 'This API endpoint does not exist.');
    return;
  }
  response.sendFile(join(distDirectory, 'index.html'));
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`RecallAI server listening on http://localhost:${port}`);
});
