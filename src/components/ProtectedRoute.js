import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, token } = useAuth();

  console.log('ProtectedRoute render:', { isAuthenticated, loading, hasToken: !!token });

  if (loading) {
    console.log('ProtectedRoute: showing loading');
    return (
      <div className="loading-container" style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div className="loading-spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 2s linear infinite'
        }}></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute: rendering protected content');
  return children;
};

export default ProtectedRoute;