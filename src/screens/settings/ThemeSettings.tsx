import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';

const THEME_STORAGE_KEY = '@orgit_theme';

export const ThemeSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [systemTheme, setSystemTheme] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = () => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        const themeData = JSON.parse(savedTheme);
        setTheme(themeData.theme || 'light');
        setSystemTheme(themeData.systemTheme || false);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const saveTheme = (newTheme: 'light' | 'dark', useSystem: boolean) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({
        theme: newTheme,
        systemTheme: useSystem,
      }));

      // Apply theme immediately
      if (useSystem) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      } else {
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      }

      setTheme(newTheme);
      setSystemTheme(useSystem);
    } catch (error) {
      console.error('Error saving theme:', error);
      alert('Failed to save theme preference');
    }
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: 'light_mode', description: 'Light background with dark text' },
    { value: 'dark' as const, label: 'Dark', icon: 'dark_mode', description: 'Dark background with light text' },
  ];

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mb-6">Theme Settings</h1>

        <div className="space-y-6">
          {/* System Theme Toggle */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="material-icons-outlined text-primary">phone_android</span>
              </div>
              <div>
                <p className="font-semibold text-text-main-light dark:text-text-main-dark">Use System Theme</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Automatically match your device's theme setting</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={systemTheme}
                onChange={(e) => saveTheme(theme, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Theme Options */}
          {!systemTheme && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Choose Theme</p>
              <div className="space-y-3">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => saveTheme(option.value, false)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                      theme === option.value
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        theme === option.value ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <span className={`material-icons-outlined text-2xl ${
                          theme === option.value ? 'text-primary' : 'text-gray-500'
                        }`}>
                          {option.icon}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-text-main-light dark:text-text-main-dark">{option.label}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{option.description}</p>
                      </div>
                    </div>
                    {theme === option.value && (
                      <span className="material-icons-outlined text-primary">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <span className="material-icons-outlined text-gray-500">info</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Theme changes are applied immediately. You may need to refresh the page to see all changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <EmployeeLayout>{content}</EmployeeLayout>;
};

