import type { NavigateFunction } from 'react-router-dom';

type ToastConfirm = {
  confirm: (
    message: string,
    options: {
      onConfirm: () => void;
      onCancel?: () => void;
      confirmLabel?: string;
      cancelLabel?: string;
    }
  ) => void;
};

/** Shows app confirm dialog: Yes logs out and navigates to /login. */
export function showLogoutConfirm(
  toast: ToastConfirm,
  logout: () => void | Promise<void>,
  navigate: NavigateFunction,
  options?: { onAfterConfirm?: () => void }
): void {
  toast.confirm('Do you want to log out?', {
    onConfirm: () => {
      options?.onAfterConfirm?.();
      void Promise.resolve(logout()).then(() => navigate('/login'));
    },
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });
}
