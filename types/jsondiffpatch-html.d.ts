declare module 'jsondiffpatch/formatters/html' {
  import type { Delta } from 'jsondiffpatch';

  export interface HtmlFormatter {
    format(delta: Delta, original: any, config?: Record<string, any>): string;
  }

  export const format: HtmlFormatter['format'];
}
