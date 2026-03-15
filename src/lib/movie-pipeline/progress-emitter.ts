import { EventEmitter } from 'events';
import type { PipelineProgressEvent, PipelineStage } from './types';

const emitters = new Map<string, EventEmitter>();
const eventBuffers = new Map<string, PipelineProgressEvent[]>();

const MAX_BUFFER_SIZE = 100;
const EMITTER_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function getEmitter(movieId: string): EventEmitter {
  let emitter = emitters.get(movieId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(20);
    emitters.set(movieId, emitter);
    eventBuffers.set(movieId, []);

    // Auto-cleanup after 2 hours
    setTimeout(() => removeEmitter(movieId), EMITTER_TTL_MS);
  }
  return emitter;
}

export function emitProgress(
  movieId: string,
  stage: PipelineStage,
  type: PipelineProgressEvent['type'],
  message: string,
  extra?: { sceneNumber?: number; meta?: Record<string, unknown> }
): void {
  const event: PipelineProgressEvent = {
    timestamp: new Date().toISOString(),
    stage,
    type,
    message,
    sceneNumber: extra?.sceneNumber,
    meta: extra?.meta,
  };

  // Buffer for replay on reconnect
  const buffer = eventBuffers.get(movieId);
  if (buffer) {
    buffer.push(event);
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }
  }

  const emitter = emitters.get(movieId);
  emitter?.emit('progress', event);
}

export function getBufferedEvents(movieId: string): PipelineProgressEvent[] {
  return eventBuffers.get(movieId) || [];
}

export function removeEmitter(movieId: string): void {
  const emitter = emitters.get(movieId);
  if (emitter) {
    emitter.removeAllListeners();
    emitters.delete(movieId);
  }
  eventBuffers.delete(movieId);
}
