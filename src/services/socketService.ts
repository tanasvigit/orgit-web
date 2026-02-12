import { io, Socket } from 'socket.io-client';

const getSocketURL = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.DEV) return 'http://localhost:3000';
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return '';
};

const SOCKET_URL = getSocketURL();

let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;
let connectionState: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';

// Socket event types
export interface SocketMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  status?: string;
  created_at: string;
  [key: string]: any;
}

export interface SocketStatusUpdate {
  messageId: string;
  conversationId: string;
  status: 'sent' | 'delivered' | 'read';
}

export type SocketEventHandler = (data: any) => void;

/**
 * Initialize socket connection with token (matches mobile pattern)
 */
export const initSocket = async (token: string): Promise<Socket> => {
  // If socket is already connected, return it
  if (socket?.connected) {
    return socket;
  }

  // If socket exists but not connected, wait for connection
  if (socket && !socket.connected) {
    return waitForSocketConnection();
  }

  if (!token) {
    throw new Error('No token available');
  }

  // Log token info for debugging (first 10 chars only for security)
  console.log('🔌 Initializing socket connection with token:', token.substring(0, 10) + '...');

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  connectionState = 'connecting';
  
  // Create new socket connection (matching mobile config)
  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['polling', 'websocket'], // Try polling first (more reliable)
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000, // Increase max delay
    reconnectionAttempts: Infinity, // Keep trying to reconnect
    timeout: 30000, // Increase timeout to 30 seconds
    forceNew: false, // Reuse existing connection if available
    upgrade: true, // Allow transport upgrade from polling to websocket
    rememberUpgrade: true, // Remember transport upgrade preference
  });

  // Set up connection event listeners (matching mobile pattern)
  socket.on('connect', () => {
    console.log('✅ Socket connected successfully');
    connectionState = 'connected';
    // The waitForSocketConnection promise will resolve via the 'connect' event listener
  });

  socket.on('connect_error', (error: any) => {
    console.error('❌ Socket connection error:', error.message);
    console.error('❌ Socket error details:', {
      type: error.type || 'unknown',
      description: error.description || error.message,
      context: error.context || 'no context',
      data: error.data || 'no data',
      error: error,
    });
    
    // Log the actual error object for debugging
    if (error.data) {
      console.error('❌ Error data:', error.data);
    }
    
    // Check if token was sent correctly
    if (socket) {
      const authData = socket.auth as any;
      const authToken = authData?.token;
      console.log('🔍 Token check:', {
        hasToken: !!authToken,
        tokenLength: authToken?.length || 0,
        tokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'no token',
      });
    }
    
    // If it's a server error, it might be authentication-related
    // But "server error" can also be a generic error, so be more specific
    if (error.message && (
        error.message.toLowerCase().includes('authentication error') ||
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('401') ||
        error.message.toLowerCase().includes('403') ||
        (error.message.toLowerCase().includes('server error') && error.type === 'TransportError')
      )) {
      console.error('🚫 Server authentication error detected. Stopping reconnection attempts.');
      console.error('💡 Possible causes: Invalid/expired token, token format issue, or server authentication failure.');
      console.error('💡 Try logging out and logging back in to get a fresh token.');
      connectionState = 'error';
      // Disable reconnection for server/auth errors
      if (socket) {
        socket.disconnect();
      }
      socket = null;
      connectionPromise = null;
      return;
    }
    
    connectionState = 'error';
    // Don't reject immediately - let reconnection handle it
    // The waitForSocketConnection promise will reject via timeout if connection fails
  });

  socket.on('disconnect', (reason) => {
    console.log('⚠️ Socket disconnected:', reason);
    connectionState = 'disconnected';
    // If disconnected due to transport error, socket will automatically reconnect
    if (reason === 'transport error' || reason === 'transport close') {
      console.log('🔄 Transport error detected, socket will attempt to reconnect...');
    }
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
    connectionState = 'connected';
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Socket reconnection attempt ${attemptNumber}...`);
  });

  socket.on('reconnect_error', (error: any) => {
    console.error('❌ Socket reconnection error:', error.message);
    
    // If it's a server error, stop reconnection attempts
    if (error.message && (error.message.includes('server error') || 
        error.message.includes('unauthorized') || 
        error.message.includes('authentication') ||
        error.message.includes('401') ||
        error.message.includes('403'))) {
      console.error('🚫 Server authentication error during reconnection. Stopping reconnection attempts.');
      if (socket) {
        socket.disconnect();
      }
      socket = null;
      connectionPromise = null;
      connectionState = 'error';
    }
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Socket reconnection failed - all attempts exhausted');
    connectionState = 'error';
  });

  // Wait for connection (matching mobile pattern)
  return waitForSocketConnection();
};

/**
 * Get current socket instance (matches mobile pattern)
 */
export const getSocket = (): Socket => {
  if (!socket) {
    console.warn('⚠️ Socket not initialized. Attempting to initialize...');
    const token = localStorage.getItem('token');
    if (token) {
      // Try to initialize socket (but don't wait for connection)
      initSocket(token).catch((error) => {
        console.error('Failed to auto-initialize socket:', error);
      });
    }
    throw new Error('Socket not initialized. Call initSocket first.');
  }
  return socket;
};

/**
 * Get connection state
 */
export const getConnectionState = (): typeof connectionState => {
  return connectionState;
};

/**
 * Wait for socket to be connected (matches mobile pattern exactly)
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 * @returns Promise<Socket> Connected socket
 */
export const waitForSocketConnection = (timeout = 30000): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    // If socket is already connected, resolve immediately
    if (socket?.connected) {
      resolve(socket);
      return;
    }

    // If socket doesn't exist, try to initialize it
    if (!socket) {
      const token = localStorage.getItem('token');
      if (!token) {
        reject(new Error('No token available'));
        return;
      }
      initSocket(token)
        .then(resolve)
        .catch(reject);
      return;
    }

    // If there's already a connection promise, wait for it
    if (connectionPromise) {
      connectionPromise
        .then(resolve)
        .catch(reject);
      return;
    }

    // Create new connection promise
    let timeoutId: number;
    let resolved = false;

    const promise = new Promise<Socket>((innerResolve, innerReject) => {
      // Set up timeout (increased to 30 seconds)
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          connectionPromise = null;
          // Don't reject - socket might still be connecting
          // Check if socket exists and connection state
          if (socket && !socket.connected && connectionState === 'connecting') {
            console.log('⏳ Socket still connecting, waiting a bit more...');
            // Wait a bit more
            setTimeout(() => {
              if (socket?.connected) {
                innerResolve(socket);
              } else {
                innerReject(new Error('Socket connection timeout after extended wait'));
              }
            }, 5000);
          } else {
            innerReject(new Error('Socket connection timeout'));
          }
        }
      }, timeout);

      // Listen for connect event
      const onConnect = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          socket?.off('connect', onConnect);
          socket?.off('connect_error', onError);
          connectionPromise = null;
          if (socket) {
            innerResolve(socket);
          } else {
            innerReject(new Error('Socket is null'));
          }
        }
      };

      // Listen for connection error (but don't reject immediately - let reconnection handle it)
      const onError = (error: any) => {
        // If it's a server/auth error, reject immediately
        // Be more specific - "server error" alone might not be auth-related
        if (error.message && (
            error.message.toLowerCase().includes('authentication error') ||
            error.message.toLowerCase().includes('unauthorized') ||
            error.message.toLowerCase().includes('401') ||
            error.message.toLowerCase().includes('403') ||
            (error.message.toLowerCase().includes('server error') && error.type === 'TransportError')
          )) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            socket?.off('connect', onConnect);
            socket?.off('connect_error', onError);
            connectionPromise = null;
            innerReject(new Error(`Socket authentication failed: ${error.message}`));
          }
          return;
        }
        
        // Only reject if it's a permanent error (not transport-related)
        if (error.message && !error.message.includes('transport') && !error.message.includes('websocket')) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            socket?.off('connect', onConnect);
            socket?.off('connect_error', onError);
            connectionPromise = null;
            innerReject(error);
          }
        } else {
          // Transport errors are usually temporary - let reconnection handle it
          console.log('⚠️ Transport error, waiting for reconnection...');
        }
      };

      if (socket) {
        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
      } else {
        innerReject(new Error('Socket is null'));
      }
    });

    connectionPromise = promise;

    promise
      .then(resolve)
      .catch(reject);
  });
};

/**
 * Join a conversation room
 * Backend expects just the conversationId string, not an object
 */
export const joinConversationRoom = async (conversationId: string): Promise<void> => {
  const sock = await waitForSocketConnection();
  sock.emit('join_conversation', conversationId);
  console.log(`✅ Joined conversation room: ${conversationId}`);
};

/**
 * Leave a conversation room
 * Backend expects just the conversationId string, not an object
 */
export const leaveConversationRoom = (conversationId: string): void => {
  if (socket?.connected) {
    socket.emit('leave_conversation', conversationId);
    console.log(`👋 Left conversation room: ${conversationId}`);
  }
};

/**
 * Send a message via socket
 */
export const sendMessageViaSocket = async (data: {
  conversationId?: string;
  receiverId?: string;
  groupId?: string;
  messageType: string;
  content: string;
  [key: string]: any;
}): Promise<void> => {
  const sock = await waitForSocketConnection();
  sock.emit('message:send', data);
};

/**
 * Disconnect socket (matches mobile pattern)
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectionPromise = null;
    connectionState = 'disconnected';
  }
};

/**
 * Add typed event listener
 */
export const onSocketEvent = (
  event: string,
  handler: SocketEventHandler
): void => {
  if (socket) {
    socket.on(event, handler);
  }
};

/**
 * Remove event listener
 */
export const offSocketEvent = (
  event: string,
  handler?: SocketEventHandler
): void => {
  if (socket) {
    if (handler) {
      socket.off(event, handler);
    } else {
      socket.off(event);
    }
  }
};

