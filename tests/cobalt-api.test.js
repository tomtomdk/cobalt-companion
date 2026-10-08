import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthHeader,
  buildCobaltRequestBody,
  parseCobaltResponse,
  requestCobalt
} from '../lib/cobalt-api.js';

test('formats video API requests with supported v11 fields', () => {
  assert.deepEqual(
    buildCobaltRequestBody('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      videoQuality: '1080',
      videoContainer: 'mp4',
      filenameStyle: 'basic'
    }),
    {
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      filenameStyle: 'basic',
      downloadMode: 'auto',
      videoQuality: '1080',
      youtubeVideoContainer: 'mp4'
    }
  );
});

test('formats audio API requests with Cobalt audio enums', () => {
  assert.deepEqual(
    buildCobaltRequestBody('https://example.com/video', { audioFormat: 'opus' }, { mode: 'audio' }),
    {
      url: 'https://example.com/video',
      filenameStyle: 'basic',
      downloadMode: 'audio',
      audioFormat: 'opus'
    }
  );
});

test('builds API key and bearer authentication headers', () => {
  assert.equal(buildAuthHeader({ authScheme: 'api-key', apiKey: 'abc' }), 'Api-Key abc');
  assert.equal(buildAuthHeader({ authScheme: 'bearer', apiKey: 'jwt' }), 'Bearer jwt');
  assert.equal(buildAuthHeader({ authScheme: 'none', apiKey: 'abc' }), null);
});

test('parses tunnel responses', () => {
  assert.deepEqual(
    parseCobaltResponse({
      status: 'tunnel',
      url: 'https://media.example.test/tunnel?id=1',
      filename: 'video.mp4'
    }),
    {
      status: 'tunnel',
      url: 'https://media.example.test/tunnel?id=1',
      filename: 'video.mp4'
    }
  );
});

test('parses redirect responses without assuming API origin', () => {
  const parsed = parseCobaltResponse({
    status: 'redirect',
    url: 'https://cdn.example.net/file.mp4',
    filename: 'file.mp4'
  });
  assert.equal(parsed.url, 'https://cdn.example.net/file.mp4');
});

test('parses picker responses and optional slideshow audio', () => {
  const parsed = parseCobaltResponse({
    status: 'picker',
    audio: 'https://cdn.example.net/audio.mp3',
    audioFilename: 'audio.mp3',
    picker: [
      { type: 'photo', url: 'https://cdn.example.net/a.jpg', thumb: 'https://cdn.example.net/a-thumb.jpg' },
      { type: 'video', url: 'https://cdn.example.net/b.mp4' }
    ]
  });
  assert.equal(parsed.status, 'picker');
  assert.equal(parsed.audioFilename, 'audio.mp3');
  assert.equal(parsed.picker.length, 2);
});

test('parses structured errors into human-readable messages', () => {
  const parsed = parseCobaltResponse({
    status: 'error',
    error: { code: 'api.auth.api-key.missing', context: { service: 'youtube' } }
  });
  assert.equal(parsed.status, 'error');
  assert.match(parsed.message, /API key/);
});

test('rejects malformed response URLs', () => {
  assert.throws(
    () => parseCobaltResponse({ status: 'redirect', url: 'javascript:alert(1)' }),
    /download URL/
  );
});

test('sends Authorization header during API request', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init };
    return {
      ok: true,
      status: 200,
      async json() {
        return { status: 'redirect', url: 'https://cdn.example.net/file.mp4', filename: 'file.mp4' };
      }
    };
  };
  await requestCobalt(
    { url: 'https://your-cobalt-instance.example/', authScheme: 'api-key', apiKey: 'secret' },
    'https://example.com/watch',
    {},
    {},
    fetchImpl
  );
  assert.equal(request.init.headers.Authorization, 'Api-Key secret');
  assert.equal(JSON.parse(request.init.body).url, 'https://example.com/watch');
});
