import React, { createContext, useContext, useState, useEffect } from 'react';
import { ResumeData } from '../types/resume';
import { Application } from '../types/application';
import { JobFilters } from '../types/job';
import { api, getSessionId, resetSessionId } from '../services/api';

interface PersistedConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface SessionContextType {
  sessionId: string;
  resumeData: ResumeData | null;
  applications: Application[];
  filters: JobFilters;
  conversationHistory: PersistedConversationMessage[];
  loadedSessionId: string | null;
  theme: 'light' | 'dark';
  isLoadingSession: boolean;
  refreshProfile: () => Promise<void>;
  refreshApplications: () => Promise<void>;
  updateProfile: (data: Partial<ResumeData>) => Promise<void>;
  startNewSession: () => void;
  toggleTheme: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string>(getSessionId());
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filters, setFilters] = useState<JobFilters>({});
  const [conversationHistory, setConversationHistory] = useState<PersistedConversationMessage[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('hidani_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('hidani_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const loadSessionData = async (requestedSessionId: string) => {
    try {
      setIsLoadingSession(true);
      const session = await api.getSession();
      if (getSessionId() !== requestedSessionId) return;
      if (session) {
        setResumeData(session.resumeData || null);
        setFilters(session.currentFilters || {});
        setConversationHistory(session.conversationHistory || []);
      }
      const apps = await api.getApplications();
      if (getSessionId() !== requestedSessionId) return;
      if (Array.isArray(apps)) setApplications(apps);
    } catch (err) {
      console.warn('Initial session load failed or backend starting up:', err);
    } finally {
      if (getSessionId() === requestedSessionId) {
        setLoadedSessionId(requestedSessionId);
        setIsLoadingSession(false);
      }
    }
  };

  useEffect(() => {
    setIsLoadingSession(true);
    setLoadedSessionId(null);
    setConversationHistory([]);
    void loadSessionData(sessionId);
  }, [sessionId]);

  const refreshProfile = async () => {
    try {
      const data = await api.getResume();
      setResumeData(data);
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  const refreshApplications = async () => {
    try {
      const apps = await api.getApplications();
      if (Array.isArray(apps)) setApplications(apps);
    } catch (err) {
      console.error('Error refreshing applications:', err);
    }
  };

  const updateProfile = async (data: Partial<ResumeData>) => {
    try {
      const updated = await api.updateResume(data);
      setResumeData(updated);
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  const startNewSession = () => {
    const newId = resetSessionId();
    setSessionId(newId);
    setResumeData(null);
    setApplications([]);
    setFilters({});
    setConversationHistory([]);
  };

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        resumeData,
        applications,
        filters,
        conversationHistory,
        loadedSessionId,
        theme,
        isLoadingSession,
        refreshProfile,
        refreshApplications,
        updateProfile,
        startNewSession,
        toggleTheme,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
