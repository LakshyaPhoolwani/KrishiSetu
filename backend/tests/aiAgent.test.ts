import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { chatWithAgent, executeTool, registeredTools, systemPrompt } from '../src/services/aiAgent.js';

const { mockedGetAuth, mockedGenerateContent, mockedGoogleGenAI } = vi.hoisted(() => ({
  mockedGetAuth: vi.fn(),
  mockedGenerateContent: vi.fn(),
  mockedGoogleGenAI: vi.fn(),
}));
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_request: unknown, _response: unknown, next: () => void) => next(),
  getAuth: mockedGetAuth,
}));
vi.mock('@google/genai', () => ({ GoogleGenAI: mockedGoogleGenAI }));

import app from '../src/app.js';
import { prisma } from '../src/services/database.js';

const farmerContext = {
  clerkUserId: 'farmer-clerk',
  databaseUserId: 'cuserfarmer1234567890123456',
  role: 'FARMER' as const,
  status: 'ACTIVE' as const,
};

describe('AI agent safety boundaries', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'test-clerk-secret';
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    mockedGetAuth.mockReset();
    mockedGenerateContent.mockReset();
    mockedGoogleGenAI.mockReset();
    mockedGetAuth.mockReturnValue({ userId: 'farmer-clerk' });
    vi.restoreAllMocks();
    mockedGetAuth.mockReturnValue({ userId: 'farmer-clerk' });
    mockedGoogleGenAI.mockImplementation(() => ({ models: { generateContent: mockedGenerateContent } }));
  });

  it('requires authentication and handles missing Gemini configuration safely', async () => {
    mockedGetAuth.mockReturnValue({ userId: null });
    expect((await request(app).post('/api/ai/chat').send({ message: 'Show my lots' })).status).toBe(401);
    mockedGetAuth.mockReturnValue({ userId: 'farmer-clerk' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: farmerContext.databaseUserId, clerkUserId: 'farmer-clerk', role: 'FARMER', status: 'ACTIVE' } as never);
    const response = await request(app).post('/api/ai/chat').send({ message: 'Show my lots' });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_NOT_CONFIGURED');
  });

  it('validates chat requests and exposes only registered tools', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: farmerContext.databaseUserId, clerkUserId: 'farmer-clerk', role: 'FARMER', status: 'ACTIVE' } as never);
    const response = await request(app).post('/api/ai/chat').send({ message: '', userId: 'attacker' });
    expect(response.status).toBe(400);
    expect(registeredTools.map((tool) => tool.name)).toEqual([
      'get_farmer_lots',
      'get_market_prices',
      'get_buyer_matches',
      'calculate_net_realisation',
    ]);
    expect(systemPrompt).toContain('Never calculate money yourself');
  });

  it('rejects unknown tools and invalid arguments safely', async () => {
    expect(await executeTool('unknown_tool', '{}', farmerContext)).toEqual({ error: 'Unknown tool' });
    expect(await executeTool('get_farmer_lots', '{"page":0}', farmerContext)).toEqual({ error: 'Invalid arguments or farmer authorization required' });
    expect(await executeTool('get_farmer_lots', '{bad-json', farmerContext)).toEqual({ error: 'Tool arguments are not valid JSON' });
  });

  it('enforces farmer ownership in get_farmer_lots', async () => {
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue({ id: 'cfarmer1234567890123456789' } as never);
    vi.spyOn(prisma.lot, 'findMany').mockResolvedValue([{
      id: 'clot1234567890123456789012',
      lotCode: 'LOT-1',
      crop: { name: 'Wheat', variety: null },
      quantity: { toString: () => '10' },
      quantityUnit: 'QUINTAL',
      status: 'READY_FOR_MARKET',
      farm: { name: 'Farm', district: 'Bhopal', state: 'Madhya Pradesh' },
    }] as never);
    const result = await executeTool('get_farmer_lots', '{"limit":10}', farmerContext);
    expect(result).toMatchObject({ data: [{ id: 'clot1234567890123456789012', quantity: '10' }] });
    expect(vi.mocked(prisma.farmer).findUnique).toHaveBeenCalledWith({ where: { userId: farmerContext.databaseUserId }, select: { id: true } });
  });

  it('does not allow non-farmers to invoke farmer-only tools', async () => {
    const result = await executeTool('get_buyer_matches', '{"lotId":"clot1234567890123456789012"}', { ...farmerContext, role: 'BUYER' });
    expect(result).toEqual({ error: 'Invalid arguments or farmer authorization required' });
  });

  it('initializes Gemini with the backend key and completes a controlled tool round trip', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-test-model';
    vi.spyOn(prisma.farmer, 'findUnique').mockResolvedValue({ id: 'cfarmer1234567890123456789' } as never);
    vi.spyOn(prisma.lot, 'findMany').mockResolvedValue([] as never);
    mockedGenerateContent
      .mockResolvedValueOnce({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'get_farmer_lots', args: { limit: 1 }, id: 'call-1' } }] } }] })
      .mockResolvedValueOnce({ candidates: [{ content: { role: 'model', parts: [{ text: 'No lots found.' }] } }] });

    const result = await chatWithAgent('Show my lots', farmerContext);

    expect(result).toEqual({ message: 'No lots found.', toolCalls: ['get_farmer_lots'] });
    expect(mockedGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-gemini-key' });
    expect(mockedGenerateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      model: 'gemini-test-model',
      config: expect.objectContaining({ tools: [{ functionDeclarations: registeredTools }] }),
    }));
    expect(mockedGenerateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      contents: expect.arrayContaining([expect.objectContaining({
        parts: [{ functionResponse: { name: 'get_farmer_lots', id: 'call-1', response: { data: [] } } }],
      })]),
    }));
  });

  it('maps Gemini provider failures to the existing safe API error', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    mockedGenerateContent.mockRejectedValue(new Error('provider details must not leak'));
    mockedGetAuth.mockReturnValue({ userId: 'farmer-clerk' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: farmerContext.databaseUserId, clerkUserId: 'farmer-clerk', role: 'FARMER', status: 'ACTIVE' } as never);

    const response = await request(app).post('/api/ai/chat').send({ message: 'Show my lots' });

    expect(response.status).toBe(502);
    expect(response.body.error).toEqual({ code: 'AI_REQUEST_FAILED', message: 'AI assistant is temporarily unavailable' });
  });
});
