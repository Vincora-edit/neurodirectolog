import { create } from 'zustand';

interface ProjectState {
  activeProjectId: string | null;
  setActiveProjectId: (projectId: string | null) => void;
}

// Восстанавливаем активный проект из localStorage при загрузке
function getStoredProjectId(): string | null {
  try {
    return localStorage.getItem('activeProjectId');
  } catch {
    return null;
  }
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: getStoredProjectId(),
  setActiveProjectId: (projectId) => {
    if (projectId) {
      localStorage.setItem('activeProjectId', projectId);
    } else {
      localStorage.removeItem('activeProjectId');
    }
    set({ activeProjectId: projectId });
  },
}));
