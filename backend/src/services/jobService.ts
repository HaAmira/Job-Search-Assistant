import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface IJob {
  id: string;
  title: string;
  company: string;
  location: string;
  experience_required: string;
  skills: string[];
  description: string;
  source: string;
  source_link: string;
  employment_type: string;
}

export class JobService {
  private static jobsCache: IJob[] = [];
  private static jobsById: Map<string, IJob> = new Map();
  private static isInitialized = false;

  private static dataPath =
    [
      path.resolve(__dirname, '../../data/jobs.json'),
      path.resolve(__dirname, '../../../data/jobs.json'),
    ].find((candidate) => fs.existsSync(candidate)) ||
    path.resolve(__dirname, '../../data/jobs.json');

  /**
   * Load jobs from jobs.json into memory cache
   */
  public static loadJobs(): IJob[] {
    if (this.isInitialized && this.jobsCache.length > 0) {
      return this.jobsCache;
    }

    try {
      if (!fs.existsSync(this.dataPath)) {
        logger.warn(`Jobs file not found at ${this.dataPath}. Returning empty set.`);
        return [];
      }

      const raw = fs.readFileSync(this.dataPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.jobsCache = parsed;
        this.jobsById.clear();
        for (const job of this.jobsCache) {
          this.jobsById.set(job.id, job);
          // Also allow lookup by clean number e.g. "1" for "JOB0001"
          const numMatch = job.id.match(/\d+/);
          if (numMatch) {
            const intVal = parseInt(numMatch[0], 10).toString();
            if (!this.jobsById.has(intVal)) {
              this.jobsById.set(intVal, job);
            }
          }
        }
        this.isInitialized = true;
        logger.info(`Loaded ${this.jobsCache.length} jobs into memory cache.`);
      }
    } catch (err: any) {
      logger.error('Error loading jobs.json:', err);
    }

    return this.jobsCache;
  }


  public static reloadJobs(): IJob[] {
    this.isInitialized = false;
    return this.loadJobs();
  }

  public static getAllJobs(): IJob[] {
    if (!this.isInitialized) {
      this.loadJobs();
    }
    return this.jobsCache;
  }

  public static getJobById(id: string): IJob | undefined {
    if (!this.isInitialized) {
      this.loadJobs();
    }
    const cleanId = id.trim().toUpperCase();
    return this.jobsById.get(cleanId) || this.jobsById.get(id.trim());
  }

  public static count(): number {
    if (!this.isInitialized) {
      this.loadJobs();
    }
    return this.jobsCache.length;
  }
}
