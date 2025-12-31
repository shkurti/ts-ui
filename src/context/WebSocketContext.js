import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import useWebSocket from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { connected, lastMessage, error, connect, disconnect, sendMessage } = useWebSocket();
  
  // State for different types of real-time data
  const [alerts, setAlerts] = useState([]);
  const [sensorData, setSensorData] = useState({});
  const [trackerLocations, setTrackerLocations] = useState({});

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('Processing WebSocket message:', lastMessage);

    switch (lastMessage.type) {
      case 'alert':
        handleAlertMessage(lastMessage.data);
        break;
      case 'sensor_data':
        handleSensorDataMessage(lastMessage.data);
        break;
      default:
        console.log('Unknown message type:', lastMessage.type);
    }
  }, [lastMessage]);

  const handleAlertMessage = useCallback((alertData) => {
    console.log('New alert received:', alertData);
    
    // Add alert to state (keep last 50 alerts)
    setAlerts(prevAlerts => {
      const newAlerts = [alertData, ...prevAlerts].slice(0, 50);
      return newAlerts;
    });

    // Show notification (you can customize this)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${alertData.alertType} Alert`, {
        body: alertData.message,
        icon: '/favicon.ico'
      });
    }
  }, []);

  const handleSensorDataMessage = useCallback((sensorMessage) => {
    console.log('Processing sensor data message:', sensorMessage);
    
    const fullDoc = sensorMessage?.fullDocument;
    if (!fullDoc) {
      console.log('No fullDocument found in sensor message');
      return;
    }

    const trackerId = fullDoc.trackerID || fullDoc.trackerId;
    if (!trackerId) {
      console.log('No tracker ID found in fullDocument');
      return;
    }

    console.log('New sensor data for tracker:', trackerId, fullDoc);

    // Update sensor data state
    setSensorData(prev => ({
      ...prev,
      [trackerId]: fullDoc
    }));

    // Extract latest location from sensor data
    let lat, lng, timestamp, battery, temperature, humidity, speed;
    
    // Handle data array format (legacy)
    const sensorArray = fullDoc.data;
    if (Array.isArray(sensorArray) && sensorArray.length > 0) {
      const latestReading = sensorArray[sensorArray.length - 1];
      lat = latestReading.Lat || latestReading.latitude;
      lng = latestReading.Lng || latestReading.longitude;
      timestamp = latestReading.DT || latestReading.timestamp;
      battery = latestReading.Batt;
      temperature = latestReading.Temp;
      humidity = latestReading.Hum;
      speed = latestReading.Speed;
    } 
    // Handle direct field format (new)
    else if (fullDoc.Lat !== undefined || fullDoc.Lng !== undefined) {
      lat = fullDoc.Lat || fullDoc.latitude;
      lng = fullDoc.Lng || fullDoc.longitude;
      timestamp = fullDoc.DT || fullDoc.Timestamp || fullDoc.timestamp;
      battery = fullDoc.Batt;
      temperature = fullDoc.Temp;
      humidity = fullDoc.Hum;
      speed = fullDoc.Speed;
    }
    
    if (lat !== undefined && lng !== undefined) {
      const newLocationData = {
        tracker_id: trackerId,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        timestamp: timestamp,
        battery: battery,
        temperature: temperature,
        humidity: humidity,
        speed: speed
      };
      
      console.log('🎯 Setting tracker location in WebSocket context:', {
        trackerId,
        locationData: newLocationData
      });
      
      setTrackerLocations(prev => {
        const updated = {
          ...prev,
          [trackerId]: newLocationData
        };
        console.log('📡 Updated tracker locations state:', updated);
        return updated;
      });
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && !connected) {
      console.log('User authenticated, connecting WebSocket...');
      connect();
    } else if (!isAuthenticated && connected) {
      console.log('User unauthenticated, disconnecting WebSocket...');
      disconnect();
    }
  }, [isAuthenticated, connected, connect, disconnect]);

  // Clear data when disconnected
  useEffect(() => {
    if (!connected) {
      // Keep historical data but mark as stale
      console.log('WebSocket disconnected, data may be stale');
    }
  }, [connected]);

  const value = {
    // Connection state
    connected,
    error,
    
    // Real-time data
    alerts,
    sensorData,
    trackerLocations,
    
    // Methods
    sendMessage,
    connect,
    disconnect,
    
    // Data management
    clearAlerts: () => setAlerts([]),
    clearSensorData: () => setSensorData({}),
    clearTrackerLocations: () => setTrackerLocations({})
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;