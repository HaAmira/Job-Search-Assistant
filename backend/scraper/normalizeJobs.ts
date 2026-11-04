import * as cheerio from 'cheerio';

export interface RawJobInput {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  tags?: string[];
  url?: string;
  job_type?: string;
  source?: string;
  remote?: boolean;
}

export interface NormalizedJob {
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

// Master tech skill taxonomy for robust extraction
const TECH_SKILLS = [
  'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust',
  'PHP', 'Ruby', 'Swift', 'Kotlin', 'Express', 'Next.js', 'Vue.js', 'Angular', 'Svelte',
  'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
  'GraphQL', 'REST API', 'Git', 'CI/CD', 'Linux', 'Tailwind CSS', 'HTML5', 'CSS3',
  'Microservices', 'FastAPI', 'Django', 'Flask', 'Spring Boot', 'Kafka', 'RabbitMQ',
  'Terraform', 'Machine Learning', 'NLP', 'Data Science', 'PyTorch', 'TensorFlow', 'Pandas'
];

/**
 * Strip HTML tags and format text nicely
 */
export function cleanHtmlText(html: string): string {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    // Remove scripts and styles
    $('script, style, noscript, iframe').remove();
    const text = $.text().replace(/\s+/g, ' ').trim();
    return text;
  } catch {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Infer required experience from title and description
 */
export function inferExperience(title: string, desc: string): string {
  const combined = `${title} ${desc}`.toLowerCase();

  if (combined.includes('intern') || combined.includes('internship') || combined.includes('trainee') || combined.includes('graduate')) {
    return '0-1 years (Fresher/Intern)';
  }
  if (combined.includes('junior') || combined.includes('entry level') || combined.includes('entry-level') || combined.includes('associate')) {
    return '0-2 years';
  }
  if (combined.includes('senior') || combined.includes('sr.') || combined.includes('lead') || combined.includes('principal') || combined.includes('staff')) {
    return '5+ years';
  }

  // Look for explicit year mentions like "3+ years", "2-4 years"
  const rangeMatch = combined.match(/(\d+)\s*[-to]+\s*(\d+)\s*(?:years?|yrs?)/);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} years`;
  }
  const plusMatch = combined.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/);
  if (plusMatch) {
    const num = parseInt(plusMatch[1], 10);
    if (num <= 1) return '0-2 years';
    if (num <= 3) return '2-4 years';
    if (num <= 5) return '3-5 years';
    return `${num}+ years`;
  }

  return '1-3 years';
}

/**
 * Extract technology skills from title, tags and description
 */
export function extractSkills(title: string, tags: any[] = [], desc: string): string[] {
  const extracted = new Set<string>();
  const safeTags = Array.isArray(tags) ? tags.map((t) => (typeof t === 'string' ? t : typeof t === 'object' && t?.name ? String(t.name) : String(t || ''))).filter(Boolean) : [];
  const combined = `${title} ${safeTags.join(' ')} ${desc}`.toLowerCase();

  // Check tags first
  for (const tag of safeTags) {
    const cleanTag = tag.trim();
    if (cleanTag.length > 1 && cleanTag.length < 25) {
      // Find matching standard skill or use cleanTag
      const match = TECH_SKILLS.find((s) => s.toLowerCase() === cleanTag.toLowerCase());
      if (match) {
        extracted.add(match);
      } else if (!cleanTag.includes(' ') && cleanTag.length > 2) {
        extracted.add(cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1));
      }
    }
  }

  // Check against TECH_SKILLS dictionary
  for (const skill of TECH_SKILLS) {
    const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(combined)) {
      extracted.add(skill);
    }
  }

  // Fallback if no skills extracted
  if (extracted.size === 0) {
    if (combined.includes('software') || combined.includes('developer') || combined.includes('engineer')) {
      extracted.add('JavaScript');
      extracted.add('TypeScript');
      extracted.add('Node.js');
    } else {
      extracted.add('Software Development');
    }
  }

  return Array.from(extracted).slice(0, 8);
}

/**
 * Normalize raw job input into standard schema
 */
export function normalizeJob(raw: RawJobInput, index: number): NormalizedJob {
  const id = `JOB${String(index + 1).padStart(4, '0')}`;
  const title = (raw.title || 'Software Engineer').trim();
  const company = (raw.company || 'Tech Company').trim();
  
  let location = (raw.location || 'Remote').trim();
  if (raw.remote || location.toLowerCase().includes('remote') || location === '') {
    location = 'Remote';
  }

  const cleanDesc = cleanHtmlText(raw.description || '');
  const description = cleanDesc.length > 60
    ? cleanDesc.slice(0, 1200)
    : `${title} at ${company}. Looking for talented engineers to join our growing engineering team. Responsibilities include building scalable services, collaborating with cross-functional teams, and writing clean, tested code.`;

  const skills = extractSkills(title, raw.tags || [], description);
  const experience_required = inferExperience(title, description);

  let employment_type = 'Full-time';
  if (raw.job_type) {
    const jt = raw.job_type.toLowerCase();
    if (jt.includes('contract')) employment_type = 'Contract';
    else if (jt.includes('part')) employment_type = 'Part-time';
    else if (jt.includes('intern')) employment_type = 'Internship';
  }

  const source = raw.source || 'Public Tech Board';
  const source_link = raw.url && raw.url.startsWith('http') ? raw.url : `https://example.com/jobs/${id.toLowerCase()}`;

  return {
    id,
    title,
    company,
    location,
    experience_required,
    skills,
    description,
    source,
    source_link,
    employment_type,
  };
}
