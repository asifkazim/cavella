import type { Page } from '@playwright/test';
import { renderSVG } from 'uqr';

/**
 * Replaces the device camera with a canvas stream, so tests exercise the real scanner
 * pipeline (getUserMedia → video → frame decoder → token parser) without hardware.
 */
export async function installFakeCamera(page: Page, behaviour: 'works' | 'denied' = 'works'): Promise<void> {
  await page.addInitScript((mode) => {
    const w = window as unknown as { __cameraImage: HTMLImageElement | null; __showToCamera: (src: string) => void };
    w.__cameraImage = null;
    w.__showToCamera = (src: string) => {
      const image = new Image();
      image.src = src;
      w.__cameraImage = image;
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        if (mode === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        setInterval(() => {
          if (!ctx) return;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const image = w.__cameraImage;
          if (image?.complete) ctx.drawImage(image, 170, 90, 300, 300);
        }, 50);
        return canvas.captureStream(20);
      },
    });
  }, behaviour);
}

/** Holds a QR code with `text` in front of the fake camera. */
export async function showQrToCamera(page: Page, text: string): Promise<void> {
  const svg = renderSVG(text, { ecc: 'M', border: 4 });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.evaluate((s) => (window as unknown as { __showToCamera: (src: string) => void }).__showToCamera(s), src);
}
