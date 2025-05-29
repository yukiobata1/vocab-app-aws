import type { CreateRoomResponse, GetRoomResponse, QuizConfig, QuizQuestion } from '../types/quiz';
import { API_CONFIG } from '../config/api';

/**
 * Room code management service
 * Handles DynamoDB operations through API Gateway
 */
class RoomCodeService {
  private readonly baseUrl = API_CONFIG.baseUrl;

  /**
   * Create a new quiz room with room code
   */
  async createRoom(
    config: QuizConfig,
    questions: QuizQuestion[],
    createdBy: string = 'guest'
  ): Promise<CreateRoomResponse> {
    const response = await fetch(`${this.baseUrl}/room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config,
        questions,
        createdBy,
        ttlHours: 24 // 1 day TTL
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Room creation failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get quiz room by room code
   */
  async getRoom(roomCode: string): Promise<GetRoomResponse> {
    const response = await fetch(`${this.baseUrl}/room/${roomCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Room not found or expired');
      }
      const error = await response.text();
      throw new Error(`Failed to get room: ${error}`);
    }

    return response.json();
  }

  /**
   * Join a room (add student to room)
   */
  async joinRoom(roomCode: string, studentName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/room/${roomCode}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentName,
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Room not found or expired');
      }
      const error = await response.text();
      throw new Error(`Failed to join room: ${error}`);
    }
  }

  /**
   * Get room statistics
   */
  async getRoomStats(roomCode: string): Promise<{
    studentsCount: number;
    studentsJoined: string[];
    expiresAt: string;
  }> {
    const response = await fetch(`${this.baseUrl}/room/${roomCode}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Room not found or expired');
      }
      const error = await response.text();
      throw new Error(`Failed to get room stats: ${error}`);
    }

    return response.json();
  }

  /**
   * Delete/close a room (for teachers)
   */
  async deleteRoom(roomCode: string, createdBy: string = 'guest'): Promise<void> {
    const response = await fetch(`${this.baseUrl}/room/${roomCode}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        createdBy,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete room: ${error}`);
    }
  }

  /**
   * Validate room code format
   */
  isValidRoomCode(roomCode: string): boolean {
    // Room codes should be 6 characters, alphanumeric
    return /^[A-Z0-9]{6}$/.test(roomCode);
  }

  /**
   * Generate a room code (client-side for preview)
   */
  generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

export const roomCodeService = new RoomCodeService();