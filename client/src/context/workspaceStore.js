import { createContext } from 'react';

export const WorkspaceContext = createContext({
  workspaces: [],
  active: null,
  loading: true,
  setActiveId: () => {},
  reload: () => Promise.resolve(),
});