const socketIo = require('socket.io');

/**
 * Serve socket.io for server-to-client messaging
 */
class SocketIoService {

  get isInitialized() {
    return (this.io != null);
  }

  attachServer(server) {
    this.io = socketIo(server, {
      transports: ['websocket'],
    });

    // create namespace for admin
    this.adminNamespace = this.io.of('/admin');
  }

  getDefaultSocket() {
    if (this.io == null) {
      throw new Error('Http server has not attached yet.');
    }
    return this.io.sockets;
  }

  getAdminSocket() {
    if (this.io == null) {
      throw new Error('Http server has not attached yet.');
    }
    return this.adminNamespace;
  }

}

module.exports = SocketIoService;
