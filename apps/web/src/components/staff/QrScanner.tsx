'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/i18n';
import { parseCardPayload } from '@/lib/loyalty/card-token';
import { createFrameDecoder, type FrameDecoder } from '@/lib/staff/qr-decoder';

type CameraProblem = 'denied' | 'unavailable' | 'insecure';
type Status = 'off' | 'starting' | 'on';

const SCAN_INTERVAL_MS = 200;

/**
 * Camera QR scanner using the browser camera (HTTPS or localhost only). Calls `onToken` once
 * with a valid Cavella card token and stops the camera.
 */
export function QrScanner({ onToken, t }: { onToken: (token: string) => void; t: Dictionary['staff'] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const decoderRef = useRef<FrameDecoder | null>(null);
  const [status, setStatus] = useState<Status>('off');
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [foreignCode, setForeignCode] = useState(false);
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
    setTorch({ available: false, on: false });
  }, []);

  useEffect(() => stop, [stop]); // release the camera when the scanner unmounts

  const start = useCallback(async () => {
    setProblem(null);
    setForeignCode(false);
    if (!window.isSecureContext) return setProblem('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return setProblem('unavailable');
    setStatus('starting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (error) {
      setStatus('off');
      const name = error instanceof DOMException ? error.name : '';
      return setProblem(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    decoderRef.current ??= await createFrameDecoder();

    const [track] = stream.getVideoTracks();
    const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
    setTorch({ available: capabilities?.torch === true, on: false });
    setStatus('on');

    let busy = false;
    timerRef.current = window.setInterval(async () => {
      const decoder = decoderRef.current;
      if (busy || !decoder || !videoRef.current) return;
      busy = true;
      try {
        const text = await decoder.decode(videoRef.current);
        if (text) {
          const token = parseCardPayload(text, [window.location.origin]);
          if (token) {
            stop();
            onToken(token);
          } else {
            setForeignCode(true);
          }
        }
      } catch {
        // A single unreadable frame is normal; keep scanning.
      } finally {
        busy = false;
      }
    }, SCAN_INTERVAL_MS);
  }, [onToken, stop]);

  async function toggleTorch() {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ available: true, on });
    } catch {
      setTorch({ available: false, on: false });
    }
  }

  const problemText = problem === 'denied' ? t.cameraDenied : problem === 'insecure' ? t.cameraInsecure : problem ? t.cameraUnavailable : null;

  return (
    <div>
      <div className={`relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-espresso-950 ${status === 'off' ? 'hidden' : ''}`}>
        <video ref={videoRef} muted playsInline aria-label={t.cameraLabel} className="size-full object-cover" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-xl border-4 border-caramel-300/90" />
      </div>
      <p role="status" className="mt-3 min-h-6 text-center text-sm">
        {status === 'starting' ? t.cameraStarting : status === 'on' ? (foreignCode ? t.notACavellaCard : t.cameraHint) : null}
      </p>
      {problemText ? (
        <p role="alert" className="mt-2 rounded-xl bg-rose-100 p-3 text-rose-950">{problemText}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {status === 'off' ? (
          <button type="button" onClick={() => void start()} className="inline-flex min-h-12 items-center rounded-[24px] bg-caramel-400 px-[22px] font-semibold text-espresso-950 hover:bg-caramel-300">
            {t.startCamera}
          </button>
        ) : (
          <button type="button" onClick={stop} className="inline-flex min-h-12 items-center rounded-[24px] border border-espresso-900/25 px-[22px] font-semibold">
            {t.stopCamera}
          </button>
        )}
        {torch.available ? (
          <button type="button" onClick={() => void toggleTorch()} aria-pressed={torch.on} className="inline-flex min-h-12 items-center rounded-[24px] border border-espresso-900/25 px-[22px] font-semibold">
            {torch.on ? t.torchOff : t.torchOn}
          </button>
        ) : null}
      </div>
    </div>
  );
}
