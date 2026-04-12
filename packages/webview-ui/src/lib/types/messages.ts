import type { ColorThemeKind, Enum, Model, ModelConnection } from './schema';

/**
 * Typed message contract for the extension ↔ webview postMessage bridge.
 *
 * IMPORTANT — Runtime cast limitation:
 * Casting `event.data as ExtensionMessage` (or `WebviewMessage`) is a purely
 * structural, compile-time assertion. TypeScript does NOT validate the runtime
 * shape of postMessage payloads against these unions — a malformed or version-
 * skewed message will flow through unchecked and crash at the consumer.
 *
 * zod upgrade path (deferred to v2, tracked as DX-01):
 * Replace the cast with `ExtensionMessageSchema.parse(event.data)` using a zod
 * schema mirrored from this union. The manual union stays as the source of
 * truth; the schema is derived from it (e.g. via `z.discriminatedUnion`). This
 * keeps compile-time safety while adding runtime validation on the untrusted
 * boundary.
 */

/** Messages sent FROM the extension host TO the webview. */
export type ExtensionMessage =
  | {
      command: 'setData';
      models: Model[];
      connections: ModelConnection[];
      enums: Enum[];
    }
  | { command: 'setTheme'; theme: ColorThemeKind };

/** Messages sent FROM the webview TO the extension host. */
export type WebviewMessage =
  | { command: 'webviewReady' }
  | {
      command: 'saveImage';
      data: { format: string; dataUrl: string };
    };
