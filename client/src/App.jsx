import { Routes, Route, Navigate } from 'react-router-dom';
import useAuth from './hooks/useAuth';
import useWorkspace from './hooks/useWorkspace';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import BoardPage from './pages/BoardPage';
import Settings from './pages/Settings';
import MyTasks from './pages/MyTasks';
import Calendar from './pages/Calendar';
import Team from './pages/Team';
import Chat from './pages/Chat';
import Workspace from './pages/Workspace';
import Notification from './components/Notification';

// Signed-out visitors land on the welcome page
function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/welcome" />;
}

// /workspaces opens the workspace you are working in
function ActiveWorkspace() {
  const { active, loading } = useWorkspace();
  if (loading) return null;
  return <Navigate to={active ? `/workspace/${active._id}` : '/'} replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {user && <Notification />}
      <Routes>
        <Route path="/welcome" element={user ? <Navigate to="/" /> : <Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/board/:id" element={<PrivateRoute><BoardPage /></PrivateRoute>} />
        <Route path="/my-tasks" element={<PrivateRoute><MyTasks /></PrivateRoute>} />
        <Route path="/calendar" element={<PrivateRoute><Calendar /></PrivateRoute>} />
        <Route path="/team" element={<PrivateRoute><Team /></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="/chat/:kind/:id" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="/workspaces" element={<PrivateRoute><ActiveWorkspace /></PrivateRoute>} />
        <Route path="/workspace/:id" element={<PrivateRoute><Workspace /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/settings/:tab" element={<PrivateRoute><Settings /></PrivateRoute>} />
      </Routes>
    </>
  );
}