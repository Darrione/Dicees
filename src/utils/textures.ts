import * as THREE from 'three';

const numeralTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Generates a rich procedural aged walnut wood grain texture with an ornate
 * RPG tabletop compass rose & brass inlay ring in the rolling tray center.
 */
export function createWalnutTableTextures(maxAnisotropy: number): {
  albedoMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base deep tavern walnut wood tone
  const baseGrad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.72);
  baseGrad.addColorStop(0, '#3e2415');
  baseGrad.addColorStop(0.55, '#2b180e');
  baseGrad.addColorStop(1, '#190d07');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Wood plank seams (horizontal joined walnut boards)
  const plankCount = 6;
  const plankHeight = size / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const yStart = p * plankHeight;
    // Subtle plank tint variation
    ctx.fillStyle = p % 2 === 0 ? 'rgba(255, 195, 130, 0.025)' : 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, yStart, size, plankHeight);

    // Organic wood grain fibers along X
    for (let i = 0; i < 110; i++) {
      const y = yStart + Math.random() * plankHeight;
      const amplitude = 2 + Math.random() * 5;
      const freq = 0.006 + Math.random() * 0.012;
      const phase = Math.random() * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 32) {
        const dy = Math.sin(x * freq + phase) * amplitude;
        ctx.lineTo(x, y + dy);
      }
      ctx.strokeStyle =
        i % 3 === 0 ? 'rgba(15, 7, 3, 0.24)' : 'rgba(95, 56, 32, 0.16)';
      ctx.lineWidth = 0.8 + Math.random() * 1.8;
      ctx.stroke();
    }

    // Plank seam line
    if (p > 0) {
      ctx.beginPath();
      ctx.moveTo(0, yStart);
      ctx.lineTo(size, yStart);
      ctx.strokeStyle = 'rgba(10, 5, 2, 0.65)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  // Ornate inlaid brass RPG geometric compass circle in the center of the tray
  const cx = size / 2;
  const cy = size / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 168, 85, 0.24)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 168, 85, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.325, 0, Math.PI * 2);
  ctx.stroke();

  // Octagram star lines inside the inlay ring
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const rInner = size * 0.09;
    const rOuter = size * 0.325;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
    ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
    ctx.stroke();
  }

  // Inner astrolabe ring
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.09, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(212, 168, 85, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = maxAnisotropy;
  albedoMap.wrapS = THREE.ClampToEdgeWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;

  // Create roughness map (linear space)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#888888';
  rCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 450; i++) {
    const y = Math.random() * 512;
    rCtx.strokeStyle = i % 2 === 0 ? '#6e6e6e' : '#a4a4a4';
    rCtx.lineWidth = 1 + Math.random() * 2;
    rCtx.beginPath();
    rCtx.moveTo(0, y);
    rCtx.lineTo(512, y + (Math.random() - 0.5) * 6);
    rCtx.stroke();
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = maxAnisotropy;

  return { albedoMap, roughnessMap };
}

/**
 * Generates a razor-sharp gilded numeral decal texture for a die face.
 */
export function getDieFaceNumeralTexture(
  value: number,
  inlayColor: string,
  maxAnisotropy: number,
  isCritFace: boolean = false
): THREE.CanvasTexture {
  const key = `${value}_${inlayColor}_${isCritFace}`;
  const existing = numeralTextureCache.get(key);
  if (existing) return existing;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Subtle engraved dark backing shadow for maximum legibility against translucent gemstone
  ctx.save();
  const textStr = String(value);
  const fontSize = textStr.length >= 3 ? 74 : textStr.length === 2 ? 92 : 108;
  ctx.font = `700 ${fontSize}px "Cinzel", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle decorative ring on highest face (crit face)
  if (isCritFace) {
    ctx.beginPath();
    ctx.arc(cx, cy, 94, 0, Math.PI * 2);
    ctx.strokeStyle = inlayColor;
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  // Engraved shadow stroke
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(8, 5, 3, 0.85)';
  ctx.strokeText(textStr, cx, cy);

  // Metallic inlay fill
  ctx.fillStyle = inlayColor;
  ctx.fillText(textStr, cx, cy);

  // Underline for 6 and 9 so orientation is unambiguous
  if (value === 6 || value === 9) {
    const w = 36;
    const yLine = cy + fontSize * 0.44;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, yLine);
    ctx.lineTo(cx + w / 2, yLine);
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(8, 5, 3, 0.85)';
    ctx.stroke();

    ctx.lineWidth = 4.5;
    ctx.strokeStyle = inlayColor;
    ctx.stroke();
  }

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;

  numeralTextureCache.set(key, texture);
  return texture;
}
