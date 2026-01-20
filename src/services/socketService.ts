import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;
let connectionState: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
let reconnectAttempts = 0;

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
    reconnectAttempts = 0;
    // The waitForSocketConnection promise will resolve via the 'connect' event listener
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
    console.error('❌ Socket error details:', {
      type: error.type,
      description: error.description,
      context: error.context,
    });
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
    reconnectAttempts = 0;
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Socket reconnection attempt ${attemptNumber}...`);
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Socket reconnection error:', error.message);
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
    let timeoutId: NodeJS.Timeout;
    let resolved = false;

    const promise = new Promise<Socket>((innerResolve, innerReject) => {
      // Set up timeout (increased to 30 seconds)
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          connectionPromise = null;
          // Don't reject - socket might still be connecting
          // Instead, check if socket exists and is connecting
          if (socket && socket.connecting) {
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
          innerResolve(socket!);
        }
      };

      // Listen for connection error (but don't reject immediately - let reconnection handle it)
      const onError = (error: any) => {
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

      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
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
    reconnectAttempts = 0;
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

