import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast, ToastOptions } from 'react-hot-toast';

type ToastType = 'success' | 'error' | 'loading' | 'custom';

type UseFlashToastOptions = {
  type?: ToastType;
  prefix?: string;
  duration?: number;
  icon?: string;
  className?: string;
};

export function useFlashToast(
  key: string,
  { type = 'success', prefix = '', duration = 3000, icon, className }: UseFlashToastOptions = {}
) {
  const router = useRouter();
  const value = router.query[key];

  useEffect(() => {
    if (value && typeof value === 'string') {
      const message = `${prefix}${value}`;

      const toastOptions: ToastOptions = {
        duration,
        icon,
        className,
      };

      switch (type) {
        case 'error':
          toast.error(message, toastOptions);
          break;
        case 'loading':
          toast.loading(message, toastOptions);
          break;
        case 'custom':
          toast(message, toastOptions);
          break;
        default:
          toast.success(message, toastOptions);
      }

      // Remove the flash param from the URL
      const { [key]: _, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [value]);
}
