import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Orchestrator } from '../src/agents/orchestrator';
import { JobMatchingAgent } from '../src/agents/jobMatchingAgent';
import { JobService } from '../src/services/jobService';
import { SessionService } from '../src/services/sessionService';

describe('Orchestrator - Multi-Agent Tool Selection & Intent Routing', () => {
  let mongoServer: MongoMemoryServer;
  const sessionId = `sess_${'E'.repeat(43)}`;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    JobService.loadJobs();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('1. should detect GREETING intent', async () => {
    const res = await Orchestrator.processMessage(sessionId, 'Hello! How are you?');
    expect(res.intent).toBe('GREETING');
    expect(res.message).toContain('AI Job Assistant');
  });

  it('2. should detect UPLOAD_RESUME intent', async () => {
    const res = await Orchestrator.processMessage(sessionId, 'How can I upload resume?');
    expect(res.intent).toBe('UPLOAD_RESUME');
    expect(res.message).toContain('Upload Resume');
  });

  it('3. should detect ANALYZE_RESUME intent when no resume is present', async () => {
    const res = await Orchestrator.processMessage(sessionId, 'Show my resume profile');
    expect(res.intent).toBe('ANALYZE_RESUME');
    expect(res.message).toContain('No resume has been uploaded yet');
  });

  it('4. should detect FIND_JOBS and return recommendations', async () => {
    const res = await Orchestrator.processMessage(sessionId, 'Find jobs for me');
    expect(res.intent).toBe('FIND_JOBS');
    expect(res.jobs).toBeDefined();
    expect(res.jobs?.length).toBeGreaterThan(0);
  });

  it('5. should detect FILTER_JOBS with natural language constraints', async () => {
    const res = await Orchestrator.processMessage(sessionId, 'Show only remote jobs');
    expect(['FIND_JOBS', 'FILTER_JOBS']).toContain(res.intent);
    expect(res.filters?.remoteOnly).toBe(true);
  });

  it('6. should detect VIEW_JOB intent and retrieve job details', async () => {
    const firstJob = JobService.getAllJobs()[0];
    const res = await Orchestrator.processMessage(sessionId, `view job ${firstJob.id}`);
    expect(res.intent).toBe('VIEW_JOB');
    expect(res.message).toContain(firstJob.title);
    expect(res.message).toContain(firstJob.company);
  });

  it('7. should initiate application and ask for user confirmation', async () => {
    const firstJob = JobService.getAllJobs()[0];
    const res = await Orchestrator.processMessage(sessionId, `apply to ${firstJob.id}`);
    expect(res.intent).toBe('APPLY_JOB');
    expect(res.requiresConfirmation).toBe(true);
    expect(res.message).toContain('confirm your application');
  });

  it('8. should finalize application when user confirms with "yes"', async () => {
    const res = await Orchestrator.processMessage(sessionId, 'yes');
    expect(res.intent).toBe('APPLY_JOB');
    expect(res.message).toContain('successfully recorded');
  });

  it('9. should display applied jobs with VIEW_APPLICATIONS intent', async () => {
    const res = await Orchestrator.processMessage(sessionId, 'show my applied jobs');
    expect(res.intent).toBe('VIEW_APPLICATIONS');
    expect(res.message).toContain('Your Application History');
  });

  it('10. should persist full conversation history in session', async () => {
    const session = await SessionService.getOrCreateSession(sessionId);
    expect(session.conversationHistory.length).toBeGreaterThan(8);
  });

  it('11. should replace prior filters, clear all filters, then apply remote-only', async () => {
    const delhiSearch = await Orchestrator.processMessage(sessionId, 'Show jobs in Delhi');
    expect(delhiSearch.filters?.location).toBe('Delhi');
    expect(delhiSearch.jobs).toHaveLength(0);

    const skillsSearch = await Orchestrator.processMessage(
      sessionId,
      'Find React and Node.js developer roles'
    );
    expect(skillsSearch.filters?.location).toBeUndefined();
    expect(skillsSearch.filters?.skills).toEqual(['React', 'Node.js']);
    expect(skillsSearch.jobs?.length).toBeGreaterThan(0);
    expect(skillsSearch.jobs?.every((result) => {
      const skills = result.job.skills.map((skill) => JobMatchingAgent.normalizeSkill(skill));
      return skills.includes('react') && skills.includes('node.js');
    })).toBe(true);

    const allJobs = await Orchestrator.processMessage(sessionId, 'Show all jobs');
    expect(allJobs.filters?.location).toBeUndefined();
    expect(allJobs.filters?.skills || []).toHaveLength(0);
    expect(allJobs.jobs?.length).toBeGreaterThan(0);

    const remoteJobs = await Orchestrator.processMessage(sessionId, 'Show remote jobs');
    expect(remoteJobs.filters?.remoteOnly).toBe(true);
    expect(remoteJobs.filters?.location).toBeUndefined();
    expect(remoteJobs.jobs?.length).toBeGreaterThan(0);
    expect(remoteJobs.jobs?.every((result) =>
      result.job.location.toLowerCase().includes('remote') ||
      result.job.title.toLowerCase().includes('remote')
    )).toBe(true);
  });

  it('12. should recognize clear-all and developer-role searches deterministically', () => {
    expect(Orchestrator.fallbackDetectIntent('Show all jobs').intent).toBe('FIND_JOBS');
    expect(['FIND_JOBS', 'FILTER_JOBS']).toContain(
      Orchestrator.fallbackDetectIntent('Find React and Node.js developer roles').intent
    );
  });

  it('extracts city variants and preserves accompanying skill filters', () => {
    for (const city of ['Bangalore', 'Bengaluru', 'Delhi', 'Gurgaon', 'Noida']) {
      const { params } = Orchestrator.fallbackDetectIntent(`Show jobs in ${city}`);
      expect(params.location).toBe(city);
    }

    const { params } = Orchestrator.fallbackDetectIntent('Show React jobs in Bangalore');
    expect(params.location).toBe('Bangalore');
    expect(params.skills).toEqual(['React']);
  });

  it('13. should preserve full job IDs for chat application requests', () => {
    const { intent, params } = Orchestrator.fallbackDetectIntent('Apply to JOB0403');
    expect(intent).toBe('APPLY_JOB');
    expect(JobService.getJobById(params.jobId)?.id).toBe('JOB0403');
  });
});
