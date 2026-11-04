import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChatMessage } from '../types/chat';
import { api } from '../services/api';
import { useSession } from './SessionContext';

interface ChatContextType {
  messages: ChatMessage[];
  isTyping: boolean;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  uploadResumeFile: (file: File) => Promise<void>;
  applyForJob: (jobId: string) => Promise<void>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `👋 **Welcome to Hidani Tech AI Job Assistant!**

I'm your dedicated autonomous career partner. I can help you:
1. **Analyze your Resume (PDF or DOCX)** and extract your skills & experience.
2. **Recommend matching tech jobs** from our verified database of real industry opportunities.
3. **Filter in natural language** (e.g. *"Show remote React developer jobs"*, *"Only jobs with >80% match"*).
4. **Apply through conversation** with built-in duplicate safeguards and application tracking.

Upload your resume or pick a suggestion below to get started!`,
  timestamp: new Date().toISOString(),
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    sessionId,
    loadedSessionId,
    conversationHistory,
    isLoadingSession,
    refreshProfile,
    refreshApplications,
  } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`hidani_chat_${sessionId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [INITIAL_WELCOME_MESSAGE];
      }
    }
    return [INITIAL_WELCOME_MESSAGE];
  });
  const [messagesSessionId, setMessagesSessionId] = useState(sessionId);

  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoadingSession || loadedSessionId !== sessionId) return;

    const saved = localStorage.getItem(`hidani_chat_${sessionId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          setMessagesSessionId(sessionId);
          return;
        }
      } catch {
        // Use the server-side conversation if the local copy is invalid.
      }
    }

    if (conversationHistory.length > 0) {
      setMessages(
        conversationHistory
          .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
          .map((entry, index) => ({
            id: `history_${new Date(entry.timestamp).getTime()}_${index}`,
            role: entry.role,
            content: entry.content,
            timestamp: new Date(entry.timestamp).toISOString(),
            intent: typeof entry.metadata?.intent === 'string' ? entry.metadata.intent : undefined,
          }))
      );
    } else {
      setMessages([INITIAL_WELCOME_MESSAGE]);
    }
    setMessagesSessionId(sessionId);
  }, [conversationHistory, isLoadingSession, loadedSessionId, sessionId]);

  // Save only after the active session's state has been restored.
  useEffect(() => {
    if (isLoadingSession || messagesSessionId !== sessionId) return;
    localStorage.setItem(`hidani_chat_${sessionId}`, JSON.stringify(messages));
  }, [isLoadingSession, messages, messagesSessionId, sessionId]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    setError(null);
    const userMsgId = 'user_' + Date.now();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      const result = await api.sendMessage(content);

      const assistantMsg: ChatMessage = {
        id: 'assistant_' + Date.now(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date().toISOString(),
        intent: result.intent,
        jobs: result.jobs,
        application: result.application,
        requiresConfirmation: result.requiresConfirmation,
        candidateProfile: result.candidateProfile,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If user applied or modified resume, sync context
      if (result.intent === 'APPLY_JOB') {
        await refreshApplications();
      }
      if (result.intent === 'ANALYZE_RESUME' || result.candidateProfile) {
        await refreshProfile();
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const errMsg = err.response?.data?.error?.message || 'Failed to reach AI assistant. Please try again.';
      setError(errMsg);

      const assistantErrorMsg: ChatMessage = {
        id: 'error_' + Date.now(),
        role: 'assistant',
        content: `⚠️ **Notice**: ${errMsg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantErrorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const uploadResumeFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(20);

    const uploadNoticeId = 'upload_' + Date.now();
    const userUploadMsg: ChatMessage = {
      id: uploadNoticeId,
      role: 'user',
      content: `Uploaded resume: **${file.name}** (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userUploadMsg]);

    try {
      setUploadProgress(60);
      const res = await api.uploadResume(file);
      setUploadProgress(100);

      await refreshProfile();

      const assistantReply: ChatMessage = {
        id: 'assistant_parse_' + Date.now(),
        role: 'assistant',
        content: `🎉 **Resume parsed successfully!**\n\n` +
          `- **Candidate:** ${res.data.name || 'Candidate'}\n` +
          `- **Designation:** ${res.data.designation || 'Software Engineer'}\n` +
          `- **Years of Experience:** ~${res.data.yearsOfExperience || 0} yrs\n` +
          `- **Skills Found (${res.data.skills?.length || 0}):** ${res.data.skills?.slice(0, 10).join(', ')}${(res.data.skills?.length || 0) > 10 ? '...' : ''}\n\n` +
          `Try asking: *"Recommend jobs for me"* or *"Show only remote jobs"*.`,
        timestamp: new Date().toISOString(),
        candidateProfile: res.data,
      };

      setMessages((prev) => [...prev, assistantReply]);
    } catch (err: any) {
      console.error('Failed to upload resume:', err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to upload and parse resume.';
      setError(errMsg);

      setMessages((prev) => [
        ...prev,
        {
          id: 'assistant_err_' + Date.now(),
          role: 'assistant',
          content: `❌ **Failed to process resume:** ${errMsg}\n\nPlease ensure your document is a valid **PDF or DOCX** containing readable text.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const applyForJob = async (jobId: string) => {
    await sendMessage(`Apply to ${jobId}`);
  };

  const clearChat = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    localStorage.removeItem(`hidani_chat_${sessionId}`);
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        isTyping,
        isUploading,
        uploadProgress,
        error,
        sendMessage,
        uploadResumeFile,
        applyForJob,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
