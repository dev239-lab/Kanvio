import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import { WorkspaceContext } from './workspaceStore';

// Remembers which workspace you are looking at, and keeps the list of your workspaces fresh
function Inner({ userId, children }) {
  const socket = useSocket();
  const key = `workspace:${userId}`;
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState(() => localStorage.getItem(key) || '');

  const reload = useCallback(
    () =>
      api
        .get('/workspaces')
        .then(({ data }) => setWorkspaces(data))
        .catch(() => {})
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // Live: someone added you, removed you, or changed a workspace you are in
  useEffect(() => {
    if (!socket) return;
    socket.on('workspaceChanged', reload);
    socket.on('addedToWorkspace', reload);
    socket.on('removedFromWorkspace', reload);
    return () => {
      socket.off('workspaceChanged', reload);
      socket.off('addedToWorkspace', reload);
      socket.off('removedFromWorkspace', reload);
    };
  }, [socket, reload]);

  const setActiveId = useCallback(
    (id) => {
      localStorage.setItem(key, id);
      setActiveIdState(id);
    },
    [key]
  );

  // If the saved workspace is gone (or none is saved), use the first one
  const active = workspaces.find((w) => w._id === activeId) || workspaces[0] || null;

  const value = useMemo(
    () => ({ workspaces, active, loading, setActiveId, reload }),
    [workspaces, active, loading, setActiveId, reload]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  // The key resets everything when a different person logs in
  return (
    <Inner key={user._id} userId={user._id}>
      {children}
    </Inner>
  );
}