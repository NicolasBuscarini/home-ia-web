import { hexToRgb, rgbToHex } from 'home-ia-shared';

export interface ColorPosition {
  hue: number;
  saturation: number;
  brightness: number;
}

export function colorPosition(hex: string): ColorPosition {
  const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255) as [number, number, number];
  const maximum = Math.max(r, g, b);
  const difference = maximum - Math.min(r, g, b);
  let hue = 0;
  if (difference > 0) {
    if (maximum === r) hue = ((g - b) / difference) % 6;
    else if (maximum === g) hue = (b - r) / difference + 2;
    else hue = (r - g) / difference + 4;
  }
  return {
    hue: (hue * 60 + 360) % 360,
    saturation: maximum === 0 ? 0 : (difference / maximum) * 100,
    brightness: maximum * 100,
  };
}

export function positionColor({ hue, saturation, brightness }: ColorPosition): string {
  const sector = (((hue % 360) + 360) % 360) / 60;
  const value = Math.min(100, Math.max(0, brightness)) / 100;
  const chroma = value * (Math.min(100, Math.max(0, saturation)) / 100);
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = value - chroma;
  const channels =
    sector < 1
      ? [chroma, secondary, 0]
      : sector < 2
        ? [secondary, chroma, 0]
        : sector < 3
          ? [0, chroma, secondary]
          : sector < 4
            ? [0, secondary, chroma]
            : sector < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const [r, g, b] = channels.map((channel) => (channel + offset) * 255) as [number, number, number];
  return rgbToHex(r, g, b);
}

export function matrixPosition(
  x: number,
  y: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): Pick<ColorPosition, 'saturation' | 'brightness'> | undefined {
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;
  const unit = (value: number) => Math.min(1, Math.max(0, value));
  return {
    saturation: unit((x - bounds.left) / bounds.width) * 100,
    brightness: (1 - unit((y - bounds.top) / bounds.height)) * 100,
  };
}
