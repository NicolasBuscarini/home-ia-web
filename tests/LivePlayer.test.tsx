import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { LivePlayer, PLAYER_BUFFER_LIMITS } from '../src/features/monitoring/LivePlayer';
import { I18nProvider } from '../src/i18n/i18n';

afterEach(() => cleanup());

const camera = {
  cameraId: 'garage-01',
  status: 'starting',
  streamEpoch: 'epoch-123456789',
  liveUrl: '/api/v1/live/garage-01/index.m3u8',
};

describe('live player startup and bounded updates', () => {
  it('starts muted with autoplay enabled while keeping the HLS buffer window short', () => {
    render(
      <I18nProvider>
        <LivePlayer camera={camera} onStatusChange={() => {}} />
      </I18nProvider>,
    );

    const video = screen.getByLabelText('Vídeo ao vivo da câmera');
    expect(video).toHaveProperty('autoplay', true);
    expect(video).toHaveProperty('muted', true);
    expect(PLAYER_BUFFER_LIMITS).toEqual({
      maxBufferLength: 12,
      backBufferLength: 6,
      maxMaxBufferLength: 18,
      maxBufferSize: 48_000_000,
    });
  });

  it('does not rerender for time updates that do not change the visible seek position', () => {
    let commits = 0;
    const currentTime = 5;
    render(
      <I18nProvider>
        <Profiler id="player" onRender={() => commits++}>
          <LivePlayer camera={camera} onStatusChange={() => {}} />
        </Profiler>
      </I18nProvider>,
    );
    const video = screen.getByLabelText('Vídeo ao vivo da câmera');
    Object.defineProperty(video, 'seekable', {
      configurable: true,
      value: { length: 1, start: () => 0, end: () => 20 },
    });
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
    });

    fireEvent.timeUpdate(video);
    const commitsAfterFirstVisibleUpdate = commits;
    fireEvent.timeUpdate(video);

    expect(commitsAfterFirstVisibleUpdate).toBeGreaterThan(0);
    expect(commits).toBe(commitsAfterFirstVisibleUpdate);
  });
});
