import React, { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '../shared';

type EditableField =
  | {
      name: string;
      label?: string;
      type?: string;
      required?: boolean;
      placeholder?: string;
    }
  | {
      name: string;
      label?: string;
      type: 'array';
      required?: boolean;
      fields?: Array<{
        name: string;
        label?: string;
        type?: string;
        required?: boolean;
        placeholder?: string;
      }>;
    };

export interface TemplateSchema {
  lockedStructure?: boolean;
  editableFields?: EditableField[];
  [key: string]: any;
}

export interface SchemaDrivenDocumentEditorProps {
  schema: TemplateSchema;
  initialValues: Record<string, any>;
  title?: string;
  submitLabel?: string;
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
}

function getInputType(fieldType: string | undefined) {
  if (fieldType === 'date') return 'date';
  if (fieldType === 'number') return 'number';
  return 'text';
}

async function fileToDataUri(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export const SchemaDrivenDocumentEditor: React.FC<SchemaDrivenDocumentEditorProps> = ({
  schema,
  initialValues,
  title,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
  disabled,
}) => {
  const editableFields = schema?.editableFields || [];

  const normalizedDefaults = useMemo(() => {
    const out: Record<string, any> = { ...(initialValues || {}) };

    // Ensure required array fields exist with at least one empty row
    for (const f of editableFields) {
      if ((f as any).type === 'array') {
        const af = f as any;
        if (!Array.isArray(out[af.name])) {
          out[af.name] = [];
        }
        if (af.required && out[af.name].length === 0) {
          out[af.name].push({});
        }
      }
    }

    return out;
  }, [editableFields, initialValues]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: normalizedDefaults,
  });

  useEffect(() => {
    reset(normalizedDefaults);
  }, [normalizedDefaults, reset]);

  // Renderers
  const renderScalarField = (field: any) => {
    const label = field.label || field.name;
    const fieldType = field.type || 'text';

    if (fieldType === 'textarea') {
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <textarea
            {...register(field.name, { required: field.required })}
            rows={field.name.toLowerCase().includes('address') ? 3 : 4}
            placeholder={field.placeholder}
            disabled={disabled}
            className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2.5 px-3"
          />
          {(errors as any)[field.name] && (
            <p className="text-red-500 text-xs mt-1">This field is required</p>
          )}
        </div>
      );
    }

    if (fieldType === 'image') {
      const current = watch(field.name);
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              disabled={disabled}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUri = await fileToDataUri(file);
                setValue(field.name, dataUri, { shouldDirty: true, shouldValidate: true });
              }}
              className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {typeof current === 'string' && current.startsWith('data:image/') && (
              <img
                src={current}
                alt="Preview"
                className="h-12 w-12 rounded border border-gray-200 dark:border-gray-700 object-contain bg-white"
              />
            )}
          </div>
          {(errors as any)[field.name] && (
            <p className="text-red-500 text-xs mt-1">This field is required</p>
          )}
        </div>
      );
    }

    return (
      <div key={field.name}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label} {field.required && <span className="text-red-500">*</span>}
        </label>
        <input
          {...register(field.name, { required: field.required })}
          type={getInputType(fieldType)}
          placeholder={field.placeholder}
          disabled={disabled}
          className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2.5 px-3"
        />
        {(errors as any)[field.name] && (
          <p className="text-red-500 text-xs mt-1">This field is required</p>
        )}
      </div>
    );
  };

  const ArrayFieldTable: React.FC<{ field: any }> = ({ field }) => {
    const cols = Array.isArray(field.fields) ? field.fields : [];
    const { fields: rows, append, remove } = useFieldArray({
      control,
      name: field.name,
    });

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900/20">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">{field.label || field.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Add / remove rows. Structure is locked.
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({})}
            disabled={disabled}
          >
            <span className="material-symbols-outlined mr-2 text-sm">add</span>
            Add Row
          </Button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                  #
                </th>
                {cols.map((c: any) => (
                  <th
                    key={c.name}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase"
                  >
                    {c.label || c.name}
                    {c.required && <span className="text-red-500 ml-1">*</span>}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400" colSpan={cols.length + 2}>
                    No rows. Click “Add Row”.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{idx + 1}</td>
                    {cols.map((c: any) => {
                      const name = `${field.name}.${idx}.${c.name}`;
                      const cType = c.type || 'text';
                      return (
                        <td key={c.name} className="px-3 py-2">
                          {cType === 'textarea' ? (
                            <textarea
                              {...register(name as any, { required: c.required })}
                              rows={3}
                              disabled={disabled}
                              className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
                            />
                          ) : (
                            <input
                              {...register(name as any, { required: c.required })}
                              type={getInputType(cType)}
                              disabled={disabled}
                              className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={disabled}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove row"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        await onSubmit(data as any);
      })}
      className="space-y-6"
    >
      {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {editableFields
          .filter((f: any) => f.type !== 'array')
          .map((f: any) => renderScalarField(f))}
      </div>

      <div className="space-y-6">
        {editableFields
          .filter((f: any) => f.type === 'array')
          .map((f: any) => (
            <ArrayFieldTable key={f.name} field={f} />
          ))}
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={disabled || isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
};

