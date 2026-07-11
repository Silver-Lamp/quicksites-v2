/** @jest-environment jsdom */
import * as React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommitQueue } from '../useCommitQueue';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), dismiss: jest.fn(), success: jest.fn() },
}));
jest.mock('@/lib/templateCache', () => ({ dispatchTemplateCacheUpdate: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const toast = require('react-hot-toast').default as { error: jest.Mock; dismiss: jest.Mock };

const tplRef = () => ({ current: { id: 't1', rev: 0, data: { pages: [] } } }) as any;

function mockFetch(res: { ok: boolean; status: number; body?: any }) {
  (global as any).fetch = jest.fn(async () => ({
    ok: res.ok,
    status: res.status,
    json: async () => res.body ?? {},
  }));
}

beforeEach(() => {
  toast.error.mockClear();
  toast.dismiss.mockClear();
});

test('surfaces a DB commit failure: sets error + toasts (was silently swallowed)', async () => {
  mockFetch({ ok: false, status: 500, body: { error: 'boom' } });
  const { result } = renderHook(() => useCommitQueue(tplRef()));

  expect(result.current.error).toBeNull();
  await act(async () => {
    result.current.queueFullSave('autosave');
    await new Promise((r) => setTimeout(r, 0));
  });

  await waitFor(() => expect(result.current.error).toContain('boom'));
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(toast.error.mock.calls[0][0]).toMatch(/Save failed/i);
});

test('clears the error and stamps lastSavedAt on a successful commit', async () => {
  mockFetch({ ok: true, status: 200, body: { template: { id: 't1', rev: 1 } } });
  const { result } = renderHook(() => useCommitQueue(tplRef()));

  await act(async () => {
    result.current.queueFullSave('save');
    await new Promise((r) => setTimeout(r, 0));
  });

  await waitFor(() => expect(result.current.pending).toBe(false));
  expect(result.current.error).toBeNull();
  expect(result.current.lastSavedAt).toEqual(expect.any(Number));
  expect(toast.dismiss).toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});
