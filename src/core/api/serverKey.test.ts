import { describe, expect, it } from 'vitest';
import { serverKeyAllowed } from '../../../server/serverKey.js';

const req = (method: string, url: string, headers: Record<string, string> = {}) => ({ method, url, headers: { host: 'tower:8444', ...headers } });

describe('Server-Schlüssel nur für die App selbst', () => {
  it('eigene App (same-origin) bekommt den Schlüssel für ihre Bereiche', () => {
    const own = { 'sec-fetch-site': 'same-origin' };
    expect(serverKeyAllowed(req('GET', '/api/v1/spoolman/inventory/spools', own))).toBe(true);
    expect(serverKeyAllowed(req('PATCH', '/api/v1/inventory/spools/3', own))).toBe(true);
    expect(serverKeyAllowed(req('POST', '/api/v1/spoolbuddy/scale/update-spool-weight', own))).toBe(true);
    expect(serverKeyAllowed(req('GET', '/api/v1/printers/1/status', own))).toBe(true);
    expect(serverKeyAllowed(req('GET', '/api/v1/auth/me', own))).toBe(true);
  });

  it('fremde Webseite (Formular, fetch, WebSocket) bekommt keinen Schlüssel', () => {
    expect(serverKeyAllowed(req('POST', '/api/v1/inventory/spools/3/archive', { 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(serverKeyAllowed(req('POST', '/api/v1/inventory/spools/3/archive', { 'sec-fetch-site': 'same-site' }))).toBe(false);
    // ältere Browser ohne Sec-Fetch-*: Origin muss zum Host passen
    expect(serverKeyAllowed(req('POST', '/api/v1/inventory/spools/3/archive', { origin: 'https://boese.example' }))).toBe(false);
    expect(serverKeyAllowed(req('POST', '/api/v1/inventory/spools/3/archive', { origin: 'https://tower:8444' }))).toBe(true);
    expect(serverKeyAllowed(req('GET', '/api/v1/ws', { origin: 'https://boese.example' }))).toBe(false);
  });

  it('nur die Bereiche, die die App braucht – Drucker nur lesen', () => {
    const own = { 'sec-fetch-site': 'same-origin' };
    expect(serverKeyAllowed(req('PUT', '/api/v1/settings/spoolman', own))).toBe(false);
    expect(serverKeyAllowed(req('POST', '/api/v1/printers/1/drying/start', own))).toBe(false);
    expect(serverKeyAllowed(req('DELETE', '/api/v1/archives/5', own))).toBe(false);
    expect(serverKeyAllowed(req('GET', '/api/v1/inventoryX', own))).toBe(false);
    expect(serverKeyAllowed(req('GET', '/api/v1/inventory/../settings', own))).toBe(false);
  });

  it('Werkzeuge ohne Browser (curl, Server) wie bisher', () => {
    expect(serverKeyAllowed(req('GET', '/api/v1/spoolman/inventory/spools'))).toBe(true);
  });
});
