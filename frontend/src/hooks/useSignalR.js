import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const BACKEND_URL = `http://${window.location.hostname}:5050`;

export function useSignalR(handlers) {
  const connectionRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);

  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BACKEND_URL}/hubs/intercom`)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on('IncomingCall', (data) => handlersRef.current?.onIncomingCall?.(data));
    connection.on('CallEnded', (data) => handlersRef.current?.onCallEnded?.(data));
    connection.on('CallAnswered', (data) => handlersRef.current?.onCallAnswered?.(data));
    connection.on('ActiveSessions', (data) => handlersRef.current?.onActiveSessions?.(data));
    connection.on('Error', (msg) => handlersRef.current?.onError?.(msg));

    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(() => setConnected(true));
    connection.onclose(() => setConnected(false));

    connection.start()
      .then(() => setConnected(true))
      .catch((err) => console.error('SignalR connection failed:', err));

    return () => { connection.stop(); };
  }, []);

  const invoke = useCallback((method, ...args) => {
    return connectionRef.current?.invoke(method, ...args);
  }, []);

  return { connected, invoke };
}
