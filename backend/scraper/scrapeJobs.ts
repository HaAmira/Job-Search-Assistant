import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { RawJobInput, normalizeJob, NormalizedJob } from './normalizeJobs';
import { validateJobDataset } from './validateJobs';

const OUTPUT_FILE = path.resolve(__dirname, '../data/jobs.json');
const TARGET_JOB_COUNT = 1650;

interface ArbeitnowItem {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

interface RemotiveItem {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  description: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const axiosInstance = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (JobScraperAssessment/1.0)',
    Accept: 'application/json, text/plain, */*',
  },
});

/**
 * Fetch jobs from Arbeitnow public job board API with pagination
 */
async function fetchArbeitnowJobs(target: number): Promise<RawJobInput[]> {
  const jobs: RawJobInput[] = [];
  let page = 1;
  const maxPages = 20;

  console.log(`[Scraper:Arbeitnow] Fetching tech jobs...`);

  while (jobs.length < target && page <= maxPages) {
    try {
      console.log(`[Scraper:Arbeitnow] Requesting page ${page}...`);
      const response = await axiosInstance.get(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
      
      if (!response.data || !Array.isArray(response.data.data)) {
        console.warn(`[Scraper:Arbeitnow] No data returned for page ${page}`);
        break;
      }

      const items: ArbeitnowItem[] = response.data.data;
      if (items.length === 0) break;

      for (const item of items) {
        jobs.push({
          title: item.title,
          company: item.company_name,
          location: item.location || (item.remote ? 'Remote' : 'Europe / Global'),
          description: item.description,
          tags: item.tags || [],
          url: item.url,
          job_type: item.job_types?.[0] || 'Full-time',
          source: 'Arbeitnow Jobs',
          remote: item.remote,
        });
      }

      console.log(`[Scraper:Arbeitnow] Total collected: ${jobs.length}`);

      if (!response.data.links?.next) {
        break;
      }

      page++;
      await sleep(600); // Polite rate limit
    } catch (err: any) {
      console.error(`[Scraper:Arbeitnow] Error on page ${page}: ${err.message}`);
      throw new Error('Arbeitnow source request failed');
    }
  }

  return jobs;
}

/**
 * Fetch jobs from Remotive public API
 */
async function fetchRemotiveJobs(target: number): Promise<RawJobInput[]> {
  const jobs: RawJobInput[] = [];
  console.log(`[Scraper:Remotive] Fetching remote tech jobs...`);

  try {
    const categories = ['software-dev', 'devops-sysadmin', 'data', 'qa'];
    for (const cat of categories) {
      if (jobs.length >= target) break;
      console.log(`[Scraper:Remotive] Requesting category: ${cat}...`);
      const limit = Math.min(400, target - jobs.length);
      const response = await axiosInstance.get(`https://remotive.com/api/remote-jobs?category=${cat}&limit=${limit}`);
      if (response.data && Array.isArray(response.data.jobs)) {
        const items: RemotiveItem[] = response.data.jobs;
        for (const item of items) {
          if (jobs.length >= target) break;
          jobs.push({
            title: item.title,
            company: item.company_name,
            location: item.candidate_required_location || 'Remote',
            description: item.description,
            tags: item.tags || [],
            url: item.url,
            job_type: item.job_type || 'Full-time',
            source: 'Remotive API',
            remote: true,
          });
        }
        console.log(`[Scraper:Remotive] Category ${cat} returned ${items.length} jobs. Running total: ${jobs.length}`);
      }
      await sleep(800);
    }
  } catch (err: any) {
    console.error(`[Scraper:Remotive] Error fetching Remotive jobs: ${err.message}`);
    throw new Error('Remotive source request failed');
  }

  return jobs;
}

/**
 * Fetch jobs from Jobicy public API
 */
async function fetchJobicyJobs(target: number): Promise<RawJobInput[]> {
  const jobs: RawJobInput[] = [];
  console.log(`[Scraper:Jobicy] Fetching remote engineering jobs...`);

  try {
    const count = Math.min(50, target);
    const response = await axiosInstance.get(`https://jobicy.com/api/v2/remote-jobs?count=${count}&industry=engineering`);
    if (response.data && Array.isArray(response.data.jobs)) {
      for (const item of response.data.jobs) {
        if (jobs.length >= target) break;
        jobs.push({
          title: item.jobTitle,
          company: item.companyName,
          location: item.jobGeo || 'Remote',
          description: item.jobDescription,
          tags: item.jobIndustry ? [item.jobIndustry] : [],
          url: item.url,
          job_type: item.jobType?.[0] || 'Full-time',
          source: 'Jobicy API',
          remote: true,
        });
      }
      console.log(`[Scraper:Jobicy] Total collected: ${jobs.length}`);
    }
  } catch (err: any) {
    console.warn(`[Scraper:Jobicy] Warning fetching Jobicy jobs: ${err.message}`);
    throw new Error('Jobicy source request failed');
  }

  return jobs;
}

export interface ScrapeSources {
  arbeitnow: (target: number) => Promise<RawJobInput[]>;
  remotive: (target: number) => Promise<RawJobInput[]>;
  jobicy: (target: number) => Promise<RawJobInput[]>;
}

export interface ScrapeOptions {
  outputFile?: string;
  sources?: ScrapeSources;
}

const defaultSources: ScrapeSources = {
  arbeitnow: fetchArbeitnowJobs,
  remotive: fetchRemotiveJobs,
  jobicy: fetchJobicyJobs,
};

function uniqueJobs(jobs: RawJobInput[]): RawJobInput[] {
  const unique: RawJobInput[] = [];
  const seenKeys = new Set<string>();

  for (const raw of jobs) {
    const key = `${String(raw.title || '').toLowerCase().trim()}|${String(raw.company || '').toLowerCase().trim()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      unique.push(raw);
    }
  }
  return unique;
}

function validateRawJob(job: RawJobInput, index: number): void {
  if (typeof job.title !== 'string' || !job.title.trim()) {
    throw new Error(`Scraped job at index ${index} has no valid title`);
  }
  if (typeof job.company !== 'string' || !job.company.trim()) {
    throw new Error(`Scraped job at index ${index} has no valid company`);
  }
}

/**
 * Collect, validate, and atomically replace the catalog only with a complete dataset.
 */
export async function scrapeAndCollectJobs(
  targetCount = TARGET_JOB_COUNT,
  options: ScrapeOptions = {}
): Promise<void> {
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 2000) {
    throw new Error('targetCount must be an integer between 1 and 2000');
  }

  const outputFile = options.outputFile || OUTPUT_FILE;
  const sources = options.sources || defaultSources;
  console.log(`\n======================================================`);
  console.log(`STARTING JOB SCRAPING PIPELINE: TARGET = ${targetCount}`);
  console.log(`======================================================\n`);

  const rawJobs: RawJobInput[] = [];
  const sourceFailures: string[] = [];

  try {
    rawJobs.push(...await sources.arbeitnow(targetCount));
  } catch {
    sourceFailures.push('Arbeitnow');
  }

  let candidates = uniqueJobs(rawJobs);
  if (candidates.length < targetCount) {
    try {
      rawJobs.push(...await sources.remotive(targetCount - candidates.length));
    } catch {
      sourceFailures.push('Remotive');
    }
    candidates = uniqueJobs(rawJobs);
  }

  if (candidates.length < targetCount) {
    try {
      rawJobs.push(...await sources.jobicy(targetCount - candidates.length));
    } catch {
      sourceFailures.push('Jobicy');
    }
    candidates = uniqueJobs(rawJobs);
  }

  console.log(`\nTotal raw listings collected across all permitted sources: ${rawJobs.length}`);
  console.log(`Unique listings after deduplication: ${candidates.length}`);

  if (candidates.length < targetCount) {
    const failedSources = sourceFailures.length
      ? ` Failed sources: ${sourceFailures.join(', ')}.`
      : '';
    throw new Error(
      `Insufficient valid source data: requested ${targetCount} jobs, received ${candidates.length}.${failedSources}`
    );
  }

  const selectedJobs = candidates.slice(0, targetCount);
  selectedJobs.forEach(validateRawJob);
  const normalizedJobs: NormalizedJob[] = selectedJobs.map((job, index) => normalizeJob(job, index));

  const outputDirectory = path.dirname(outputFile);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const temporaryFile = path.join(outputDirectory, `.jobs-${randomUUID()}.tmp`);

  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(normalizedJobs, null, 2), {
      encoding: 'utf-8',
      flag: 'wx',
    });

    const validation = validateJobDataset(temporaryFile, targetCount);
    if (!validation.isValid || validation.totalJobs !== targetCount) {
      throw new Error(`Scraped dataset validation failed: ${validation.errors.join('; ')}`);
    }

    fs.renameSync(temporaryFile, outputFile);
    console.log(`Successfully replaced ${outputFile} with ${validation.totalJobs} validated jobs.`);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

// Run CLI
if (require.main === module) {
  scrapeAndCollectJobs()
    .then(() => console.log('Scraping pipeline completed successfully.'))
    .catch((err) => {
      console.error('Scraping pipeline failed:', err.message);
      process.exitCode = 1;
    });
}
