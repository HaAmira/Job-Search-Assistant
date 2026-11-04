import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RawJobInput } from '../scraper/normalizeJobs';
import { scrapeAndCollectJobs, ScrapeSources } from '../scraper/scrapeJobs';

describe('scrapeAndCollectJobs data integrity', () => {
  let temporaryDirectory: string;
  let outputFile: string;

  const job = (index: number): RawJobInput => ({
    title: `Software Engineer ${index}`,
    company: `Company ${index}`,
    location: 'Remote',
    description: 'Build and maintain reliable software applications for our users.',
    tags: ['TypeScript'],
    url: `https://example.com/jobs/${index}`,
    source: 'Test source',
  });

  const sources = (arbeitnowJobs: RawJobInput[]): ScrapeSources => ({
    arbeitnow: vi.fn(async (target) => arbeitnowJobs.slice(0, target)),
    remotive: vi.fn(async () => []),
    jobicy: vi.fn(async () => []),
  });

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hidani-scraper-test-'));
    outputFile = path.join(temporaryDirectory, 'jobs.json');
    fs.writeFileSync(outputFile, '[{"previous":"valid catalog"}]', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('preserves the previous dataset when all sources return no jobs', async () => {
    const original = fs.readFileSync(outputFile, 'utf8');
    await expect(
      scrapeAndCollectJobs(2, { outputFile, sources: sources([]) })
    ).rejects.toThrow(/Insufficient valid source data/);
    expect(fs.readFileSync(outputFile, 'utf8')).toBe(original);
  });

  it('rejects invalid raw job records without replacing the catalog', async () => {
    const original = fs.readFileSync(outputFile, 'utf8');
    const invalidJobs = [{ ...job(1), title: ' ' }, job(2)];
    await expect(
      scrapeAndCollectJobs(2, { outputFile, sources: sources(invalidJobs) })
    ).rejects.toThrow(/no valid title/);
    expect(fs.readFileSync(outputFile, 'utf8')).toBe(original);
  });

  it('rejects fewer unique listings than targetCount without replacing the catalog', async () => {
    const original = fs.readFileSync(outputFile, 'utf8');
    const duplicateJobs = [job(1), { ...job(1), title: 'Software Engineer 1' }];
    await expect(
      scrapeAndCollectJobs(2, { outputFile, sources: sources(duplicateJobs) })
    ).rejects.toThrow(/requested 2 jobs, received 1/);
    expect(fs.readFileSync(outputFile, 'utf8')).toBe(original);
  });

  it('preserves the catalog when external sources fail', async () => {
    const original = fs.readFileSync(outputFile, 'utf8');
    const failedSources: ScrapeSources = {
      arbeitnow: vi.fn().mockRejectedValue(new Error('external request failed')),
      remotive: vi.fn().mockRejectedValue(new Error('external request failed')),
      jobicy: vi.fn().mockRejectedValue(new Error('external request failed')),
    };

    await expect(
      scrapeAndCollectJobs(2, { outputFile, sources: failedSources })
    ).rejects.toThrow(/Failed sources: Arbeitnow, Remotive, Jobicy/);
    expect(fs.readFileSync(outputFile, 'utf8')).toBe(original);
  });

  it('replaces the catalog only after the exact target dataset validates', async () => {
    const original = fs.readFileSync(outputFile, 'utf8');
    const source = sources([job(1), job(2), job(3)]);
    await scrapeAndCollectJobs(2, { outputFile, sources: source });

    const result = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(result).toHaveLength(2);
    expect(result.map((entry: { id: string }) => entry.id)).toEqual(['JOB0001', 'JOB0002']);
    expect(fs.readFileSync(outputFile, 'utf8')).not.toBe(original);
    expect(fs.readdirSync(temporaryDirectory).filter((name) => name.endsWith('.tmp'))).toHaveLength(0);
    expect(source.arbeitnow).toHaveBeenCalledWith(2);
  });
});
