// lib/editor/openSettingsPanel.ts
//
// Open the template editor's settings sidebar and scroll/spotlight a specific
// panel, from anywhere (block editors, other panels, deep-links).
//
// Why postMessage + a deferred CustomEvent:
//  - The sidebar's open state is toggled ONLY by template-editor-content's
//    `message` listener ({ type: 'qs:settings:set-open', open: true }). There is
//    no addEventListener('qs:settings:set-open', …), so a CustomEvent by that name
//    is a no-op — postMessage is the load-bearing call. (Posting to self is fine:
//    the editor and that listener share one window.)
//  - The sidebar registers its `qs:open-settings-panel` scroll listener only after
//    it mounts (a tick after the message opens it), so we defer that dispatch;
//    firing it synchronously would miss the not-yet-mounted listener.
//
// Scroll/spotlight is wired in sidebar-settings for 'identity', 'services', and
// 'hours'; other panel keys just open the sidebar (harmless no-op scroll).

export type SettingsPanelKey = 'identity' | 'services' | 'hours' | (string & {});

const MOUNT_DELAY_MS = 150;

export function openSettingsSidebarPanel(
  panel: SettingsPanelKey,
  opts?: { closeDrawer?: () => void },
): void {
  if (typeof window === 'undefined') return;
  try {
    // 0) Close any editor overlays stacked ABOVE the sidebar (Page Settings modal, a
    //    block-editor drawer, the header/footer editor). Without this, opening the
    //    sidebar behind an open modal leaves the user staring at the modal with no
    //    indication anything happened. The editor listens and closes them all except
    //    the sidebar itself. (closeDrawer below is a belt-and-suspenders no-op in the
    //    Page-Settings case, where the block editor's onClose is wired to () => {}.)
    window.dispatchEvent(new CustomEvent('qs:editor:close-overlays', { detail: { except: 'settings' } }));
    // 1) Open the sidebar (message bus — the only path that toggles it).
    window.postMessage({ type: 'qs:settings:set-open', open: true }, '*');
    // 2) After it mounts + registers its listener, ask it to scroll/spotlight.
    window.setTimeout(() => {
      try {
        window.dispatchEvent(
          new CustomEvent('qs:open-settings-panel', {
            detail: { panel, openEditor: true, scroll: true, spotlightMs: 900 },
          }),
        );
      } catch {}
    }, MOUNT_DELAY_MS);
  } catch {}
  // 3) Close the originating drawer (if any) so the sidebar is actually visible.
  opts?.closeDrawer?.();
}
