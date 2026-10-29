// Event posters, drawn on a canvas in the owner's phone (1080×1350, Instagram's
// portrait size). Each venue's poster uses its own logo colour, photo and vibe,
// so no two restaurants look alike. "Powered by Skuzi" sits small at the bottom.

export type Vibe = "lounge" | "sports" | "family" | "chill" | "club";

export interface PosterData {
  name: string;
  offer: string;
  when: string; // e.g. "Tuesday 4 November · 19:00"
  venueName: string;
  location?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
  vibe?: Vibe | null;
}

const W = 1080;
const H = 1350;

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,500&family=Anton&family=Fredoka:wght@500;700&family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Figtree:wght@500;700;800&display=swap";

async function loadFonts() {
  if (!document.querySelector(`link[href="${FONTS_URL}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_URL;
    document.head.appendChild(link);
  }
  await Promise.all(
    ['700 80px "Playfair Display"', 'italic 500 40px "Playfair Display"', '400 80px Anton', '700 80px Fredoka', '500 40px Fredoka', '800 80px "Bricolage Grotesque"', '500 40px Figtree', '800 40px Figtree'].map((f) =>
      document.fonts.load(f).catch(() => null),
    ),
  );
}

function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // so the poster can still be saved
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** The logo's main colour (skipping white, black and greys), or null. */
function logoColour(img: HTMLImageElement | null): string | null {
  if (!img) return null;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [pr, pg, pb, pa] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
      const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
      if (pa < 200 || max < 40 || min > 220 || max - min < 50) continue;
      r += pr; g += pg; b += pb; n++;
    }
    if (n < 12) return null;
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return null; // logo served without CORS: fall back to the vibe colour
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws lines of text from (x, y) downwards; returns the y after the last line. */
function lines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, max = 4) {
  const ls = wrap(ctx, text, maxWidth).slice(0, max);
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + ls.length * lineHeight;
}

/** Covers the box with the photo, like CSS object-fit: cover. */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function logoBadge(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, initials: string, cx: number, cy: number, size: number, ring: string, bg: string, fg: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.clip();
  if (logo) cover(ctx, logo, cx - size / 2, cy - size / 2, size, size);
  else {
    ctx.fillStyle = fg;
    ctx.font = `800 ${size * 0.38}px Figtree, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, cx, cy + 2);
  }
  ctx.restore();
}

function photoOrPlaceholder(ctx: CanvasRenderingContext2D, photo: HTMLImageElement | null, x: number, y: number, w: number, h: number, accent: string) {
  if (photo) return cover(ctx, photo, x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, accent);
  g.addColorStop(1, "#1B1524");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function powered(ctx: CanvasRenderingContext2D, colour: string, x: number, y: number, align: CanvasTextAlign) {
  ctx.font = '800 26px Figtree, sans-serif';
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.75;
  ctx.textAlign = align;
  ctx.fillText("POWERED BY SKUZI", x, y);
  ctx.globalAlpha = 1;
}

/** Draws the poster on the canvas (sized to 1080×1350). */
export async function drawPoster(canvas: HTMLCanvasElement, d: PosterData) {
  await loadFonts();
  const [logo, photo] = await Promise.all([loadImage(d.logoUrl), loadImage(d.photoUrl)]);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  const initials = d.venueName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const place = [d.venueName, d.location].filter(Boolean).join(" · ");
  const vibe = d.vibe ?? "chill";
  const own = logoColour(logo);

  if (vibe === "lounge") {
    const accent = own ?? "#C9A24B";
    ctx.fillStyle = "#0F0D0B"; ctx.fillRect(0, 0, W, H);
    photoOrPlaceholder(ctx, photo, 0, 0, W, 700, accent);
    const fade = ctx.createLinearGradient(0, 380, 0, 720);
    fade.addColorStop(0, "rgba(15,13,11,0)"); fade.addColorStop(1, "#0F0D0B");
    ctx.fillStyle = fade; ctx.fillRect(0, 380, W, 340);
    logoBadge(ctx, logo, initials, W / 2, 700, 150, accent, "#0F0D0B", accent);
    ctx.textAlign = "center"; ctx.fillStyle = "#F2E6C9";
    ctx.font = '700 104px "Playfair Display", Georgia, serif';
    let y = lines(ctx, d.name, W / 2, 900, 940, 112, 2);
    ctx.font = 'italic 500 46px "Playfair Display", Georgia, serif'; ctx.fillStyle = accent;
    y = lines(ctx, d.offer, W / 2, y + 30, 900, 58, 3);
    ctx.font = '800 36px Figtree, sans-serif'; ctx.fillStyle = "#F2E6C9";
    ctx.fillText(d.when.toUpperCase(), W / 2, H - 150);
    ctx.font = '500 32px Figtree, sans-serif'; ctx.fillText(place, W / 2, H - 100);
    powered(ctx, accent, W / 2, H - 46, "center");
  } else if (vibe === "sports") {
    const accent = own ?? "#C8102E";
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 520); ctx.lineTo(0, 640); ctx.closePath(); ctx.clip();
    photoOrPlaceholder(ctx, photo, 0, 0, W, 640, "#1A1A1A");
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 0, W, 640);
    ctx.restore();
    logoBadge(ctx, logo, initials, 130, 130, 140, "#FFFFFF", "#FFFFFF", accent);
    ctx.textAlign = "left"; ctx.fillStyle = "#FFFFFF";
    ctx.font = '400 150px Anton, Impact, sans-serif';
    let y = lines(ctx, d.name.toUpperCase(), 70, 790, 950, 150, 3);
    ctx.save();
    ctx.translate(70, y + 10); ctx.rotate(-0.03);
    ctx.font = '800 44px Figtree, sans-serif';
    const ow = Math.min(940, ctx.measureText(d.offer).width + 48);
    ctx.fillStyle = "#FFD100"; roundRect(ctx, 0, 0, ow, 72, 10); ctx.fill();
    ctx.fillStyle = "#1A1A1A"; ctx.fillText(wrap(ctx, d.offer, 900)[0], 24, 50);
    ctx.restore();
    ctx.fillStyle = "#FFFFFF"; ctx.font = '400 56px Anton, Impact, sans-serif';
    ctx.fillText(`${d.when}`.toUpperCase(), 70, H - 130);
    ctx.font = '700 32px Figtree, sans-serif'; ctx.fillText(place, 70, H - 80);
    powered(ctx, "#FFFFFF", W - 70, H - 80, "right");
  } else if (vibe === "family") {
    const accent = own ?? "#E0632E";
    ctx.fillStyle = "#FFF4E2"; ctx.fillRect(0, 0, W, H);
    logoBadge(ctx, logo, initials, 120, 120, 120, accent, accent, "#FFF4E2");
    ctx.textAlign = "left"; ctx.fillStyle = "#2F5D3A"; ctx.font = '700 44px Fredoka, sans-serif';
    ctx.fillText(d.venueName, 200, 136);
    ctx.save();
    ctx.translate(W / 2, 470); ctx.rotate(-0.035);
    ctx.fillStyle = "#FFFFFF"; ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    roundRect(ctx, -440, -260, 880, 540, 36); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save(); roundRect(ctx, -416, -236, 832, 492, 26); ctx.clip();
    photoOrPlaceholder(ctx, photo, -416, -236, 832, 492, accent);
    ctx.restore(); ctx.restore();
    ctx.textAlign = "left"; ctx.fillStyle = accent; ctx.font = '700 100px Fredoka, sans-serif';
    let y = lines(ctx, d.name, 80, 880, 920, 104, 2);
    ctx.fillStyle = "#2F5D3A"; ctx.font = '500 46px Fredoka, sans-serif';
    y = lines(ctx, d.offer, 80, y + 24, 920, 58, 3);
    ctx.font = '700 38px Figtree, sans-serif';
    ctx.fillText(d.when, 80, H - 130);
    ctx.font = '500 32px Figtree, sans-serif'; ctx.fillText(d.location ?? "", 80, H - 82);
    powered(ctx, "#2F5D3A", W - 80, H - 82, "right");
  } else if (vibe === "club") {
    const accent = own ?? "#FF3CAC";
    ctx.fillStyle = "#140A1F"; ctx.fillRect(0, 0, W, H);
    photoOrPlaceholder(ctx, photo, 0, 0, W, H, accent);
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, "rgba(20,10,31,0.35)"); shade.addColorStop(0.55, "rgba(20,10,31,0.8)"); shade.addColorStop(1, "#140A1F");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    logoBadge(ctx, logo, initials, W - 130, 130, 130, accent, "#140A1F", accent);
    ctx.textAlign = "left"; ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = accent; ctx.shadowBlur = 40;
    ctx.font = '800 128px "Bricolage Grotesque", sans-serif';
    let y = lines(ctx, d.name, 70, 640, 940, 128, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = accent; ctx.font = '800 48px Figtree, sans-serif';
    y = lines(ctx, d.offer, 70, y + 30, 940, 60, 3);
    ctx.fillStyle = "#FFFFFF"; ctx.font = '800 40px Figtree, sans-serif';
    ctx.fillText(d.when.toUpperCase(), 70, H - 140);
    ctx.font = '500 32px Figtree, sans-serif'; ctx.fillText(place, 70, H - 90);
    powered(ctx, "#FFFFFF", W - 70, H - 90, "right");
  } else {
    // chill (default): light, calm, rounded photo on top
    const accent = own ?? "#BF4A1A";
    ctx.fillStyle = "#F6F1EA"; ctx.fillRect(0, 0, W, H);
    ctx.save(); roundRect(ctx, 60, 60, W - 120, 660, 48); ctx.clip();
    photoOrPlaceholder(ctx, photo, 60, 60, W - 120, 660, accent);
    ctx.restore();
    logoBadge(ctx, logo, initials, 170, 720, 150, "#F6F1EA", "#FFFFFF", accent);
    ctx.textAlign = "left"; ctx.fillStyle = "#231A2C";
    ctx.font = '800 100px "Bricolage Grotesque", sans-serif';
    let y = lines(ctx, d.name, 70, 900, 940, 104, 2);
    ctx.fillStyle = accent; ctx.font = '700 46px Figtree, sans-serif';
    y = lines(ctx, d.offer, 70, y + 26, 940, 58, 3);
    ctx.fillStyle = "#231A2C"; ctx.font = '800 38px Figtree, sans-serif';
    ctx.fillText(d.when, 70, H - 130);
    ctx.font = '500 32px Figtree, sans-serif'; ctx.fillText(place, 70, H - 82);
    powered(ctx, "#231A2C", W - 70, H - 82, "right");
  }
}

/** The poster as a PNG file, for sharing or downloading. */
export function posterFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b ? new File([b], `${name.replace(/[^\w]+/g, "-").toLowerCase()}-poster.png`, { type: "image/png" }) : null), "image/png");
    } catch {
      resolve(null);
    }
  });
}
