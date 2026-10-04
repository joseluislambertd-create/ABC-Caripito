const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

// Get primary local IPv4 address (prioritizing Wi-Fi / Ethernet)
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const wifiCandidates = [];
  const otherCandidates = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = name.includes('*') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vethernet');
    
    for (const iface of interfaces[name]) {
      const isIpv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIpv4 && !iface.internal) {
        const item = { name, address: iface.address };
        const isWifiOrEth = name.toLowerCase().includes('wi-fi') || 
                            name.toLowerCase().includes('wifi') || 
                            name.toLowerCase().includes('ethernet') || 
                            name.toLowerCase().includes('wlan') || 
                            name.toLowerCase().includes('eth');
        
        if (isWifiOrEth && !isVirtual) {
          wifiCandidates.push(item);
        } else if (!isVirtual) {
          otherCandidates.push(item);
        } else {
          otherCandidates.push(item);
        }
      }
    }
  }

  // Priority 1: Real Wi-Fi or Ethernet
  if (wifiCandidates.length > 0) {
    const p192 = wifiCandidates.find(c => c.address.startsWith('192.168.') || c.address.startsWith('10.') || c.address.startsWith('172.'));
    return p192 ? p192.address : wifiCandidates[0].address;
  }

  // Priority 2: Standard non-virtual LAN
  const lan192 = otherCandidates.find(c => c.address.startsWith('192.168.') || c.address.startsWith('10.') || c.address.startsWith('172.'));
  if (lan192) return lan192.address;

  return otherCandidates[0]?.address || '127.0.0.1';
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // API Endpoint: /api/ip
  if (pathname === '/api/ip') {
    const localIp = getLocalIp();
    const port = server.address()?.port || PORT;
    const responseData = {
      success: true,
      ip: localIp,
      port: port,
      url: `http://${localIp}:${port}/?view=registro`,
      hostname: os.hostname(),
      interfaces: os.networkInterfaces()
    };

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(responseData));
    return;
  }

  // Static File Serving
  let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check: stay within ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🏀 Academia de Baloncesto Caripito (ABC) - Server Online`);
  console.log(`======================================================`);
  console.log(`📍 Acceso Local (PC):     http://localhost:${PORT}`);
  console.log(`📱 Acceso Móvil (Wi-Fi):  http://${localIp}:${PORT}/?view=registro`);
  console.log(`🌐 Escuchando en Host:    ${HOST}:${PORT}`);
  console.log(`======================================================\n`);
});
