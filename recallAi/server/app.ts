import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import { generateStudyPlan, sendError } from './generate.ts';

const app = express();

const parseJsonBody = express.json({ limit: '64kb' });
if (process.env.VERCEL) {
  app.use((_request, _response, next) => next());
} else {
  app.use(parseJsonBody);
}
app.get(['/api/health', '/health'], (_request, response) => {
  response.json({ status: 'ok' });
});
app.post(['/api/generate', '/generate'], generateStudyPlan);

const handleRequestError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (response.headersSent) return;
  if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
    sendError(response, 413, 'INPUT_TOO_LONG', 'Keep study material under 8,000 characters.');
  } else if (error instanceof SyntaxError) {
    sendError(response, 400, 'INVALID_INPUT', 'Send a valid JSON request body.');
  } else {
    sendError(response, 500, 'SERVER_ERROR', 'Something went wrong. Please try again.');
  }
};
app.use(handleRequestError);

app.use((request, response, next) => {
  if (request.path === '/api' || request.path.startsWith('/api/') || request.path === '/health' || request.path === '/generate') {
    sendError(response, 404, 'INVALID_INPUT', 'This API endpoint does not exist.');
    return;
  }
  next();
});

export default app;