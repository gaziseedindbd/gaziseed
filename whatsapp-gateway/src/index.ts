import http from 'node:http';
import { config } from './config.js';
import { startWhatsApp } from './whatsapp.js';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    ok: true,
    service: 'gaziseed-whatsapp-gateway',
    enabled: config.enabled,
  }));
});

server.listen(config.port, () => {
  console.log(`GAZI SEED WhatsApp gateway health server listening on :${config.port}`);
});

await startWhatsApp();
