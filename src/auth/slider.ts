import { setTimeout as delay } from "node:timers/promises";
import type { Page } from "playwright-core";

/** Align the visible puzzle outline, then let the official page validate the drag. */
export async function dragLoginSlider(page: Page): Promise<boolean> {
  await page.waitForFunction(() => {
    const block = document.querySelector<HTMLCanvasElement>("#sliderDiv canvas.block");
    return block && block.getContext("2d")!.getImageData(0, 0, block.width, block.height)
      .data.some((value, index) => index % 4 === 3 && value > 128);
  });
  const distance = await page.evaluate(() => {
    const pixels = (selector: string) => {
      const image = document.querySelector<HTMLImageElement>(selector)!;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const { width, height, data: background } = pixels("#slider-img1");
    const { width: pieceWidth, height: pieceHeight, data: piece } = pixels("#slider-img2");
    const outline: { x: number; y: number; dx: number; dy: number }[] = [];
    let right = 0;
    for (let y = 1; y < Math.min(height, pieceHeight) - 1; y++) {
      for (let x = 0; x < pieceWidth - 1; x++) {
        if (piece[(y * pieceWidth + x) * 4 + 3]! <= 128) continue;
        right = Math.max(right, x);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (x + dx >= 0 && piece[((y + dy) * pieceWidth + x + dx) * 4 + 3]! <= 128) {
            outline.push({ x, y, dx, dy });
          }
        }
      }
    }
    let best = 0, score = -1;
    for (let shift = right + 1; shift < width - right - 1; shift++) {
      let contrast = 0;
      for (const { x, y, dx, dy } of outline) {
        const inside = (y * width + x + shift) * 4;
        const outside = ((y + dy) * width + x + shift + dx) * 4;
        for (let channel = 0; channel < 3; channel++) {
          contrast += Math.abs(background[inside + channel]! - background[outside + channel]!);
        }
      }
      if (contrast > score) { score = contrast; best = shift; }
    }
    return Math.round(best * document.querySelector<HTMLElement>("#sliderDiv")!.clientWidth / width);
  });
  const box = (await page.locator("#sliderDiv .slider").boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await delay(1_000);
  const [response] = await Promise.all([page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.hostname === "authserver.nju.edu.cn"
      && url.pathname === "/authserver/common/verifySliderCaptcha.htl"
      && response.request().method() === "POST";
  }, { timeout: 15_000 }), (async () => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let step = 1; step <= 30; step++) {
      const progress = step / 30;
      await page.mouse.move(x + distance * (1 - Math.cos(Math.PI * progress)) / 2, y + Math.sin(Math.PI * progress) * 4);
      await delay(30);
    }
    await delay(100);
    await page.mouse.up();
  })()]);
  if (!response.ok()) throw new Error(`学校滑块验证返回 HTTP ${response.status()}`);
  const result = await response.json() as { errorCode: number };
  return result.errorCode === 1;
}
