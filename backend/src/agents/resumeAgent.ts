// Dynamically require pdf-parse to avoid ESM/CJS interop packaging issues with pdf.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import { IResumeData } from '../models/UserSession';
import { getGroqClient, getGroqModel, summarizeGroqError } from '../config/groq';
import { logger } from '../utils/logger';

export class ResumeAgent {
  /**
   * Extract raw text from uploaded Buffer (PDF or DOCX)
   */
  public static async extractTextFromBuffer(
    buffer: Buffer,
    mimetype: string,
    filename: string
  ): Promise<string> {
    const ext = filename.split('.').pop()?.toLowerCase();
    let extractedText = '';

    try {
      if (mimetype === 'application/pdf' || ext === 'pdf') {
        try {
          const data = await pdfParse(buffer);
          extractedText = data.text;
        } catch (pdfErr: any) {
          // Resilient stream text extractor fallback for synthetic or uncompressed text PDFs
          const rawStr = buffer.toString('binary');
          const matches = rawStr.match(/\(([^)]+)\)\s*Tj/g);
          if (matches && matches.length > 0) {
            extractedText = matches
              .map((m) => m.replace(/^\(/, '').replace(/\)\s*Tj$/, ''))
              .join(' ');
          } else {
            throw pdfErr;
          }
        }
      } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        ext === 'docx' ||
        ext === 'doc'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else {
        throw new Error(`Unsupported resume format: ${filename}. Please upload PDF or DOCX.`);
      }
    } catch (err: any) {
      logger.error('Failed to extract text from document:', err);
      throw new Error(`Failed to extract text from document: ${err.message}`);
    }

    const cleanedText = extractedText.trim();
    if (!cleanedText || cleanedText.length < 20) {
      throw new Error('Unreadable or empty resume. Please upload a clear text PDF or DOCX file.');
    }

    return cleanedText;
  }

  /**
   * Parse extracted resume text into structured JSON candidate profile
   */
  public static async parseResume(rawText: string): Promise<IResumeData> {
    const groq = getGroqClient();

    if (groq) {
      try {
        const prompt = `
You are an expert AI Resume Parser. Extract the candidate's professional profile from the resume text provided below.
Return a STRICT valid JSON object matching this exact schema:
{
  "name": "string (Candidate full name)",
  "email": "string (Email address)",
  "phone": "string (Phone number with country code if available)",
  "designation": "string (Current or target role title, e.g. Software Engineer)",
  "skills": ["string", "string"] (list of programming languages, frameworks, libraries, databases, tools, soft skills),
  "workExperience": [
    {
      "company": "string",
      "role": "string",
      "duration": "string (e.g. 2022 - 2024)",
      "description": "string"
    }
  ],
  "yearsOfExperience": number (estimated total numerical years of experience, e.g. 1.5, 0 for fresher),
  "education": [
    {
      "degree": "string (e.g. B.Tech Computer Science)",
      "institution": "string",
      "year": "string (e.g. 2024)"
    }
  ],
  "projects": [
    {
      "title": "string",
      "description": "string",
      "technologies": ["string"]
    }
  ]
}

Ensure all arrays are populated if details are present in the text.
If a field is missing, use reasonable defaults ("" or empty array [] or 0 for yearsOfExperience).
Do not output markdown code blocks or explanations, ONLY the JSON string.

Resume Text:
${rawText.slice(0, 8000)}
`;

        const response = await groq.chat.completions.create({
          model: getGroqModel(),
          messages: [
            {
              role: 'system',
              content: 'You are a precise resume parser. Output strictly valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return this.sanitizeResumeData(parsed, rawText);
        }
      } catch (err: any) {
        const summary = summarizeGroqError(err);
        logger.warn('Groq resume parsing failed; using deterministic parser', {
          ...summary,
          ...(summary.status === 429 ? { fallback: 'rate-limited' } : {}),
        });
      }
    }

    // Fallback: Deterministic regex-based NLP extraction
    return this.fallbackParse(rawText);
  }

  /**
   * Deterministic regex & heuristic resume parser
   */
  public static fallbackParse(rawText: string): IResumeData {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Email extraction
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    // 2. Phone extraction
    const phoneMatch = rawText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : '';

    // 3. Name extraction (first non-empty line that doesn't contain contact symbols)
    let name = 'Candidate';
    for (const line of lines.slice(0, 5)) {
      if (!line.includes('@') && !line.match(/\d/) && line.length < 40 && line.length > 2) {
        name = line.replace(/^(Resume|CV|Curriculum Vitae)[:\s-]*/i, '').trim();
        break;
      }
    }

    // 4. Skills extraction against comprehensive dictionary
    const skillDictionary = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
      'React', 'React.js', 'Next.js', 'Vue', 'Vue.js', 'Angular', 'Svelte', 'HTML', 'HTML5', 'CSS', 'CSS3', 'Tailwind CSS', 'Bootstrap',
      'Node.js', 'Express', 'Express.js', 'NestJS', 'FastAPI', 'Django', 'Flask', 'Spring Boot',
      'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'SQLite', 'Prisma', 'Mongoose', 'DynamoDB',
      'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'GitHub', 'CI/CD', 'Linux',
      'REST API', 'GraphQL', 'gRPC', 'Microservices', 'WebSockets', 'Jest', 'Mocha', 'Vitest', 'Puppeteer',
      'Machine Learning', 'AI', 'NLP', 'PyTorch', 'TensorFlow', 'Pandas', 'NumPy',
    ];

    const detectedSkills = new Set<string>();
    const lowerRaw = rawText.toLowerCase();

    for (const skill of skillDictionary) {
      const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(rawText)) {
        detectedSkills.add(skill);
      }
    }

    // 5. Designation / Title
    let designation = 'Software Engineer';
    const titleMatches = [
      'Full Stack Developer', 'Full-Stack Developer', 'Frontend Developer', 'Backend Developer',
      'Software Engineer', 'Software Developer', 'SDE', 'Web Developer', 'DevOps Engineer',
      'Data Scientist', 'Machine Learning Engineer', 'Android Developer', 'iOS Developer'
    ];
    for (const title of titleMatches) {
      if (new RegExp(`\\b${title}\\b`, 'i').test(rawText)) {
        designation = title;
        break;
      }
    }

    // 6. Experience estimation
    let yearsOfExperience = 0;
    const expMatch = rawText.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
    if (expMatch) {
      yearsOfExperience = parseFloat(expMatch[1]);
    } else {
      // Check year occurrences e.g. 2021 - 2024
      const yearRanges = rawText.matchAll(/20\d\d\s*(?:-|to)\s*(20\d\d|present|current)/gi);
      let maxYears = 0;
      for (const m of yearRanges) {
        maxYears += 1;
      }
      yearsOfExperience = Math.min(maxYears, 10);
    }

    // 7. Education extraction
    const education: Array<{ degree: string; institution: string; year?: string }> = [];
    const degreeRegex = /(B\.?Tech|Bachelor|M\.?Tech|Master|B\.?S\.?|M\.?S\.?|BCA|MCA|Diploma)[^,\n]*/i;
    const degMatch = rawText.match(degreeRegex);
    if (degMatch) {
      education.push({
        degree: degMatch[0].trim(),
        institution: 'University / College',
        year: '2024',
      });
    }

    return {
      name,
      email,
      phone,
      designation,
      skills: Array.from(detectedSkills),
      workExperience: [],
      yearsOfExperience,
      education,
      projects: [],
      rawText,
    };
  }

  /**
   * Sanitize, validate and format parsed data
   */
  private static sanitizeResumeData(data: any, rawText: string): IResumeData {
    return {
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Candidate',
      email: typeof data.email === 'string' ? data.email.trim() : '',
      phone: typeof data.phone === 'string' ? data.phone.trim() : '',
      designation: typeof data.designation === 'string' && data.designation.trim() ? data.designation.trim() : 'Software Engineer',
      skills: Array.isArray(data.skills) ? data.skills.map((s: any) => String(s).trim()).filter(Boolean) : [],
      workExperience: Array.isArray(data.workExperience) ? data.workExperience : [],
      yearsOfExperience: typeof data.yearsOfExperience === 'number' ? Math.max(0, data.yearsOfExperience) : 0,
      education: Array.isArray(data.education) ? data.education : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
      rawText,
    };
  }

  /**
   * Apply user corrections to parsed profile
   */
  public static correctResumeDetails(
    currentData: IResumeData,
    corrections: Partial<IResumeData>
  ): IResumeData {
    return {
      ...currentData,
      ...corrections,
      skills: corrections.skills || currentData.skills || [],
      workExperience: corrections.workExperience || currentData.workExperience || [],
      education: corrections.education || currentData.education || [],
      projects: corrections.projects || currentData.projects || [],
    };
  }
}
