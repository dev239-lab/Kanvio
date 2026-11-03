import { connectSocket } from '../services/socket';
import useAuth from './useAuth';

export default function useSocket() {
  const { user } = useAuth();
  return user?.token ? connectSocket(user.token) : null;
}