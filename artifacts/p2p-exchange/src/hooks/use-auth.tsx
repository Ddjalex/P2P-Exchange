import React, { createContext, useContext } from "react";
import { useGetMe } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react/src/generated/api.schemas";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
});

const mockUser: User = {
  id: 1,
  username: "EthioFuture",
  email: "test@test.com",
  country: "ET",
  kycStatus: "verified",
  isMerchant: false,
  createdAt: new Date().toISOString()
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, isLoading, error } = useGetMe();

  const user = data || mockUser;

  return (
    <AuthContext.Provider value={{ user: isLoading ? null : user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
