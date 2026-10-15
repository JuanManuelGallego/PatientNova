import { afterEach, describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';
import { buildLogger, setErrorReporter } from '../../../src/utils/api/logger.js';

function silentLogger() {
  return buildLogger(new Writable({ write: (_chunk, _enc, cb) => cb() }));
}

describe('logger error reporter', () => {
  afterEach(() => setErrorReporter(undefined));

  it('reports error and fatal lines with the error, message and request id', () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const log = silentLogger();
    const err = new Error('boom');

    log.error({ err, requestId: 'req-1' }, 'Unhandled route error');
    log.fatal('Startup failed');
    log.error(err);

    expect(reporter).toHaveBeenNthCalledWith(1, { err, msg: 'Unhandled route error', requestId: 'req-1' });
    expect(reporter).toHaveBeenNthCalledWith(2, { msg: 'Startup failed' });
    expect(reporter).toHaveBeenNthCalledWith(3, { err });
  });

  it('ignores lower levels and never lets a failing reporter break logging', () => {
    const reporter = vi.fn(() => {
      throw new Error('tracker down');
    });
    setErrorReporter(reporter);
    const log = silentLogger();

    log.warn('just a warning');
    log.info('fine');
    expect(reporter).not.toHaveBeenCalled();
    expect(() => log.error('still logs')).not.toThrow();
  });
});
