import { IonRippleEffect } from '@ionic/react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { thermometerOutline, waterOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import {
  bambuddy,
  fillRatio,
  remainingGrams,
  slotLabel,
  type AmsTray,
  type SlotPreset,
  type Spool,
  type SpoolAssignment,
} from '@/core/api';
import { materialFamily, materialLabel, moistureState, stockLevel, useDisplayConfig, useDryingConfig } from '@/core/filament';
import { fmtNum, t } from '@/core/i18n';
import { Badge, ColorRing, FillBar, MetaChip, MoistureLight } from '@/core/ui';

/** Bambuddy-Adressierung: externe Halterungen = ams 255, tray 0/1 */
const EXTERNAL = 255;
const kText = (k: number) => k.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

interface Group {
  key: string;
  printerId: number;
  title: string;
  humidity: number | null;
  temp: number | null;
  drying: boolean;
  slots: { amsId: number; tray: AmsTray; label: string }[];
}

/**
 * „Im AMS“: je Drucker und AMS eine Kachel (Feuchte, Temperatur), darin die Slots mit Material und Hersteller im
 * Vordergrund, Füllstand, Feuchtigkeits-Ampel und Druckprofil (Profilname im Slot + K-Wert, Hinweis bei Abweichung).
 */
export function AmsOverview({ spools, assignments }: { spools: Spool[]; assignments: SpoolAssignment[] }) {
  const printers = useQuery({ queryKey: ['printers'], queryFn: bambuddy.printers.list, staleTime: 60_000 });
  const ids = (printers.data ?? []).filter((p) => p.is_active !== false).map((p) => p.id);
  const statuses = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['printers', id, 'status'],
      queryFn: () => bambuddy.printers.status(id),
      refetchInterval: 30_000,
    })),
  });
  const presets = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['printers', id, 'slot-presets'],
      queryFn: () => bambuddy.printers.slotPresets(id),
      staleTime: 60_000,
    })),
  });
  const display = useDisplayConfig();
  const dryCfg = useDryingConfig();
  const byId = new Map(spools.map((s) => [s.id, s]));

  const groups: Group[] = [];
  ids.forEach((pid, i) => {
    const st = statuses[i]?.data;
    const name = printers.data?.find((p) => p.id === pid)?.name ?? '';
    for (const u of st?.ams ?? []) {
      groups.push({
        key: `${pid}:${u.id}`,
        printerId: pid,
        title: `${ids.length > 1 ? `${name} · ` : ''}${slotLabel(u.id, 0, u.is_ams_ht).split(' · ')[0]}`,
        humidity: u.humidity ?? null,
        temp: u.temp ?? null,
        drying: (u.dry_time ?? 0) > 0,
        slots: u.tray.map((tr) => ({ amsId: u.id, tray: tr, label: String(tr.id + 1) })),
      });
    }
    const ext = (st?.vt_tray ?? []).filter((v) => v.id - 254 >= 0 && v.id - 254 <= 1);
    const used = ext.filter(
      (v) => v.tray_type || assignments.some((a) => a.printer_id === pid && a.ams_id === EXTERNAL && a.tray_id === v.id - 254),
    );
    if (used.length) {
      groups.push({
        key: `${pid}:ext`,
        printerId: pid,
        title: `${ids.length > 1 ? `${name} · ` : ''}${t('overview.external')}`,
        humidity: null,
        temp: null,
        drying: false,
        slots: used.map((v) => ({ amsId: EXTERNAL, tray: { ...v, id: v.id - 254 }, label: v.id === 254 ? 'L' : 'R' })),
      });
    }
  });

  if (!groups.length) return null;

  return (
    <section aria-label={t('overview.loaded')} style={{ display: 'grid', gap: 'var(--bs-s3)', padding: 'var(--bs-s4) var(--bs-s4) 0' }}>
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--bs-fs-caption)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--bs-text-2)',
        }}
      >
        {t('overview.loaded')}
      </h2>
      <div className="bs-card-grid" style={{ gap: 'var(--bs-s3)' }}>
        {groups.map((g) => {
          const pIdx = ids.indexOf(g.printerId);
          const slotPresets: SlotPreset[] = presets[pIdx]?.data ?? [];
          return (
            <div
              key={g.key}
              style={{
                background: 'var(--bs-surface)',
                borderRadius: 'var(--bs-r-lg)',
                border: '1px solid var(--bs-border)',
                overflow: 'hidden',
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--bs-s2)',
                  padding: 'var(--bs-s2) var(--bs-s3)',
                  background: 'var(--bs-surface-2)',
                  borderBottom: '1px solid var(--bs-border)',
                }}
              >
                <strong style={{ flex: 1 }}>{g.title}</strong>
                {g.drying && <Badge tone="warn">{t('overview.drying')}</Badge>}
                {g.humidity != null && (
                  <MetaChip icon={waterOutline} tone={g.humidity >= dryCfg.amsHumidityWarn ? 'warn' : 'muted'}>
                    {g.humidity} %
                  </MetaChip>
                )}
                {g.temp != null && <MetaChip icon={thermometerOutline}>{fmtNum(Math.round(g.temp))} °C</MetaChip>}
              </header>
              {g.slots.map(({ amsId, tray, label }) => {
                const a = assignments.find((x) => x.printer_id === g.printerId && x.ams_id === amsId && x.tray_id === tray.id);
                const s = a ? byId.get(a.spool_id) : undefined;
                const preset = slotPresets.find((p) => p.ams_id === amsId && p.tray_id === tray.id);
                const presetName = preset?.preset_name?.trim() || null;
                const k = typeof tray.k === 'number' ? tray.k : null;
                // Profil passt nicht zur Spule (andere Materialfamilie)?
                const mismatch =
                  !!s && !!presetName && materialFamily(presetName) != null && materialFamily(presetName) !== materialFamily(s.material);
                const to = s ? `/spools/${s.id}` : `/more/slots/${g.printerId}/${amsId}/${tray.id}`;
                return (
                  <Link
                    key={`${amsId}:${tray.id}`}
                    to={to}
                    className="ion-activatable"
                    style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: '1.6em auto 1fr',
                      gap: 'var(--bs-s3)',
                      alignItems: 'center',
                      padding: 'var(--bs-s3)',
                      borderTop: '1px solid var(--bs-border)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <span className="bs-num" style={{ color: 'var(--bs-text-2)', fontWeight: 600, textAlign: 'center' }}>
                      {label}
                    </span>
                    {s ? (
                      <ColorRing rgba={s.rgba} size={40} label={s.color_name ?? s.material} />
                    ) : (
                      <span
                        aria-hidden
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          border: '2px dashed var(--bs-border)',
                          display: 'inline-block',
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      {s ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--bs-s2)', minWidth: 0 }}>
                            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {materialLabel(s)}
                            </strong>
                            <span
                              style={{
                                color: 'var(--bs-text-2)',
                                fontSize: 'var(--bs-fs-caption)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {s.brand ?? ''}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--bs-s2)',
                              fontSize: 'var(--bs-fs-caption)',
                              color: 'var(--bs-text-2)',
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              #{s.id} {s.color_name ?? ''}
                            </span>
                            <span className="bs-num" style={{ marginLeft: 'auto', color: 'var(--bs-text)', fontWeight: 600 }}>
                              {fmtNum(remainingGrams(s))} g
                            </span>
                          </div>
                          <FillBar fill={fillRatio(s)} level={stockLevel(s, display)} signal={display.signalColors} height={5} />
                        </>
                      ) : (
                        <span style={{ color: 'var(--bs-text-2)' }}>
                          {tray.tray_type ? t('overview.unassigned', { type: tray.tray_type }) : t('overview.emptySlot')}
                        </span>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--bs-s2)', marginTop: 2 }}>
                        {presetName ? (
                          <Badge tone={mismatch ? 'warn' : 'neutral'}>
                            {mismatch ? t('overview.presetMismatch', { name: presetName }) : presetName}
                            {k != null && <span className="bs-num">&nbsp;· K {kText(k)}</span>}
                          </Badge>
                        ) : (
                          (s || tray.tray_type) && <Badge tone="warn">{t('overview.noPreset')}</Badge>
                        )}
                        {s && display.showDrying && moistureState(s, dryCfg).show && <MoistureLight {...moistureState(s, dryCfg)} />}
                      </div>
                    </div>
                    <IonRippleEffect />
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
