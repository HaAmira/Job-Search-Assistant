import { describe, it, expect } from 'vitest';
import { ResumeAgent } from '../src/agents/resumeAgent';
import { createMockPdfBuffer } from './testHelpers';

describe('ResumeAgent - Document Parsing and Extraction', () => {
  const sampleResumeText = `
Alex Morgan
alex.morgan@example.com | +1 (555) 234-5678 | San Francisco, CA
Full Stack Developer | 2+ years of experience

SKILLS:
JavaScript, TypeScript, React, Node.js, Express, MongoDB, Docker, Git, REST API, Tailwind CSS

EXPERIENCE:
Software Engineer at Acme Corp (2022 - Present)
- Built high-performance microservices and frontend dashboards with React and Node.js.
- Integrated MongoDB database and improved query performance by 40%.

EDUCATION:
B.Tech in Computer Science, State University, 2022

PROJECTS:
Cloud Task Manager: Built with TypeScript, React, and MongoDB.
`;

  it('1. should extract text from a valid PDF buffer', async () => {
    const pdfBuffer = createMockPdfBuffer('John Doe john@example.com Full Stack Developer React Node.js');
    const extracted = await ResumeAgent.extractTextFromBuffer(pdfBuffer, 'application/pdf', 'resume.pdf');
    expect(extracted).toContain('John Doe');
    expect(extracted).toContain('React');
  });

  it('2. should reject unreadable or empty document buffers', async () => {
    const tinyBuffer = Buffer.from('hello', 'utf-8');
    await expect(
      ResumeAgent.extractTextFromBuffer(tinyBuffer, 'application/pdf', 'resume.pdf')
    ).rejects.toThrow();
  });

  it('3. should reject unsupported file extensions', async () => {
    const buffer = Buffer.from('some random text in a file that is not a document', 'utf-8');
    await expect(
      ResumeAgent.extractTextFromBuffer(buffer, 'image/png', 'resume.png')
    ).rejects.toThrow(/Unsupported resume format/);
  });

  it('4. should deterministically extract candidate information via fallback parser', () => {
    const parsed = ResumeAgent.fallbackParse(sampleResumeText);

    expect(parsed.name).toContain('Alex Morgan');
    expect(parsed.email).toBe('alex.morgan@example.com');
    expect(parsed.phone).toBe('+1 (555) 234-5678');
    expect(parsed.designation).toBe('Full Stack Developer');
    expect(parsed.yearsOfExperience).toBeGreaterThanOrEqual(2);
    expect(parsed.skills).toContain('React');
    expect(parsed.skills).toContain('Node.js');
    expect(parsed.skills).toContain('MongoDB');
    expect(parsed.skills).toContain('TypeScript');
    expect(parsed.education.length).toBeGreaterThan(0);
  });

  it('5. should allow user corrections on extracted candidate details', () => {
    const initial = ResumeAgent.fallbackParse(sampleResumeText);
    const corrected = ResumeAgent.correctResumeDetails(initial, {
      name: 'Alexander Morgan',
      yearsOfExperience: 3,
      skills: [...initial.skills, 'AWS', 'Kubernetes'],
    });

    expect(corrected.name).toBe('Alexander Morgan');
    expect(corrected.yearsOfExperience).toBe(3);
    expect(corrected.skills).toContain('AWS');
    expect(corrected.skills).toContain('Kubernetes');
    expect(corrected.email).toBe('alex.morgan@example.com');
  });
});
