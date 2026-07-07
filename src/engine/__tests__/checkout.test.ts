import { describe, it, expect, vi } from 'vitest';
import { compileCanvasPartnerUrl } from '../checkout';

describe('Canvas Partner URL Compiler', () => {
  it('replaces all bracket tokens correctly', () => {
    const template = 'https://partner.com/custom?w={width}&h={height}&sh={shape}&sz={size}';
    const url = compileCanvasPartnerUrl({
      baseUrlTemplate: template,
      widthCm: 40,
      heightCm: 50,
      shape: 'square'
    });
    expect(url).toBe('https://partner.com/custom?w=40&h=50&sh=square&sz=40x50');
  });

  it('handles percent-encoding of substituted values correctly', () => {
    const template = 'https://partner.com/custom?shape={shape}';
    const url = compileCanvasPartnerUrl({
      baseUrlTemplate: template,
      widthCm: 40,
      heightCm: 50,
      shape: 'round/drill' as any
    });
    expect(url).toBe('https://partner.com/custom?shape=round%2Fdrill');
  });

  it('safely logs an error and returns compiled string for invalid URLs', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const template = 'not-a-valid-url?w={width}&h={height}&shape={shape}';
    const url = compileCanvasPartnerUrl({
      baseUrlTemplate: template,
      widthCm: 10,
      heightCm: 20,
      shape: 'round'
    });
    
    expect(url).toBe('not-a-valid-url?w=10&h=20&shape=round');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid compiled canvas partner URL:',
      'not-a-valid-url?w=10&h=20&shape=round'
    );
    
    consoleErrorSpy.mockRestore();
  });
});
