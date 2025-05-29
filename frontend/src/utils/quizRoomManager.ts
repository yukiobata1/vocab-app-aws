import type { QuizConfig } from '../types/quiz';

interface QuizRoom {
  id: string;
  code: string;
  config: QuizConfig;
  isActive: boolean;
  createdAt: number;
  studentsJoined: string[];
}

class QuizRoomManager {
  private rooms: Map<string, QuizRoom> = new Map();
  
  createRoom(config: QuizConfig): QuizRoom {
    const code = this.generateRoomCode();
    const room: QuizRoom = {
      id: `room_${Date.now()}`,
      code,
      config,
      isActive: true,
      createdAt: Date.now(),
      studentsJoined: []
    };
    
    this.rooms.set(code, room);
    return room;
  }
  
  getRoom(code: string): QuizRoom | null {
    return this.rooms.get(code) || null;
  }
  
  joinRoom(code: string, studentName: string): QuizRoom | null {
    const room = this.rooms.get(code);
    if (room && room.isActive) {
      if (!room.studentsJoined.includes(studentName)) {
        room.studentsJoined.push(studentName);
      }
      return room;
    }
    return null;
  }
  
  closeRoom(code: string): boolean {
    const room = this.rooms.get(code);
    if (room) {
      room.isActive = false;
      return true;
    }
    return false;
  }
  
  deleteRoom(code: string): boolean {
    return this.rooms.delete(code);
  }
  
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code)); // Ensure unique code
    
    return code;
  }
  
  // Clean up old rooms (older than 24 hours)
  cleanup(): void {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const [code, room] of this.rooms.entries()) {
      if (room.createdAt < oneDayAgo) {
        this.rooms.delete(code);
      }
    }
  }
  
  getRoomStats(code: string): { studentsCount: number; isActive: boolean } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    
    return {
      studentsCount: room.studentsJoined.length,
      isActive: room.isActive
    };
  }
}

// Singleton instance
export const quizRoomManager = new QuizRoomManager();

// Clean up old rooms periodically
setInterval(() => {
  quizRoomManager.cleanup();
}, 60 * 60 * 1000); // Every hour