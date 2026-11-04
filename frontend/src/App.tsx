import React, { useState } from 'react';
import { SessionProvider } from './context/SessionContext';
import { ChatProvider } from './context/ChatContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ChatContainer } from './components/chat/ChatContainer';
import { ChatInput } from './components/chat/ChatInput';
import { ProfileDrawer } from './components/resume/ProfileDrawer';
import { ApplicationHistoryDrawer } from './components/applications/ApplicationHistoryDrawer';
import { ResumeUploadModal } from './components/resume/ResumeUploadModal';
import { RecommendedJobsDrawer } from './components/jobs/RecommendedJobsDrawer';
import { JobDetailModal } from './components/jobs/JobDetailModal';
import { Job } from './types/job';

const MainLayout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isApplicationsOpen, setIsApplicationsOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRecommendedJobsOpen, setIsRecommendedJobsOpen] = useState(false);
  const [selectedJobForModal, setSelectedJobForModal] = useState<Job | null>(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenApplications={() => setIsApplicationsOpen(true)}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenRecommendedJobs={() => setIsRecommendedJobsOpen(true)}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 h-full bg-white dark:bg-slate-900 shadow-xl">
            <Sidebar
              onOpenProfile={() => {
                setIsProfileOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onOpenApplications={() => {
                setIsApplicationsOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onOpenUpload={() => {
                setIsUploadModalOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onOpenRecommendedJobs={() => {
                setIsRecommendedJobsOpen(true);
                setIsMobileSidebarOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        <Header
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenApplications={() => setIsApplicationsOpen(true)}
        />

        {/* Scrollable Chat Area */}
        <ChatContainer onViewJobDetails={(job) => setSelectedJobForModal(job)} />

        {/* Bottom Input Area */}
        <ChatInput onOpenUploadModal={() => setIsUploadModalOpen(true)} />
      </div>

      {/* Modals and Drawers */}
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

      <ApplicationHistoryDrawer
        isOpen={isApplicationsOpen}
        onClose={() => setIsApplicationsOpen(false)}
      />

      <ResumeUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      <RecommendedJobsDrawer
        isOpen={isRecommendedJobsOpen}
        onClose={() => setIsRecommendedJobsOpen(false)}
        onViewDetails={(job) => setSelectedJobForModal(job)}
      />

      <JobDetailModal
        job={selectedJobForModal}
        onClose={() => setSelectedJobForModal(null)}
      />
    </div>
  );
};

export default function App() {
  return (
    <SessionProvider>
      <ChatProvider>
        <MainLayout />
      </ChatProvider>
    </SessionProvider>
  );
}

