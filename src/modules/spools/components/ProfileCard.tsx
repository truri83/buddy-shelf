import { IonIcon } from '@ionic/react';
import { speedometerOutline } from 'ionicons/icons';
import type { CSSProperties } from 'react';
import { assignmentLabel, type Spool } from '@/core/api';
import { materialFamily } from '@/core/filament';
import { t } from '@/core/i18n';
import { Badge } from '@/core/ui';
import { useAssignments, usePrinterSlotInfo, useSpoolKProfiles } from '../hooks/useSpools';

const EXTERNAL = 255;
const kText = (k: number) => k.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
/** Düsenart aus Bambus Kürzel (HS…, HH…) */
const nozzleKind = (type: string | null) =>
  !type ? '' : /^HH/i.test(type) ? t('profile.nozzle.hf') : /^HS/i.test(type) ? t('profile.nozzle.std') : type;

/**
 * Druckprofil der Spule: was im Slot eingestellt ist (Profilname + aktueller K-Wert, Hinweis bei Abweichung) und die
 * von Bambuddy gespeicherten K-Werte je Düse (links/rechts, Standard/High Flow).
 */
export function ProfileCard({ spool, style }: { spool: Spool; style: CSSProperties }) {
  const k = useSpoolKProfiles(spool.id);
  const assignment = useAssignments().data?.find((a) => a.spool_id === spool.id) ?? null;
  const { status, presets } = usePrinterSlotInfo(assignment?.printer_id ?? null);
  const tray = !assignment
    ? null
    : assignment.ams_id === EXTERNAL
      ? (status?.vt_tray ?? []).find((v) => v.id === 254 + assignment.tray_id)
      : status?.ams.find((u) => u.id === assignment.ams_id)?.tray.find((x) => x.id === assignment.tray_id);
  const preset = assignment ? presets.find((p) => p.ams_id === assignment.ams_id && p.tray_id === assignment.tray_id) : undefined;
  const presetName = preset?.preset_name?.trim() || null;
  const mismatch = !!presetName && materialFamily(presetName) != null && materialFamily(presetName) !== materialFamily(spool.material);
  const profiles = [...(k.data ?? [])].sort((a, b) => b.extruder - a.extruder || (a.nozzle_type ?? '').localeCompare(b.nozzle_type ?? ''));

  return (
    <section style={style}>
      <h2
        style={{ margin: '0 0 var(--bs-s3)', fontSize: 'var(--bs-fs-title)', display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)' }}
      >
        <IonIcon icon={speedometerOutline} aria-hidden style={{ color: 'var(--bs-accent)' }} />
        {t('profile.title')}
      </h2>
      {assignment && (
        <div style={{ display: 'grid', gap: 'var(--bs-s1)', marginBottom: 'var(--bs-s3)' }}>
          <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>
            {t('profile.inSlot', { slot: assignmentLabel(assignment) })}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s2)', alignItems: 'center' }}>
            {presetName ? (
              <Badge tone={mismatch ? 'warn' : 'good'}>{mismatch ? t('overview.presetMismatch', { name: presetName }) : presetName}</Badge>
            ) : (
              <Badge tone="warn">{t('overview.noPreset')}</Badge>
            )}
            {typeof tray?.k === 'number' && <Badge>K {kText(tray.k)}</Badge>}
          </div>
        </div>
      )}
      <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>{t('profile.saved')}</span>
      {profiles.length ? (
        <div style={{ display: 'grid', gap: 'var(--bs-s2)', marginTop: 'var(--bs-s1)' }}>
          {profiles.map((p) => (
            <div
              key={p.id}
              title={p.name ?? undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 'var(--bs-s3)',
                padding: 'var(--bs-s2) var(--bs-s3)',
                borderRadius: 'var(--bs-r-md)',
                background: 'var(--bs-surface-2)',
              }}
            >
              <Badge tone="neutral">{p.extruder === 1 ? t('profile.left') : t('profile.right')}</Badge>
              <div style={{ minWidth: 0 }}>
                <div>
                  {p.nozzle_diameter ? `${p.nozzle_diameter.replace('.', ',')} mm` : ''} {nozzleKind(p.nozzle_type)}
                </div>
                {p.name && (
                  <div
                    style={{
                      fontSize: 'var(--bs-fs-caption)',
                      color: 'var(--bs-text-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                  </div>
                )}
              </div>
              <strong className="bs-num">K {kText(p.k_value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 'var(--bs-s1) 0 0', color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>
          {k.isPending ? t('state.loading') : t('profile.none')}
        </p>
      )}
    </section>
  );
}
