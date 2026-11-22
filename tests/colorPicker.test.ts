import { describe, expect, it } from 'vitest';
import { colorPosition, matrixPosition, positionColor } from '../src/components/colorPicker';

describe('color matrix coordinates', () => {
  it('round-trips RGB colors including black, white, grey and hue boundaries', () => {
    for (const r of [0, 51, 127, 255]) {
      for (const g of [0, 51, 127, 255]) {
        for (const b of [0, 51, 127, 255]) {
          const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
          expect(positionColor(colorPosition(hex))).toBe(hex);
        }
      }
    }
    expect(positionColor({ hue: 360, saturation: 100, brightness: 100 })).toBe('#ff0000');
  });

  it('maps pointer positions to saturation/brightness and bounds a drag outside the matrix', () => {
    const bounds = { left: 10, top: 20, width: 200, height: 100 };
    expect(matrixPosition(110, 70, bounds)).toEqual({ saturation: 50, brightness: 50 });
    expect(matrixPosition(-100, -100, bounds)).toEqual({ saturation: 0, brightness: 100 });
    expect(matrixPosition(1000, 1000, bounds)).toEqual({ saturation: 100, brightness: 0 });
    expect(matrixPosition(10, 20, { ...bounds, width: 0 })).toBeUndefined();
  });
});
