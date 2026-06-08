import React, { useMemo } from 'react';
import type { OrganizationStructureTree } from '../../../services/settingsService';
import { OrgStructureCheckboxTreeSelect } from '../../../components/admin/OrgStructureCheckboxTreeSelect';
import {
  formatOrgNodeOptionLabel,
  getActiveNodesUnderRoot,
} from '../../../utils/employeeOrgNodeLevels';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  MODULE_ACCESS_OPTIONS,
  type EmployeeMasterFormState,
} from './employeeMasterTypes';

type Props = {
  form: EmployeeMasterFormState;
  onChange: (patch: Partial<EmployeeMasterFormState>) => void;
  tree: OrganizationStructureTree | null | undefined;
  employees: Array<{ id: string; name: string; mobile: string }>;
  isEdit: boolean;
  showPassword?: boolean;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 py-4 dark:border-slate-700">{children}</div>
    </details>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-text-main">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}

export function EmployeeMasterFormSections({
  form,
  onChange,
  tree,
  employees,
  isEdit,
  showPassword,
}: Props) {
  const workLocationOptions = useMemo(() => {
    return getActiveNodesUnderRoot(tree)
      .filter((n) => n.status === 'active' && n.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tree]);

  const individualModules = MODULE_ACCESS_OPTIONS.filter((m) => m !== 'All');

  const hasAllModuleAccess = () =>
    form.permissions.moduleAccess.some((m) => String(m).toLowerCase() === 'all');

  const isModuleChecked = (mod: string) => {
    if (hasAllModuleAccess()) return true;
    return form.permissions.moduleAccess.includes(mod);
  };

  const toggleModule = (mod: string) => {
    const set = new Set(form.permissions.moduleAccess);

    if (mod === 'All') {
      if (hasAllModuleAccess()) {
        set.delete('All');
        onChange({
          permissions: { ...form.permissions, moduleAccess: Array.from(set) },
        });
        return;
      }
      onChange({
        permissions: {
          ...form.permissions,
          moduleAccess: [...MODULE_ACCESS_OPTIONS],
        },
      });
      return;
    }

    if (set.has(mod)) {
      set.delete(mod);
      set.delete('All');
    } else {
      set.add(mod);
      if (individualModules.every((m) => set.has(m))) {
        set.add('All');
      }
    }
    onChange({
      permissions: { ...form.permissions, moduleAccess: Array.from(set) },
    });
  };

  const patchRights = (key: 'edit' | 'delete', value: boolean) => {
    onChange({ permissions: { ...form.permissions, rights: { ...form.permissions.rights, [key]: value } } });
  };

  const patchTask = (key: keyof typeof form.permissions.taskRights, value: boolean) => {
    onChange({
      permissions: { ...form.permissions, taskRights: { ...form.permissions.taskRights, [key]: value } },
    });
  };

  const patchDoc = (key: 'upload' | 'view' | 'download', value: boolean) => {
    onChange({
      permissions: {
        ...form.permissions,
        documentRights: { ...form.permissions.documentRights, [key]: value },
      },
    });
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <Section title="1. Employee personal details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Employee ID</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.employeeCode}
              onChange={(e) => onChange({ employeeCode: e.target.value })}
              placeholder="Optional code"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Employee name *</label>
            <input
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Mobile number *</label>
            <input
              required={!isEdit}
              disabled={isEdit}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800"
              value={form.mobile}
              onChange={(e) => onChange({ mobile: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email ID</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">DOB</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.dateOfBirth}
              onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Gender</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.gender}
              onChange={(e) => onChange({ gender: e.target.value })}
            >
              <option value="">Select</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">PAN number</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
            value={form.panNumber}
            onChange={(e) => onChange({ panNumber: e.target.value.toUpperCase() })}
          />
        </div>
      </Section>

      <Section title="2. Employment details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Date of joining</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.dateOfJoining}
              onChange={(e) => onChange({ dateOfJoining: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Employment type</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.employmentType}
              onChange={(e) => onChange({ employmentType: e.target.value })}
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Employee status</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.status}
              onChange={(e) => onChange({ status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Designation</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.designation}
              onChange={(e) => onChange({ designation: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Reporting manager</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.reportingTo}
              onChange={(e) => onChange({ reportingTo: e.target.value })}
            >
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.mobile})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Physical work location (org unit)</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={form.workLocationNodeId}
              onChange={(e) => onChange({ workLocationNodeId: e.target.value })}
            >
              <option value="">Select from org structure</option>
              {workLocationOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {formatOrgNodeOptionLabel(tree, node)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="3. Org unit mapping">
        <OrgStructureCheckboxTreeSelect
          tree={tree}
          orgNodeByLevel={form.orgNodeByLevel}
          secondaryOrgNodeIds={form.secondaryOrgNodeIds}
          onChange={(patch) => onChange(patch)}
        />
      </Section>

      <Section title="4. Module access">
        <p className="text-xs text-slate-500">Which app areas this employee can open (web, mobile, and API).</p>
        <div className="flex flex-wrap gap-3">
          {MODULE_ACCESS_OPTIONS.map((mod) => (
            <CheckRow
              key={mod}
              label={mod}
              checked={isModuleChecked(mod)}
              onChange={() => toggleModule(mod)}
            />
          ))}
        </div>
      </Section>

      <Section title="5. Task permissions">
        <p className="text-xs text-slate-500">Applies when Tasks module is enabled. Enforced on web, mobile, and API.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <CheckRow label="Create task" checked={form.permissions.taskRights.createTask} onChange={(v) => patchTask('createTask', v)} />
          <CheckRow label="Assign task" checked={form.permissions.taskRights.assignTask} onChange={(v) => patchTask('assignTask', v)} />
          <CheckRow label="Reassign task" checked={form.permissions.taskRights.reassignTask} onChange={(v) => patchTask('reassignTask', v)} />
          <CheckRow label="Close / complete task" checked={form.permissions.taskRights.closeTask} onChange={(v) => patchTask('closeTask', v)} />
          <CheckRow label="Escalate (exit request)" checked={form.permissions.taskRights.escalateTask} onChange={(v) => patchTask('escalateTask', v)} />
          <CheckRow label="Edit task details" checked={form.permissions.rights.edit} onChange={(v) => patchRights('edit', v)} />
          <CheckRow label="Delete task" checked={form.permissions.rights.delete} onChange={(v) => patchRights('delete', v)} />
        </div>
      </Section>

      <Section title="6. Document permissions">
        <p className="text-xs text-slate-500">Applies when Documents module is enabled. Delete uses the same flag as delete task.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <CheckRow label="Upload / create" checked={form.permissions.documentRights.upload} onChange={(v) => patchDoc('upload', v)} />
          <CheckRow label="View list & detail" checked={form.permissions.documentRights.view} onChange={(v) => patchDoc('view', v)} />
          <CheckRow label="Download" checked={form.permissions.documentRights.download} onChange={(v) => patchDoc('download', v)} />
          <CheckRow label="Delete document" checked={form.permissions.rights.delete} onChange={(v) => patchRights('delete', v)} />
        </div>
      </Section>

      {showPassword ? (
        <div>
          <label className="mb-1 block text-sm font-medium">Password *</label>
          <input
            type="password"
            required
            minLength={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
            value={form.password}
            onChange={(e) => onChange({ password: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
