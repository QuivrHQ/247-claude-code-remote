'use client';

import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/utils';
import { authHeaders } from '@/lib/agent-auth';

interface Machine {
  id: string;
  name: string;
  status: string;
  config?: {
    projects: string[];
    agentUrl?: string;
    authToken?: string;
  };
}

export function useFolders(selectedMachine: Machine | null) {
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loadingFolders, setLoadingFolders] = useState(false);

  useEffect(() => {
    if (!selectedMachine) {
      setFolders([]);
      setSelectedProject('');
      return;
    }

    const fetchFolders = async () => {
      setLoadingFolders(true);
      try {
        const agentUrl = selectedMachine.config?.agentUrl || 'localhost:4678';
        const response = await fetch(buildApiUrl(agentUrl, '/api/folders'), {
          headers: authHeaders(selectedMachine.config?.authToken),
        });
        if (response.ok) {
          const folderList: string[] = await response.json();
          setFolders(folderList);
          if (folderList.length > 0) {
            setSelectedProject(folderList[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch folders:', err);
        if (selectedMachine.config?.projects?.length) {
          setFolders(selectedMachine.config.projects);
          setSelectedProject(selectedMachine.config.projects[0]);
        }
      } finally {
        setLoadingFolders(false);
      }
    };

    fetchFolders();
  }, [selectedMachine]);

  const addFolder = (folderName: string) => {
    setFolders((prev) => [...prev, folderName].sort());
    setSelectedProject(folderName);
  };

  return {
    folders,
    selectedProject,
    setSelectedProject,
    loadingFolders,
    addFolder,
  };
}
