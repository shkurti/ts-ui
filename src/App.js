import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Shipments from './pages/Shipments';
import Assets from './pages/Assets';
import Trackers from './pages/Trackers';
import Analysis from './pages/Analysis';
import Configure from './pages/Configure';
import AddAlerts from './pages/AddAlerts';
import './App.css';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <WebSocketProvider>
          <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Navbar />
                <div className="main-content">
                  <Shipments />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/shipments" element={
              <ProtectedRoute>
                <Navbar />
                <div className="main-content">
                  <Shipments />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/assets" element={
              <ProtectedRoute>
                <Navbar />
                <div className="main-content">
                  <Assets />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/trackers" element={
              <ProtectedRoute>
                <Navbar />
                <div className="main-content">
                  <Trackers />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/analysis" element={
              <ProtectedRoute>
                <Navbar />
                <div className="main-content">
                  <Analysis />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/configure" element={
              <ProtectedRoute>
                <Navbar />
                <div className="main-content">
                  <Configure />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/configure/add-alerts" element={
              <ProtectedRoute>
                <Navbar />
                <div className="main-content">
                  <AddAlerts />
                </div>
              </ProtectedRoute>
            } />
            
            {/* Fallback route */}
            <Route path="*" element={
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/">Go to Home</a>
              </div>
            } />
          </Routes>
        </Router>
      </WebSocketProvider>
    </AuthProvider>
  </div>
);
}

export default App;
