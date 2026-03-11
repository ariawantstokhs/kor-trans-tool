import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

export function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}
