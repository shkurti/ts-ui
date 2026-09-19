import { useState, useEffect, useRef } from 'react';

const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'wss://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

export const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // Exponential backoff with jitter, uncapped attempts: this is a persistent
  // monitoring dashboard, so it should keep trying to reconnect indefinitely
  // rather than giving up after N tries and requiring a manual refresh. With
  // hundreds of users/thousands of trackers, a fixed short interval would also
  // mean every client reconnects in lockstep after a shared event (e.g. a
  // backend redeploy) and hammers the server with a synchronized retry spike;
  // backoff spreads that out over time and jitter desynchronizes clients that
  // started retrying at the same moment.
  const BASE_RECONNECT_INTERVAL_MS = 3000;
  const MAX_RECONNECT_INTERVAL_MS = 30000;
  const getReconnectDelay = () => {
    const exponential = Math.min(
      BASE_RECONNECT_INTERVAL_MS * 2 ** reconnectAttempts.current,
      MAX_RECONNECT_INTERVAL_MS
    );
    return exponential * (0.5 + Math.random() * 0.5); // jitter: 50%-100% of the exponential delay
  };

  // Heroku's router (and some mobile carrier NATs) silently drop a WebSocket
  // that sits idle too long, without ever sending the browser a close frame -
  // readyState stays OPEN and onclose never fires, so the reconnect logic
  // above never triggers. A ping/pong heartbeat both keeps the connection
  // active and gives us a way to detect that kind of silent death.
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const HEARTBEAT_INTERVAL_MS = 20000; // well under Heroku's 55s idle timeout
  const HEARTBEAT_TIMEOUT_MS = 10000; // time to wait for a pong before treating the connection as dead

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      socket.send('ping');

      // If no pong (or any other message) arrives before the next heartbeat
      // tick, the connection is stale - force-close it so onclose fires and
      // the normal reconnect path takes over.
      heartbeatTimeoutRef.current = setTimeout(() => {
        console.warn('WebSocket heartbeat timed out - connection appears dead, reconnecting...');
        socket.close();
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  };

  const connect = () => {
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No auth token found - WebSocket connection will be unauthenticated');
      }

      // Build WebSocket URL with auth token
      const wsUrl = token ? `${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}` : `${WS_BASE_URL}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        startHeartbeat();
      };

      socketRef.current.onmessage = (event) => {
        // Any inbound traffic (including a "pong" reply) proves the
        // connection is alive, so clear the pending heartbeat-timeout watchdog.
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }

        if (event.data === 'pong') {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          setLastMessage(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socketRef.current.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setConnected(false);
        stopHeartbeat();

        // Attempt to reconnect if not manually closed - indefinitely, with
        // exponential backoff + jitter (see getReconnectDelay above) rather
        // than giving up after a fixed number of tries.
        if (event.code !== 1000) {
          reconnectAttempts.current += 1;
          const delay = getReconnectDelay();
          console.log(`Attempting to reconnect (attempt ${reconnectAttempts.current}) in ${Math.round(delay)}ms...`);

          if (reconnectAttempts.current >= 5) {
            setError('Connection lost, retrying...');
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      socketRef.current.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
      };

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    stopHeartbeat();

    if (socketRef.current) {
      socketRef.current.close(1000, 'Manually disconnected');
      socketRef.current = null;
    }
    setConnected(false);
  };

  const sendMessage = (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', message);
    }
  };

  // Auto-connect on mount and token changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []); // Empty dependency array for mount/unmount only

  // Listen for token changes and reconnect
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        console.log('Auth token changed, reconnecting WebSocket...');
        disconnect();
        if (e.newValue) {
          setTimeout(connect, 100); // Small delay to ensure token is set
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Mobile browsers (and desktop tabs) suspend timers/network while backgrounded,
  // so the socket can die silently during that time with no onclose ever firing.
  // When the page becomes visible again, check immediately rather than waiting
  // on the heartbeat to notice, and reset the reconnect-attempt budget since this
  // is a fresh, user-driven attempt rather than a repeated automatic failure.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const token = localStorage.getItem('token');
      if (!token) return;

      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        console.log('Tab became visible with a dead WebSocket - reconnecting...');
        reconnectAttempts.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    connected,
    lastMessage,
    error,
    connect,
    disconnect,
    sendMessage
  };
};

export default useWebSocket;