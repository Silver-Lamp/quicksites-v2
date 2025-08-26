// app/preview/preview-bridge.tsx
'use client';

import * as React from 'react';

export default function PreviewBridge() {
  React.useEffect(() => {
    // Only run when embedded in the editor (inside an iframe)
    try {
      if (typeof window === 'undefined' || window.self === window.top) return;
    } catch {
      return;
    }

    const getBlockEl = (el: Element | null): HTMLElement | null =>
      el instanceof HTMLElement ? (el.closest('[data-block-id]') as HTMLElement | null) : null;

    const getPathAttr = (el: Element | null): string | null =>
      (el instanceof HTMLElement
        ? (el.closest('[data-block-path]') as HTMLElement | null)?.getAttribute('data-block-path')
        : null) ?? null;

    const getContainer = (start: Element | null): HTMLElement | null => {
      if (!(start instanceof HTMLElement)) return null;
      return (
        (start.closest('#site-renderer-page') as HTMLElement | null) ||
        (document.querySelector('#site-renderer-page') as HTMLElement | null) ||
        (document.querySelector('main[data-page-idx]') as HTMLElement | null) ||
        (document.querySelector('main') as HTMLElement | null)
      );
    };

    const computePath = (blk: HTMLElement | null): string | null => {
      if (!blk) return null;
      const container = getContainer(blk);
      if (!container) return null;
      const pageIdx = Number(container.getAttribute('data-page-idx') ?? '0');
      const list = Array.from(container.querySelectorAll<HTMLElement>('[data-block-id]'));
      const blockIdx = list.indexOf(blk);
      if (blockIdx < 0) return null;
      return `${pageIdx}:${blockIdx}`;
    };

    const isInsideNoEdit = (el: Element | null): boolean =>
      !!(el && (el as HTMLElement).closest?.('[data-no-edit]'));

    type BridgeEvent = 'preview:edit-block' | 'preview:add-after' | 'preview:delete-block';

    function post(type: BridgeEvent, blkEl: HTMLElement | null) {
      if (!blkEl) return;
      const blockId = blkEl.getAttribute('data-block-id') ?? null;
      const blockPath = getPathAttr(blkEl) ?? computePath(blkEl);
      window.parent?.postMessage({ type, blockId, blockPath }, '*');
    }

    // --- Anchor interceptor: keep navigation inside /preview and preserve required params
    function handleAnchor(e: MouseEvent, t: HTMLElement): boolean {
      const a = t.closest('a[href]') as HTMLAnchorElement | null;
      if (!a) return false;

      // ignore modified / middle clicks or explicit non-self targets
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return false;
      if (a.target && a.target !== '' && a.target !== '_self') return false;

      const rawHref = a.getAttribute('href') || '';
      if (!rawHref) return false;
      if (rawHref.startsWith('#') || /^(mailto|tel):/i.test(rawHref)) return false;

      const cur = new URL(window.location.href);
      const target = new URL(rawHref, cur.origin);

      const hostEl = getContainer(t);
      const siteDomain = (hostEl?.getAttribute('data-site-domain') || '').toLowerCase();
      const siteSub = (hostEl?.getAttribute('data-site-subdomain') || '').toLowerCase();
      const thost = target.host.toLowerCase();

      // Internal if same-origin or matches site custom domain or default subdomain
      const internal =
        target.origin === cur.origin ||
        (siteDomain && thost === siteDomain) ||
        (siteSub && thost === siteSub);

      if (!internal) return false; // let true externals open normally

      e.preventDefault();

      // Build a /preview/<path> AND MERGE required params from current URL
      const rawPath = target.pathname || '/';
      const nextPath = rawPath.startsWith('/preview') ? rawPath : `/preview${rawPath}`;

      // Carry important params across navigations
      const curSp = new URLSearchParams(cur.search);
      const targetSp = new URLSearchParams(target.search);
      const keep = new URLSearchParams();

      const carryKeys = [
        'template_id',
        'preview_version_id',
        'editor',
        'mode',
        'industry',
      ];
      for (const k of carryKeys) {
        const v = curSp.get(k);
        if (v) keep.set(k, v);
      }
      // allow explicit query on the link to override/extend
      targetSp.forEach((v, k) => keep.set(k, v));

      const dest = `${nextPath}${keep.toString() ? `?${keep.toString()}` : ''}${target.hash || ''}`;

      // Navigate inside iframe
      window.location.assign(dest);

      // Tell parent (optional)
      const pageSlug = rawPath.replace(/^\/+/, '').split('/')[0] || 'home';
      window.parent?.postMessage({ type: 'preview:navigated', page: pageSlug }, '*');
      return true;
    }

    function handleClick(ev: MouseEvent) {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (isInsideNoEdit(t)) return;

      // 1) Anchor handling first (keeps params & stays in /preview)
      if (handleAnchor(ev, t)) return;

      // 2) Explicit chrome
      if (t.closest('[data-action="edit-header"]')) {
        window.parent?.postMessage({ type: 'preview:edit-header' }, '*');
        ev.preventDefault();
        return;
      }
      const editBtn = t.closest('[data-action="edit-block"]');
      if (editBtn) {
        post('preview:edit-block', getBlockEl(editBtn));
        ev.preventDefault();
        return;
      }
      const delBtn = t.closest('[data-action="delete-block"]');
      if (delBtn) {
        post('preview:delete-block', getBlockEl(delBtn));
        ev.preventDefault();
        return;
      }
      const addBtn = t.closest('[data-action="add-after"]');
      if (addBtn) {
        post('preview:add-after', getBlockEl(addBtn));
        ev.preventDefault();
        return;
      }

      // 3) Generic click on a block => edit
      const blkEl = getBlockEl(t);
      if (blkEl) post('preview:edit-block', blkEl);
    }

    // Color-mode updates from parent
    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'preview:set-color-mode') {
        const mode = d.mode === 'light' ? 'light' : 'dark';
        const html = document.documentElement;
        if (mode === 'dark') html.classList.add('dark');
        else html.classList.remove('dark');
        try { localStorage.setItem('qs:preview:color', mode); } catch {}
      }
    }

    // Large “+” injector (visible only on hover)
    const style = document.createElement('style');
    style.textContent = `
      .qs-block { position: relative; }
      .qs-add-btn {
        position: absolute;
        right: 14px;
        bottom: -28px;
        z-index: 50;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 72px;
        height: 72px;
        border-radius: 9999px;
        border: 1px solid rgba(0,0,0,.15);
        background: rgba(255,255,255,.95);
        color: #111;
        font-weight: 800;
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,.18);
        opacity: 0;
        transition: opacity .15s ease, transform .12s ease, box-shadow .12s ease;
      }
      .qs-block:hover .qs-add-btn { opacity: 1; }
      .qs-add-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.22); }
      .qs-add-btn:active { transform: translateY(0); box-shadow: 0 3px 12px rgba(0,0,0,.18); }
      html.dark .qs-add-btn {
        background: rgba(0,0,0,.65);
        color: #fff;
        border-color: rgba(255,255,255,.15);
      }
      html.dark .qs-add-btn:hover { background: rgba(0,0,0,.72); }
    `;
    document.head.appendChild(style);

    const observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>('[data-block-id]').forEach(block => {
        if (block.querySelector('[data-action="add-after"]')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qs-add-btn';
        btn.dataset.action = 'add-after';
        btn.title = 'Add block below';
        btn.setAttribute('aria-label', 'Add block below');
        btn.textContent = '+';
        block.appendChild(btn);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', handleClick, true);
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'preview:bridge-ready' }, '*');

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('message', onMessage);
      observer.disconnect();
      style.remove();
    };
  }, []);

  return null;
}
