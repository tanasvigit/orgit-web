import React from 'react';
import type { OrganizationStructureFieldSchemaField } from '../../services/settingsService';

export type OrgFieldValues = Record<string, string>;

type Props = {
  schema: OrganizationStructureFieldSchemaField[];
  values: OrgFieldValues;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  /** Keys already shown elsewhere (e.g. name on parent form). */
  excludeKeys?: string[];
  className?: string;
  /** Entity master: show values only (labels from org definition, no schema editing). */
  valuesOnly?: boolean;
};

export function schemaToFieldValues(
  schema: OrganizationStructureFieldSchemaField[],
  source?: Record<string, unknown> | null
): OrgFieldValues {
  const out: OrgFieldValues = {};
  for (const field of schema) {
    const raw = source?.[field.key];
    out[field.key] = raw === undefined || raw === null ? '' : String(raw);
  }
  return out;
}

export function OrganizationStructureDynamicFields({
  schema,
  values,
  onChange,
  disabled = false,
  excludeKeys = [],
  className = '',
  valuesOnly = false,
}: Props) {
  const fields = schema.filter((f) => !excludeKeys.includes(f.key));
  if (fields.length === 0) return null;

  const sectionLabel = valuesOnly ? 'Field values' : 'Section fields (from org structure)';

  if (disabled && valuesOnly) {
    return (
      <div className={`space-y-3 ${className}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {sectionLabel}
        </p>
        {fields.map((field) => (
          <div key={field.id || field.key}>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              {field.label}
            </span>
            <p className="text-sm text-slate-900 dark:text-slate-100">{values[field.key]?.trim() || '—'}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {sectionLabel}
      </p>
      {fields.map((field) => (
        <div key={field.id || field.key}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            {field.label}
            {field.required ? <span className="text-red-500"> *</span> : null}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={disabled}
              placeholder={field.placeholder || undefined}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          ) : field.type === 'select' ? (
            <select
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">—</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={disabled}
              placeholder={field.placeholder || undefined}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          )}
        </div>
      ))}
    </div>
  );
}
