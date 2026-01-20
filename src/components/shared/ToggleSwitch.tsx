import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  id = 'toggle',
}) => {
  return (
    <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
      <input
        type="checkbox"
        id={id}
        name={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:border-primary transition-all duration-300 z-10"
      />
      <label
        htmlFor={id}
        className={`toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer ${
          checked ? 'bg-primary' : ''
        }`}
      />
      {label && (
        <label htmlFor={id} className="ml-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
};

