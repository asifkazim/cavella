/**
 * Reads QR codes from camera frames with the phone's own camera — no scanning hardware.
 * Uses the native BarcodeDetector where available (Chrome on Android), otherwise jsQR, which is
 * loaded only when needed so it never weighs on the public pages. Browser-only.
 */
export interface FrameDecoder {
  decode(video: HTMLVideoElement): Promise<string | null>;
}

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
}

/** Frames are scaled down before decoding: plenty for a QR code, much faster on low-end phones. */
const MAX_FRAME_SIDE = 720;

async function nativeDecoder(): Promise<FrameDecoder | null> {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  try {
    if (!(await Detector.getSupportedFormats()).includes('qr_code')) return null;
    const detector = new Detector({ formats: ['qr_code'] });
    return { decode: async (video) => (await detector.detect(video))[0]?.rawValue ?? null };
  } catch {
    return null;
  }
}

async function jsQrDecoder(): Promise<FrameDecoder> {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return {
    decode: async (video) => {
      const { videoWidth: width, videoHeight: height } = video;
      if (!context || width === 0 || height === 0) return null;
      const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(width, height));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
    },
  };
}

export async function createFrameDecoder(): Promise<FrameDecoder> {
  return (await nativeDecoder()) ?? (await jsQrDecoder());
}
