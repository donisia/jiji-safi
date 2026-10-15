"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  username: string;
  name: string;
  role: string;
  agency: string;
}

interface AuthContextType {
  user: User | null;
  login: (u: string, p: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  logout: () => {},
  isLoading: true,
});

export const DEFAULT_USER: User = {
  username: "admin",
  name: "Eng. Kariuki Mwangi",
  role: "Chief Waste Ops Inspector",
  agency: "Nairobi Metropolitan & Kajiado Urban Waste Directorate",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("jiji_safi_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        setUser(DEFAULT_USER);
      }
    } else {
      // For effortless hackathon judging demo, default to authenticated!
      setUser(DEFAULT_USER);
      localStorage.setItem("jiji_safi_user", JSON.stringify(DEFAULT_USER));
    }
    setIsLoading(false);
  }, []);

  const login = (username: string, _pass: string) => {
    // Accepts any credentials or admin/safitrack2024
    const u: User = {
      username: username || "authority_ops",
      name: username ? `${username.toUpperCase()} (Officer)` : DEFAULT_USER.name,
      role: "Municipal Environmental Health Officer",
      agency: "Urban Waste Management & Sanitation Board",
    };
    setUser(u);
    localStorage.setItem("jiji_safi_user", JSON.stringify(u));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("jiji_safi_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
