import { defineConfig } from 'vite';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateSettings, type SharedSettings } from './src/settings/schema';

export default defineConfig({
  plugins: [{
    name: 'mr-pink-shared-settings',
    configureServer(server) {
      const path = resolve(server.config.root, 'public/shared-settings.json');
      let writes = Promise.resolve();
      // The browser also keeps its active session: saving preferences must not reload a performance.
      server.watcher.unwatch(path);
      server.middlewares.use('/__mr-pink/settings', (req, res) => {
        const respond = (status: number, body: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
        if (req.method === 'GET') {
          void readFile(path, 'utf8').then(raw => respond(200, validateSettings(JSON.parse(raw)))).catch(() => respond(500, { error: 'Could not read shared settings.' }));
          return;
        }
        if (req.method !== 'PUT') { respond(405, { error: 'Method not allowed.' }); return; }
        // Only same-origin JSON requests can change this one fixed project file.
        if (req.headers['content-type'] !== 'application/json' || req.headers.origin !== `http://${req.headers.host}`) {
          respond(403, { error: 'Same-origin JSON required.' }); return;
        }
        let body = '', oversized = false;
        req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > 1_100_000) { oversized = true; body = ''; } });
        req.on('end', () => {
          if (oversized) { respond(413, { error: 'Settings file too large.' }); return; }
          let next: SharedSettings;
          try { next = validateSettings(JSON.parse(body)); } catch { respond(400, { error: 'Invalid settings.' }); return; }
          writes = writes.then(async () => {
            const current = validateSettings(JSON.parse(await readFile(path, 'utf8')));
            if (next.revision !== current.revision) { respond(409, { error: 'Shared settings changed. Reload to load the repository settings.' }); return; }
            const updated = { ...next, revision: randomUUID() };
            const temporary = `${path}.${randomUUID()}.tmp`;
            try { await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, 'utf8'); await rename(temporary, path); }
            finally { await unlink(temporary).catch(() => {}); }
            respond(200, updated);
          }).catch(() => respond(500, { error: 'Could not save settings to the repository.' }));
        });
      });
    },
  }],
});
