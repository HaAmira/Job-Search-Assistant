import axios from 'axios';
import { ResumeData } from '../types/resume';
import { JobFilters } from '../types/job';

const SESSION_ID_PATTERN = /^sess_[A-Za-z0-9_-]{43}$/;

const createSessionId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `sess_${token}`;
};

// Anonymous sessions are bearer credentials; never keep IDs from the old weak format.
export const getSessionId = (): string => {
  const STORAGE_KEY = 'hidani_session_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id || !SESSION_ID_PATTERN.test(id)) {
    id = createSessionId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
};

export const resetSessionId = (): string => {
  const STORAGE_KEY = 'hidani_session_id';
  const newId = createSessionId();
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to always append current session ID
apiClient.interceptors.request.use((config) => {
  const sessionId = getSessionId();
  config.headers['x-session-id'] = sessionId;
  return config;
});

export const api = {
  // Chat
  sendMessage: async (message: string) => {
    const response = await apiClient.post('/chat', { message });
    return response.data.data;
  },

  // Resume
  uploadResume: async (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await apiClient.post('/resume/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getResume: async () => {
    const response = await apiClient.get('/resume');
    return response.data.data;
  },

  updateResume: async (resumeData: Partial<ResumeData>) => {
    const response = await apiClient.put('/resume', { resumeData });
    return response.data.data;
  },

  // Jobs
  getJobs: async (filters: JobFilters = {}, page = 1, limit = 10) => {
    const params: any = { page, limit, ...filters };
    if (filters.skills && filters.skills.length > 0) {
      params.skills = filters.skills.join(',');
    }
    const response = await apiClient.get('/jobs', { params });
    return response.data;
  },

  getJobById: async (jobId: string) => {
    const response = await apiClient.get(`/jobs/${jobId}`);
    return response.data.data;
  },

  // Applications
  applyJob: async (jobId: string, confirm = false) => {
    const response = await apiClient.post('/applications', {
      jobId,
      confirm,
    });
    return response.data;
  },

  getApplications: async (search?: string, status?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (status) params.status = status;
    const response = await apiClient.get('/applications', { params });
    return response.data.data;
  },

  // Session
  getSession: async () => {
    const response = await apiClient.get('/session');
    return response.data.data;
  },
};
