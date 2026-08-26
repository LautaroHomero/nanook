declare var process: {
  env: Record<string, string | undefined>;
};

declare module 'react' {
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export type ReactNode = any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'next/navigation' {
  export function useRouter(): {
    push: (href: string) => void;
  };
}

declare module '*.css' {
  const css: Record<string, string>;
  export default css;
}
