import { http, HttpResponse } from 'msw';
import { assignments, locations, spools } from './data';

const api = (p: string) => `*/api/v1${p}`;

export const handlers = [
  http.get(api('/inventory/spools'), () => HttpResponse.json(spools)),
  http.get(api('/inventory/spools/:id'), ({ params }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    return s ? HttpResponse.json(s) : HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
  }),
  http.patch(api('/inventory/spools/:id'), async ({ params, request }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    Object.assign(s, (await request.json()) as object, { updated_at: new Date().toISOString() });
    return HttpResponse.json(s);
  }),
  http.get(api('/inventory/locations'), () => HttpResponse.json(locations)),
  http.get(api('/inventory/assignments'), () => HttpResponse.json(assignments)),
];
