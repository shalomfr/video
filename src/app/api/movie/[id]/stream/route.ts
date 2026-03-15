import { getEmitter, getBufferedEvents } from '@/lib/movie-pipeline/progress-emitter';
import type { PipelineProgressEvent } from '@/lib/movie-pipeline/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: movieId } = await params;

  if (!movieId) {
    return new Response('Missing movie ID', { status: 400 });
  }

  const emitter = getEmitter(movieId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Replay buffered events for reconnection
      const buffered = getBufferedEvents(movieId);
      for (const event of buffered) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Listen for new events
      const handler = (event: PipelineProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

          if (event.stage === 'DONE' || event.stage === 'FAILED') {
            cleanup();
            controller.close();
          }
        } catch {
          cleanup();
        }
      };

      emitter.on('progress', handler);

      // Keepalive every 15s to prevent Render from closing the connection
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);

      function cleanup() {
        emitter.removeListener('progress', handler);
        clearInterval(keepalive);
      }

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx/Render buffering
    },
  });
}
