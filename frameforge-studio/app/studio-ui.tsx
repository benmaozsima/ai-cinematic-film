'use client';
import { useState, type ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Clapperboard,
  AudioLines,
  Image as ImageIcon,
  LoaderCircle,
} from 'lucide-react';
import { Row, media } from './studio-types';
const isHebrew = () =>
  typeof document !== 'undefined' && document.documentElement.lang === 'he';
const localizedStatus: Record<string, string> = {
  planned: 'מתוכנן',
  review: 'בביקורת',
  approved: 'מאושר',
  rejected: 'נדחה',
  locked: 'נעול',
  draft: 'טיוטה',
  queued: 'בתור',
  running: 'בתהליך',
  submitting: 'נשלח',
  failed: 'נכשל',
  ready: 'מוכן',
  missing: 'חסר',
  configured: 'מוגדר',
  not_configured: 'לא מוגדר',
  complete: 'הושלם',
  rendering: 'בעיבוד',
  submission_unknown: 'שליחה לא ודאית',
  archive_failed: 'שמירה נכשלה',
};
const checkHebrew: Record<string, string> = {
  'Cinematic composition': 'קומפוזיציה קולנועית',
  'Character identity & age': 'זהות הדמות וגיל',
  'Wardrobe & proportions': 'לבוש ופרופורציות',
  'Anatomy & realism': 'אנטומיה וריאליזם',
  'Props & object orientation': 'אביזרים וכיווני עצמים',
  'Location & lighting': 'מיקום ותאורה',
  'Screens & readable text': 'מסכים ומלל קריא',
  'Unwanted people & glitches': 'אנשים לא רצויים ותקלות חזותיות',
  'Motion & temporal consistency': 'תנועה ועקביות לאורך הזמן',
  'Scripted action is visible': 'הפעולה מהתסריט אכן מופיעה',
  'Camera language & continuity': 'שפת מצלמה ורציפות',
  'Dialogue performance': 'משחק ודיאלוג',
  'Spoken words match approved dialogue': 'המילים הנשמעות זהות לדיאלוג המאושר',
  'Audio quality': 'איכות סאונד',
  'Lip-sync': 'סנכרון שפתיים',
  'Pronunciation & timing': 'הגייה ותזמון',
  'Voice identity': 'זהות הקול',
  'Music / sound creative fit': 'התאמת המוזיקה והסאונד',
};
export const reviewLabel = (label: string, hebrew: boolean) =>
  hebrew ? checkHebrew[label] || label : label;
export function Pick({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(String(v))}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue>
          {items.find((i) => i.value === value)?.label || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem value={i.value} key={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="toggle">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{children}</span>
    </label>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value}`}>
      {(isHebrew() ? localizedStatus[value] : undefined) ||
        value?.replaceAll('_', ' ') ||
        (isHebrew() ? 'מתוכנן' : 'planned')}
    </span>
  );
}
export function Media({
  version,
  controls = false,
}: {
  version?: Row;
  controls?: boolean;
}) {
  if (!version?.localPath)
    return (
      <div className="media-empty">
        {version &&
        ['queued', 'running', 'submitting'].includes(version.status) ? (
          <LoaderCircle className="spin" />
        ) : (
          <Clapperboard />
        )}
        <span>
          {version
            ? version.status?.replaceAll('_', ' ')
            : isHebrew()
              ? 'ממתין לפריים ראשון'
              : 'Awaiting first frame'}
        </span>
      </div>
    );
  if (version.kind === 'video')
    return (
      <video
        src={media(version)}
        controls={controls}
        preload="metadata"
        playsInline
      />
    );
  if (version.kind === 'audio')
    return (
      <div className="audio-media">
        <AudioLines />
        <audio src={media(version)} controls preload="metadata" />
      </div>
    );
  return (
    <img
      src={media(version)}
      alt={version.label || (isHebrew() ? 'פריים הפקה' : 'Production frame')}
      loading="lazy"
    />
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={wide ? 'studio-dialog wide' : 'studio-dialog'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ||
              (isHebrew()
                ? 'השינויים נשמרים בתיעוד ההפקה.'
                : 'Changes are saved in the production record.')}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function TextForm({
  initial,
  fields,
  onSave,
  submit,
  children,
}: {
  initial: Row;
  fields: {
    key: string;
    label: string;
    area?: boolean;
    type?: string;
    hint?: string;
  }[];
  onSave: (b: Row) => Promise<unknown>;
  submit?: string;
  children?: ReactNode;
}) {
  const [form, setForm] = useState(initial),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
          await onSave(form);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      {fields.map((f) => (
        <Field label={f.label} hint={f.hint} key={f.key}>
          {f.area ? (
            <Textarea
              rows={f.key === 'screenplay' ? 22 : 4}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          ) : (
            <Input
              type={f.type || 'text'}
              step={f.type === 'number' ? 'any' : undefined}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          )}
        </Field>
      ))}
      {children}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <Button disabled={saving} type="submit">
        {saving ? <LoaderCircle className="spin" /> : null}
        {submit || (isHebrew() ? 'שמירת שינויים' : 'Save changes')}
      </Button>
    </form>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <ImageIcon />
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
