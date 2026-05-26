import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios
        .get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    sessionStorage.removeItem("affi_channels");
    sessionStorage.removeItem("affi_raw");
    sessionStorage.removeItem("affi_meta");
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password, trial = null) => {
    const payload = { email, password };
    if (trial) payload.trial = trial;
    const res = await axios.post(`${API}/auth/register`, payload);
    sessionStorage.removeItem("affi_channels");
    sessionStorage.removeItem("affi_raw");
    sessionStorage.removeItem("affi_meta");
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("affi_channels");
    sessionStorage.removeItem("affi_raw");
    sessionStorage.removeItem("affi_meta");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const res = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        setUser(res.data);
      } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
