
//   VITE_SERVER_URL=https://api.kanvio.example.com
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:5000`;

export const API_URL = `${SERVER_URL}/api`;