import { describe, it, expect, beforeAll, vi } from 'vitest';
import { JobMatchingAgent } from '../src/agents/jobMatchingAgent';
import { IJob, JobService } from '../src/services/jobService';
import { IResumeData } from '../src/models/UserSession';

describe('JobMatchingAgent - Deterministic Scoring & Filtering', () => {
  const mockCandidate: IResumeData = {
    name: 'Sarah Connor',
    designation: 'Senior Frontend Engineer',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'JavaScript'],
    yearsOfExperience: 4,
    education: [],
    workExperience: [],
    projects: [],
  };

  const sampleJob: IJob = {
    id: 'JOB0042',
    title: 'Senior Frontend Engineer',
    company: 'TechCorp',
    location: 'Remote',
    experience_required: '3-5 years',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'GraphQL'],
    description: 'Looking for a Senior Frontend Engineer to build web apps.',
    source: 'Tech Board',
    source_link: 'https://example.com/job/42',
    employment_type: 'Full-time',
  };

  beforeAll(() => {
    JobService.loadJobs();
  });

  it('1. should calculate deterministic match percentage correctly', () => {
    const result = JobMatchingAgent.calculateMatch(mockCandidate, sampleJob);

    expect(result.matchPercentage).toBeGreaterThanOrEqual(75);
    expect(result.matchingSkills).toContain('React');
    expect(result.matchingSkills).toContain('TypeScript');
    expect(result.matchingSkills).toContain('Tailwind CSS');
    expect(result.missingSkills).toContain('GraphQL');
    expect(result.matchReason).toContain('Matches 3/4 required skills');
  });

  it('2. should penalize when candidate lacks required experience', () => {
    const juniorCandidate: IResumeData = {
      name: 'Junior Dev',
      designation: 'Junior Developer',
      skills: ['React'],
      yearsOfExperience: 0.5,
      education: [],
      workExperience: [],
      projects: [],
    };

    const seniorJob: IJob = {
      ...sampleJob,
      title: 'Principal Lead Architect',
      experience_required: '5+ years',
      skills: ['Java', 'Microservices', 'Kubernetes', 'AWS'],
    };

    const result = JobMatchingAgent.calculateMatch(juniorCandidate, seniorJob);
    expect(result.matchPercentage).toBeLessThan(50);
    expect(result.missingSkills.length).toBe(4);
  });

  it('3. should normalize skill synonyms correctly', () => {
    expect(JobMatchingAgent.normalizeSkill('React.js')).toBe('react');
    expect(JobMatchingAgent.normalizeSkill('reactjs')).toBe('react');
    expect(JobMatchingAgent.normalizeSkill('Node.js')).toBe('node.js');
    expect(JobMatchingAgent.normalizeSkill('Node JS')).toBe('node.js');
    expect(JobMatchingAgent.normalizeSkill('TS')).toBe('typescript');
    expect(JobMatchingAgent.normalizeSkill('MongoDB')).toBe('mongodb');
    expect(JobMatchingAgent.normalizeSkill('HTML5')).toBe('html');
    expect(JobMatchingAgent.normalizeSkill('CSS3')).toBe('css');
  });

  it('should recommend jobs from the bundled catalog using a parsed resume profile', () => {
    const resumeProfile: IResumeData = {
      name: 'Candidate',
      designation: 'Full Stack Developer',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'HTML', 'CSS', 'Tailwind CSS'],
      yearsOfExperience: 1,
      education: [],
      workExperience: [],
      projects: [],
    };

    const recommendations = JobMatchingAgent.recommendJobs(resumeProfile, {}, 10);
    expect(recommendations).toHaveLength(10);
    expect(recommendations.every((result, index) =>
      index === 0 || recommendations[index - 1].matchPercentage >= result.matchPercentage
    )).toBe(true);
  });

  it('4. should filter jobs by remote only', () => {
    const recommendations = JobMatchingAgent.recommendJobs(mockCandidate, { remoteOnly: true }, 5);
    expect(recommendations.length).toBeGreaterThan(0);
    for (const rec of recommendations) {
      expect(rec.job.location.toLowerCase()).toContain('remote');
    }
  });

  it('5. should filter jobs by minimum match percentage', () => {
    const minScore = 70;
    const recommendations = JobMatchingAgent.recommendJobs(
      mockCandidate,
      { minMatchPercentage: minScore },
      10
    );
    for (const rec of recommendations) {
      expect(rec.matchPercentage).toBeGreaterThanOrEqual(minScore);
    }
  });

  it('6. should filter jobs by specific required skills', () => {
    const recommendations = JobMatchingAgent.recommendJobs(
      mockCandidate,
      { skills: ['TypeScript'] },
      10
    );
    for (const rec of recommendations) {
      const normSkills = rec.job.skills.map((s) => JobMatchingAgent.normalizeSkill(s));
      expect(normSkills).toContain('typescript');
    }
  });

  it('normalizes common city aliases, case, spacing, and city/state input', () => {
    expect(JobMatchingAgent.normalizeCityName('  BANGALORE, Karnataka  ')).toBe('bengaluru');
    expect(JobMatchingAgent.normalizeCityName('Bengaluru')).toBe('bengaluru');
    expect(JobMatchingAgent.normalizeCityName('New Delhi, India')).toBe('delhi');
    expect(JobMatchingAgent.normalizeCityName('Delhi')).toBe('delhi');
    expect(JobMatchingAgent.normalizeCityName('Gurgaon')).toBe('gurugram');
    expect(JobMatchingAgent.normalizeCityName('Gurugram')).toBe('gurugram');
    expect(JobMatchingAgent.normalizeCityName('Noida')).toBe('noida');
  });

  it('matches city names inside full locations without matching unrelated substrings', () => {
    expect(JobMatchingAgent.matchesLocation('Bangalore', 'Bengaluru, Karnataka, India')).toBe(true);
    expect(JobMatchingAgent.matchesLocation('Delhi', 'New Delhi, India')).toBe(true);
    expect(JobMatchingAgent.matchesLocation('Gurgaon', 'Gurugram, Haryana')).toBe(true);
    expect(JobMatchingAgent.matchesLocation('Noida', '  NOIDA , Uttar Pradesh ')).toBe(true);
    expect(JobMatchingAgent.matchesLocation('Bangalore', 'Mangalore, Karnataka')).toBe(false);
  });

  it('applies normalized location and other requested filters together', () => {
    const nearbyJobs: IJob[] = [
      { ...sampleJob, id: 'BENGALURU-REACT', location: 'Bengaluru, Karnataka', skills: ['React'] },
      { ...sampleJob, id: 'BENGALURU-NODE', location: 'Bengaluru, Karnataka', skills: ['Node.js'] },
      { ...sampleJob, id: 'MANGALORE-REACT', location: 'Mangalore, Karnataka', skills: ['React'] },
    ];
    const getJobs = vi.spyOn(JobService, 'getAllJobs').mockReturnValue(nearbyJobs);

    try {
      const results = JobMatchingAgent.recommendJobs(
        mockCandidate,
        { location: 'Bangalore, Karnataka', skills: ['React'] },
        2000
      );
      expect(results.map((result) => result.job.id)).toEqual(['BENGALURU-REACT']);
    } finally {
      getJobs.mockRestore();
    }
  });

  it('reports zero city matches when the bundled dataset has no jobs in that city', () => {
    const results = JobMatchingAgent.recommendJobs(mockCandidate, { location: 'Bangalore' }, 2000);
    expect(results).toHaveLength(0);
  });
});
