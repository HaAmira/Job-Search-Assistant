import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { JobService } from '../src/services/jobService';
import { createMockPdfBuffer } from './testHelpers';

describe('API Endpoints - Integration & Error Handling', () => {
  let mongoServer: MongoMemoryServer;
  const sessionId = `sess_${'A'.repeat(43)}`;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    JobService.loadJobs();
  });

  it('rejects malformed, conflicting, and selector-shaped bearer IDs', async () => {
    const malformed = await request(app)
      .post('/api/chat')
      .set('x-session-id', 'not-a-secure-session-token')
      .send({ message: 'Hello' });
    expect(malformed.status).toBe(400);

    const conflicting = await request(app)
      .post('/api/chat')
      .set('x-session-id', sessionId)
      .send({ sessionId: `sess_${'C'.repeat(43)}`, message: 'Hello' });
    expect(conflicting.status).toBe(403);

    const resumeConflict = await request(app)
      .get(`/api/resume?sessionId=sess_${'C'.repeat(43)}`)
      .set('x-session-id', sessionId);
    expect(resumeConflict.status).toBe(403);

    const applicationConflict = await request(app)
      .get(`/api/applications?sessionId=sess_${'C'.repeat(43)}`)
      .set('x-session-id', sessionId);
    expect(applicationConflict.status).toBe(403);

    const selector = await request(app)
      .get('/api/session?sessionId%5B%24ne%5D=anything')
      .set('x-session-id', sessionId);
    expect(selector.status).toBe(400);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('1. GET /health should return 200 with job count', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.jobsLoaded).toBeGreaterThan(1500);
  });

  it('2. POST /api/chat should reject missing sessionId', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('3. POST /api/chat should accept message and return orchestrator response', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('x-session-id', sessionId)
      .send({ message: 'Hello assistant' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBeDefined();
  });

  it('4. GET /api/jobs should return paginated jobs list', async () => {
    const res = await request(app)
      .get('/api/jobs?page=1&limit=5')
      .set('x-session-id', sessionId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(5);
    expect(res.body.pagination.total).toBeGreaterThan(1500);
  });

  it('5. GET /api/jobs/:jobId should return job details or 404', async () => {
    const validJob = JobService.getAllJobs()[0];
    const resValid = await request(app).get(`/api/jobs/${validJob.id}`);
    expect(resValid.status).toBe(200);
    expect(resValid.body.data.id).toBe(validJob.id);

    const resInvalid = await request(app).get('/api/jobs/NON_EXISTENT_99999');
    expect(resInvalid.status).toBe(404);
  });

  it('6. POST /api/resume/upload should parse valid PDF file', async () => {
    const pdfBuffer = createMockPdfBuffer('Devon Developer devon@example.com Software Engineer React Node.js');
    const resumeSessionId = `sess_${'B'.repeat(43)}`;
    const res = await request(app)
      .post('/api/resume/upload')
      .set('x-session-id', resumeSessionId)
      .attach('resume', pdfBuffer, 'resume.pdf');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.skills).toBeDefined();

    const sessionRes = await request(app)
      .get('/api/session')
      .set('x-session-id', resumeSessionId);
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.data.resumeData.skills).toContain('React');
    expect(sessionRes.body.data.conversationHistory).toHaveLength(1);

    const greetingRes = await request(app)
      .post('/api/chat')
      .set('x-session-id', resumeSessionId)
      .send({ message: 'Hello assistant' });
    expect(greetingRes.status).toBe(200);
    expect(greetingRes.body.data.message).toContain('profile active');
  });

  it('7. POST /api/resume/upload should reject unsupported file formats', async () => {
    const res = await request(app)
      .post('/api/resume/upload')
      .set('x-session-id', sessionId)
      .attach('resume', Buffer.from('image content'), 'photo.jpg');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('8. POST /api/applications and GET /api/applications flow', async () => {
    const testJob = JobService.getAllJobs()[1];

    // Direct confirmation apply
    const applyRes = await request(app)
      .post('/api/applications')
      .set('x-session-id', sessionId)
      .send({ jobId: testJob.id, confirm: true });

    expect(applyRes.status).toBe(201);
    expect(applyRes.body.success).toBe(true);

    // Duplicate prevention check
    const dupRes = await request(app)
      .post('/api/applications')
      .set('x-session-id', sessionId)
      .send({ jobId: testJob.id, confirm: true });

    expect(dupRes.status).toBe(409);

    // Retrieve application list
    const getRes = await request(app)
      .get('/api/applications')
      .set('x-session-id', sessionId);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
