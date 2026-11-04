import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Application } from '../src/models/Application';
import { ApplicationAgent } from '../src/agents/applicationAgent';
import { TrackingAgent } from '../src/agents/trackingAgent';
import { JobService } from '../src/services/jobService';
import { SessionService } from '../src/services/sessionService';

describe('Application & Tracking Agent - Applications & Deduplication', () => {
  let mongoServer: MongoMemoryServer;
  const testSessionId = `sess_${'D'.repeat(43)}`;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    JobService.loadJobs();
    await SessionService.getOrCreateSession(testSessionId);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('1. should handle invalid job IDs gracefully', async () => {
    const res = await ApplicationAgent.initiateApplication(testSessionId, 'INVALID_JOB_9999999');
    expect(res.success).toBe(false);
    expect(res.message).toContain("couldn't identify which job");
  });

  it('2. should require confirmation before applying', async () => {
    const allJobs = JobService.getAllJobs();
    const targetJob = allJobs[0];

    const res = await ApplicationAgent.initiateApplication(testSessionId, targetJob.id);
    expect(res.success).toBe(true);
    expect(res.requiresConfirmation).toBe(true);
    expect(res.job?.id).toBe(targetJob.id);
    expect(res.message).toContain('Would you like to confirm your application');
  });

  it('3. should successfully record application upon confirmation', async () => {
    const allJobs = JobService.getAllJobs();
    const targetJob = allJobs[0];

    const confirmRes = await ApplicationAgent.confirmApplication(testSessionId, targetJob.id);
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.application).toBeDefined();
    expect(confirmRes.application?.jobId).toBe(targetJob.id);
    expect(confirmRes.message).toContain('successfully recorded');
  });

  it('4. should prevent duplicate applications for the same session and job', async () => {
    const allJobs = JobService.getAllJobs();
    const targetJob = allJobs[0];

    // Attempting to initiate again for the same job should report already applied
    const secondTry = await ApplicationAgent.initiateApplication(testSessionId, targetJob.id);
    expect(secondTry.success).toBe(false);
    expect(secondTry.message).toContain('You have already applied');

    // Attempting direct DB insertion should trigger duplicate key error (code 11000)
    await expect(
      new Application({
        sessionId: testSessionId,
        jobId: targetJob.id,
        jobTitle: targetJob.title,
        company: targetJob.company,
      }).save()
    ).rejects.toThrow();
  });

  it('5. should retrieve application history in TrackingAgent', async () => {
    const apps = await TrackingAgent.getApplications(testSessionId);
    expect(apps.length).toBe(1);
    expect(apps[0].jobId).toBe(JobService.getAllJobs()[0].id);

    const formatted = TrackingAgent.formatApplicationsMarkdown(apps);
    expect(formatted).toContain('Your Application History (1 total)');
    expect(formatted).toContain(apps[0].jobTitle);
  });

  it('6. should filter applications by company name or title keyword', async () => {
    const allJobs = JobService.getAllJobs();
    const firstJob = allJobs[0];

    const matches = await TrackingAgent.getApplications(testSessionId, { search: firstJob.company });
    expect(matches.length).toBe(1);

    const nonMatches = await TrackingAgent.getApplications(testSessionId, { search: 'NonExistentCompanyX99' });
    expect(nonMatches.length).toBe(0);
  });
});
