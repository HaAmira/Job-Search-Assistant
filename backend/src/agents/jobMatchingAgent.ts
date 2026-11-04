import { IJob, JobService } from '../services/jobService';
import { IResumeData, IJobFilter } from '../models/UserSession';
import { logger } from '../utils/logger';

export interface IMatchResult {
  job: IJob;
  matchPercentage: number;
  matchingSkills: string[];
  missingSkills: string[];
  matchReason: string;
}

export class JobMatchingAgent {
  private static normalizeLocationText(location: string): string {
    const normalized = location
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    return normalized
      .replace(/\bnew delhi\b/g, 'delhi')
      .replace(/\bbangalore\b/g, 'bengaluru')
      .replace(/\bgurgaon\b/g, 'gurugram');
  }

  /**
   * Normalize a requested city, including common spelling variants and city/state input.
   */
  public static normalizeCityName(city: string): string {
    return this.normalizeLocationText(city.split(',')[0]);
  }

  /**
   * Match a city as a complete phrase in a location string, not as a substring.
   */
  public static matchesLocation(city: string, location: string): boolean {
    const normalizedCity = this.normalizeCityName(city);
    if (!normalizedCity) return false;

    const normalizedLocation = this.normalizeLocationText(location);
    const escapedCity = normalizedCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escapedCity}(?:\\s|$)`).test(normalizedLocation);
  }

  /**
   * Normalize skill strings to handle variations like "React.js" vs "React"
   */
  public static normalizeSkill(skill: string): string {
    const s = skill.toLowerCase().trim();
    if (['react', 'react.js', 'reactjs'].includes(s)) return 'react';
    if (['node', 'node.js', 'nodejs', 'node js'].includes(s)) return 'node.js';
    if (['express', 'express.js', 'expressjs'].includes(s)) return 'express';
    if (['mongo', 'mongodb'].includes(s)) return 'mongodb';
    if (['typescript', 'ts'].includes(s)) return 'typescript';
    if (['javascript', 'js'].includes(s)) return 'javascript';
    if (['python', 'py'].includes(s)) return 'python';
    if (['docker', 'containers'].includes(s)) return 'docker';
    if (['k8s', 'kubernetes'].includes(s)) return 'kubernetes';
    if (['aws', 'amazon web services'].includes(s)) return 'aws';
    if (['gcp', 'google cloud', 'google cloud platform'].includes(s)) return 'gcp';
    if (['tailwind', 'tailwindcss'].includes(s)) return 'tailwind css';
    if (['html5'].includes(s)) return 'html';
    if (['css3'].includes(s)) return 'css';
    if (['next', 'next.js', 'nextjs'].includes(s)) return 'next.js';
    if (['vue', 'vue.js', 'vuejs'].includes(s)) return 'vue.js';
    return s;
  }

  /**
   * Parse numerical years from experience string (e.g., "0-2 years", "3+ years", "Fresher")
   */
  public static parseExperienceRequired(expStr: string): { min: number; max: number } {
    const s = expStr.toLowerCase();
    if (s.includes('fresher') || s.includes('intern') || s.includes('entry') || s.includes('0-1')) {
      return { min: 0, max: 1 };
    }
    const rangeMatch = s.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      return { min: parseInt(rangeMatch[1], 10), max: parseInt(rangeMatch[2], 10) };
    }
    const plusMatch = s.match(/(\d+)\s*\+/);
    if (plusMatch) {
      const min = parseInt(plusMatch[1], 10);
      return { min, max: min + 3 };
    }
    return { min: 0, max: 5 };
  }

  /**
   * Deterministic match score calculation
   */
  public static calculateMatch(candidate: IResumeData, job: IJob): IMatchResult {
    const candidateNormSkills = new Set(candidate.skills.map((s) => this.normalizeSkill(s)));
    
    // Also include skills mentioned in designation or rawText if available
    if (candidate.designation) {
      for (const token of candidate.designation.split(/[\s/,-]+/)) {
        if (token.length > 2) candidateNormSkills.add(this.normalizeSkill(token));
      }
    }

    const jobSkills = job.skills || [];
    const matchingSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const jobSkill of jobSkills) {
      const norm = this.normalizeSkill(jobSkill);
      if (candidateNormSkills.has(norm)) {
        matchingSkills.push(jobSkill);
      } else {
        missingSkills.push(jobSkill);
      }
    }

    // 1. Skill Score (0 - 100)
    let skillScore = 0;
    if (jobSkills.length > 0) {
      skillScore = (matchingSkills.length / jobSkills.length) * 100;
    } else {
      skillScore = 70; // neutral score if job has no explicit skills listed
    }

    // 2. Experience Score (0 - 100)
    const { min: minExp, max: maxExp } = this.parseExperienceRequired(job.experience_required);
    const candidateExp = candidate.yearsOfExperience || 0;
    let expScore = 100;

    if (candidateExp < minExp) {
      const diff = minExp - candidateExp;
      expScore = Math.max(20, 100 - diff * 25);
    } else if (candidateExp > maxExp + 4) {
      // over-qualified
      expScore = 80;
    }

    // 3. Designation / Title alignment (0 - 100)
    let titleScore = 50;
    if (candidate.designation && job.title) {
      const cWords = candidate.designation.toLowerCase().split(/\s+/);
      const jWords = job.title.toLowerCase().split(/\s+/);
      const common = cWords.filter((w) => w.length > 2 && jWords.includes(w));
      if (common.length > 0) {
        titleScore = Math.min(100, 50 + common.length * 25);
      }
    }

    // Deterministic composite weighted formula
    const compositeScore = Math.round(0.60 * skillScore + 0.25 * expScore + 0.15 * titleScore);
    const matchPercentage = Math.min(99, Math.max(10, compositeScore));

    // Construct deterministic match explanation
    let matchReason = '';
    if (matchingSkills.length > 0) {
      matchReason += `Matches ${matchingSkills.length}/${jobSkills.length} required skills: ${matchingSkills.slice(0, 4).join(', ')}. `;
    } else {
      matchReason += `General alignment based on candidate background and experience profile. `;
    }

    if (candidateExp >= minExp && candidateExp <= maxExp) {
      matchReason += `Your ${candidateExp} years of experience fits the requested ${job.experience_required}.`;
    } else if (candidateExp < minExp) {
      matchReason += `Requires ${job.experience_required} (you currently have ~${candidateExp} yr).`;
    } else {
      matchReason += `Your experience meets the ${job.experience_required} target.`;
    }

    return {
      job,
      matchPercentage,
      matchingSkills,
      missingSkills,
      matchReason,
    };
  }

  /**
   * Filter and rank jobs against candidate profile and active filters
   */
  public static recommendJobs(
    candidate: IResumeData,
    filters: IJobFilter = {},
    limit = 10
  ): IMatchResult[] {
    const allJobs = JobService.getAllJobs();
    if (!allJobs || allJobs.length === 0) {
      return [];
    }

    const extractedCity = filters.location;
    const locationFiltered = extractedCity
      ? allJobs.filter((job) => this.matchesLocation(extractedCity, job.location))
      : allJobs;

    logger.debug('Job search location filter', {
      extractedCity: extractedCity || null,
      normalizedCity: extractedCity ? this.normalizeCityName(extractedCity) : null,
      totalJobsLoaded: allJobs.length,
      jobsMatchingLocation: locationFiltered.length,
    });

    // Apply the other explicit filters after location matching.
    const filtered = locationFiltered.filter((job) => {
      // 1. Remote filter
      if (filters.remoteOnly) {
        const loc = job.location.toLowerCase();
        if (!loc.includes('remote') && !job.title.toLowerCase().includes('remote')) {
          return false;
        }
      }

      // 2. Role / Title filter
      if (filters.role) {
        const targetRole = filters.role.toLowerCase().trim();
        const jobTitle = job.title.toLowerCase();
        if (!jobTitle.includes(targetRole)) {
          return false;
        }
      }

      // 3. Required Skills filter
      if (filters.skills && filters.skills.length > 0) {
        const jobNormSkills = new Set(job.skills.map((s) => this.normalizeSkill(s)));
        const hasAllRequestedSkills = filters.skills.every((s) =>
          jobNormSkills.has(this.normalizeSkill(s))
        );
        if (!hasAllRequestedSkills) {
          return false;
        }
      }

      // 4. Experience / Fresher filter
      if (filters.experience) {
        const expStr = filters.experience.toLowerCase();
        if (expStr.includes('fresher') || expStr.includes('intern')) {
          const { min } = this.parseExperienceRequired(job.experience_required);
          if (min > 1) return false;
        }
      }

      return true;
    });

    logger.debug('Job search remaining after other filters', {
      jobsRemainingAfterOtherFilters: filtered.length,
    });

    // Score and rank matched jobs
    const scoredResults: IMatchResult[] = filtered.map((job) => this.calculateMatch(candidate, job));

    // Filter by minMatchPercentage if specified
    const minScore = filters.minMatchPercentage || 0;
    const qualifiedResults = scoredResults.filter((r) => r.matchPercentage >= minScore);

    // Sort descending by matchPercentage
    qualifiedResults.sort((a, b) => b.matchPercentage - a.matchPercentage);

    const results = qualifiedResults.slice(0, limit);
    logger.debug('Job search final matching count', {
      finalMatchingJobCount: qualifiedResults.length,
      returnedJobCount: results.length,
    });

    return results;
  }
}
