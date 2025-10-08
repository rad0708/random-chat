export interface ClientInfo {
  socketId: string;
  sessionId: string;
  nickname: string;
}
export interface RoomState {
  id: string;
  clients: [ClientInfo, ClientInfo];
}

export class Matchmaker {
  private waiting: ClientInfo[] = [];
  private rooms = new Map<string, RoomState>();
  private socketToRoom = new Map<string, string>();

  enqueue(client: ClientInfo): ClientInfo | null {
    this.leaveQueue(client.socketId);
    const partner = this.waiting.shift();
    if (!partner) {
      this.waiting.push(client);
      return null;
    }
    return partner;
  }

  registerRoom(roomId: string, clients: [ClientInfo, ClientInfo]) {
    this.rooms.set(roomId, { id: roomId, clients });
    clients.forEach((c) => this.socketToRoom.set(c.socketId, roomId));
  }

  getRoomBySocket(socketId: string): RoomState | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) ?? null;
  }

  getPartner(socketId: string): ClientInfo | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    return room.clients.find((c) => c.socketId !== socketId) ?? null;
  }

  endSession(socketId: string): RoomState | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    this.rooms.delete(room.id);
    room.clients.forEach((c) => this.socketToRoom.delete(c.socketId));
    return room;
  }

  leaveQueue(socketId: string) {
    this.waiting = this.waiting.filter((c) => c.socketId !== socketId);
  }
}
