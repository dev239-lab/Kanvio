import { useContext } from 'react';
import { WorkspaceContext } from '../context/workspaceStore';

export default function useWorkspace() {
  return useContext(WorkspaceContext);
}