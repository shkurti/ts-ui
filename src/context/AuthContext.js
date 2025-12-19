import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // API base URL - update this to point to your Heroku backend
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token is invalid, remove it
        logout();
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      console.log('Attempting login for:', email);

      const response = await fetch(`${API_BASE_URL}/auth/jwt/login`, {
        method: 'POST',
        body: formData,
      });

      console.log('Login response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const newToken = data.access_token;
        
        console.log('Login successful, token received');
        
        localStorage.setItem('token', newToken);
        setToken(newToken);
        
        // Fetch user data
        await fetchUserWithToken(newToken);
        
        return { success: true };
      } else {
        const errorData = await response.json();
        console.error('Login failed:', errorData);
        return { 
          success: false, 
          error: errorData.detail || 'Login failed' 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, user: data };
      } else {
        const errorData = await response.json();
        return { 
          success: false, 
          error: errorData.detail || 'Registration failed' 
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      };
    }
  };

  const fetchUserWithToken = async (authToken) => {
    try {
      console.log('Fetching user data with token');
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Fetch user response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('User data received:', userData);
        setUser(userData);
      } else {
        console.error('Failed to fetch user data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};