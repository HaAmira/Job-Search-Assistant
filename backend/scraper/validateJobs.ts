import fs from 'fs';
import path from 'path';
import { NormalizedJob } from './normalizeJobs';

const JOBS_FILE_PATH = path.resolve(__dirname, '../data/jobs.json');

export interface ValidationReport {
  isValid: boolean;
  totalJobs: number;
  uniqueIds: number;
  uniqueTitles: number;
  uniqueCompanies: number;
  remoteCount: number;
  errors: string[];
  warnings: string[];
  topSkills: Record<string, number>;
  experienceDistribution: Record<string, number>;
}

export function validateJobDataset(
  filePath = JOBS_FILE_PATH,
  minimumJobs = 1500
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push(`Jobs dataset file does not exist at ${filePath}`);
    return {
      isValid: false,
      totalJobs: 0,
      uniqueIds: 0,
      uniqueTitles: 0,
      uniqueCompanies: 0,
      remoteCount: 0,
      errors,
      warnings,
      topSkills: {},
      experienceDistribution: {},
    };
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let jobs: unknown;
  try {
    jobs = JSON.parse(raw);
  } catch (err: any) {
    errors.push(`Invalid JSON format: ${err.message}`);
    return {
      isValid: false,
      totalJobs: 0,
      uniqueIds: 0,
      uniqueTitles: 0,
      uniqueCompanies: 0,
      remoteCount: 0,
      errors,
      warnings,
      topSkills: {},
      experienceDistribution: {},
    };
  }

  if (!Array.isArray(jobs)) {
    errors.push('jobs.json root element must be a JSON array');
    return {
      isValid: false,
      totalJobs: 0,
      uniqueIds: 0,
      uniqueTitles: 0,
      uniqueCompanies: 0,
      remoteCount: 0,
      errors,
      warnings,
      topSkills: {},
      experienceDistribution: {},
    };
  }

  const totalJobs = jobs.length;

  // Requirement: 1,500–2,000 real job listings
  if (totalJobs < minimumJobs) {
    errors.push(`Dataset contains ${totalJobs} jobs, which is less than the required minimum of ${minimumJobs}.`);
  } else if (totalJobs > 2000) {
    warnings.push(`Dataset contains ${totalJobs} jobs, which exceeds 2,000.`);
  }

  const idSet = new Set<string>();
  const duplicateKeySet = new Set<string>();
  const titleSet = new Set<string>();
  const companySet = new Set<string>();
  let remoteCount = 0;
  const topSkills: Record<string, number> = {};
  const experienceDistribution: Record<string, number> = {};

  const requiredFields: (keyof NormalizedJob)[] = [
    'id',
    'title',
    'company',
    'location',
    'experience_required',
    'skills',
    'description',
    'source',
    'source_link',
    'employment_type',
  ];

  jobs.forEach((value: unknown, idx: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`Job at index ${idx} must be an object.`);
      return;
    }
    const job = value as Partial<NormalizedJob>;

    // 1. Check all required fields are present and non-empty
    for (const field of requiredFields) {
      const fieldValue = job[field];
      if (field === 'skills') continue;
      if (typeof fieldValue !== 'string' || fieldValue.trim() === '') {
        errors.push(`Job at index ${idx} is missing required field: ${field}`);
      }
    }

    // 2. ID validation
    if (typeof job.id !== 'string' || !/^JOB\d{3,}$/.test(job.id)) {
      errors.push(`Job at index ${idx} has invalid ID format: "${job.id}". Expected ^JOB\\d{3,}$`);
    } else if (idSet.has(job.id)) {
      errors.push(`Duplicate ID found: ${job.id} at index ${idx}`);
    } else {
      idSet.add(job.id);
    }

    // 3. Composite uniqueness check: title + company + source_link
    const dedupeKey = `${(job.title || '').toLowerCase()}|${(job.company || '').toLowerCase()}|${(job.source_link || '').toLowerCase()}`;
    if (duplicateKeySet.has(dedupeKey)) {
      warnings.push(`Potential duplicate listing found at index ${idx}: "${job.title}" at "${job.company}"`);
    } else {
      duplicateKeySet.add(dedupeKey);
    }

    // 4. Skills validation
    if (!Array.isArray(job.skills) || job.skills.length === 0 ||
        job.skills.some((skill) => typeof skill !== 'string' || !skill.trim())) {
      errors.push(`Job ${job.id} must have a non-empty array of skills`);
    } else {
      job.skills.forEach((s) => {
        topSkills[s] = (topSkills[s] || 0) + 1;
      });
    }

    // 5. URL validation
    let validSourceLink = false;
    if (typeof job.source_link === 'string') {
      try {
        const sourceUrl = new URL(job.source_link);
        validSourceLink = sourceUrl.protocol === 'http:' || sourceUrl.protocol === 'https:';
      } catch {
        validSourceLink = false;
      }
    }
    if (!validSourceLink) {
      errors.push(`Job ${job.id} has invalid source_link: "${job.source_link}"`);
    }

    // Aggregate statistics
    if (typeof job.title === 'string') titleSet.add(job.title);
    if (typeof job.company === 'string') companySet.add(job.company);
    if (typeof job.location === 'string' && job.location.toLowerCase().includes('remote')) {
      remoteCount++;
    }
    if (typeof job.experience_required === 'string') {
      experienceDistribution[job.experience_required] =
        (experienceDistribution[job.experience_required] || 0) + 1;
    }
  });

  const isValid = errors.length === 0;

  return {
    isValid,
    totalJobs,
    uniqueIds: idSet.size,
    uniqueTitles: titleSet.size,
    uniqueCompanies: companySet.size,
    remoteCount,
    errors,
    warnings,
    topSkills,
    experienceDistribution,
  };
}

// CLI runner
if (require.main === module) {
  console.log('Validating jobs dataset at:', JOBS_FILE_PATH);
  const report = validateJobDataset();

  console.log('\n========================================');
  console.log('       DATASET VALIDATION REPORT        ');
  console.log('========================================');
  console.log(`Status:              ${report.isValid ? 'PASSED (VALID)' : 'FAILED'}`);
  console.log(`Total Jobs:          ${report.totalJobs}`);
  console.log(`Unique IDs:          ${report.uniqueIds}`);
  console.log(`Unique Titles:       ${report.uniqueTitles}`);
  console.log(`Unique Companies:    ${report.uniqueCompanies}`);
  console.log(`Remote Listings:     ${report.remoteCount} (${Math.round((report.remoteCount / (report.totalJobs || 1)) * 100)}%)`);
  console.log(`Error Count:         ${report.errors.length}`);
  console.log(`Warning Count:       ${report.warnings.length}`);

  if (report.errors.length > 0) {
    console.log('\nErrors:');
    report.errors.slice(0, 10).forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    if (report.errors.length > 10) {
      console.log(`  ... and ${report.errors.length - 10} more errors.`);
    }
  }

  console.log('\nExperience Distribution:');
  Object.entries(report.experienceDistribution).forEach(([exp, count]) => {
    console.log(`  - ${exp}: ${count}`);
  });

  console.log('\nTop 10 In-Demand Skills:');
  Object.entries(report.topSkills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([skill, count]) => {
      console.log(`  - ${skill}: ${count}`);
    });
  console.log('========================================\n');

  if (!report.isValid) {
    process.exit(1);
  }
}
