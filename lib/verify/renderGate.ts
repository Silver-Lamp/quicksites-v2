// lib/verify/renderGate.ts
//
// The assertions, run against a rendered page rather than against anything that produced it.
//
// ⚠️ PURE. Nothing here touches a browser, a network or a database — it takes a RenderedPage and
// returns findings. That is what makes the rules testable without Chromium, which matters because
// a gate nobody can test is a gate that rots into a permanently-green row.
//
// The rule set is drawn from failures that actually shipped on a client's site, one rule per
// failure class:
//
//   copy_present     — the block's content lost to the template's, and the DB, the editor and
//                      every block-level check all read correct. (#1, #2)
//   order            — the fee disclosure rendered BELOW the control that took a visitor's
//                      invoice, on two of three variants. Text order and DOM index both said it
//                      was fine. (#4)
//   no_owner_strings — "⚠️ No renderer for block type" and raw JSON reached live pages. (#5, #6)
//   min_contrast     — a shared wrapper hard-coded text-white; invisible on a light tenant site,
//                      invisible to tsc, invisible to tests. (#3)
//
// ⚠️ A RULE THAT MATCHES NOTHING IS A FAILURE, NOT A PASS. `order` returns `inapplicable` when its
// "after" side is absent — an ordering rule about an upload control on a page with no upload
// control has not been satisfied, it has been skipped, and reporting that as ✅ is the exact
// silence-looks-like-success pattern this repo keeps tripping on.

import type { RenderedPage } from './extract';

export type Rule =
  | { kind: 'copy_present'; text: string; label?: string }
  | {
      kind: 'order';
      /** Text that must be met FIRST (substring, case-insensitive). */
      before: string;
      /** Control kinds that must come after — e.g. ['file', 'button']. */
      afterControls?: string[];
      /** …or text that must come after. */
      afterText?: string;
      label: string;
    }
  | { kind: 'no_owner_strings'; extra?: string[] }
  | { kind: 'min_contrast'; ratio?: number };

export type Finding = {
  rule: string;
  status: 'pass' | 'fail' | 'inapplicable';
  detail: string;
};

/**
 * Strings that are addressed to whoever BUILT the site, and must never reach a visitor.
 *
 * ⚠️ These are matched against VISIBLE TEXT, not HTML source. Every one of them is trivially
 * greppable — the reason they shipped is that nobody was grepping the right document.
 */
const OWNER_FACING = [
  'No renderer for block type',
  'Invalid block removed',
  'No services configured',
  'No social links yet',
  '[object Object]',
  'Lorem ipsum',
];

/**
 * Needles that are CASE-SENSITIVE TOKENS, not prose — matched with word boundaries and without
 * lowercasing.
 *
 * ⚠️ THIS SPLIT EXISTS BECAUSE THE GATE FAILED A CORRECT PAGE. `norm()` lowercases before
 * comparing, which is right for prose like "No services configured" and catastrophic for `NaN`:
 * lowercased it becomes `nan`, a substring of **multi-tenant**, financial, maintenance,
 * governance, covenant, tenancy. It fired on a published About-Me page whose only crime was
 * describing a multi-tenant platform — and "multi-tenant" is a word this codebase uses constantly.
 *
 * Same trap for `undefined` and `TODO`: "undefined" appears inside ordinary sentences about
 * undefined behaviour, and `todo` is a substring of nothing useful but lowercases into prose all
 * the same. A verifier's false positives are worse than its blind spots — a check that fires on
 * correct work trains you to skip its output, which is the silence-looks-like-success failure it
 * was built to prevent (CUSTOM_SITES §7c, second instance).
 */
const OWNER_FACING_TOKENS = ['NaN', 'undefined', 'TODO'];

function norm(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** First y-position at which a piece of text is visible, or -1. */
function yOfText(page: RenderedPage, needle: string): number {
  const n = norm(needle);
  for (const node of page.nodes) if (norm(node.text).includes(n)) return node.y;
  return -1;
}

export function runRules(page: RenderedPage, rules: Rule[]): Finding[] {
  const out: Finding[] = [];

  // ⚠️ Guard the whole run, not each rule. An extractor that returned an empty page would make
  // every copy_present rule fail and every order rule inapplicable — a confusing pile of findings
  // whose real cause is "nothing rendered". Say that once, plainly.
  if (!page.nodes.length) {
    return [{
      rule: 'rendered',
      status: 'fail',
      detail: `no visible text at ${page.url} — the page rendered nothing a visitor could read (scanned ${page.scanned.elements} elements)`,
    }];
  }

  for (const rule of rules) {
    switch (rule.kind) {
      case 'copy_present': {
        const y = yOfText(page, rule.text);
        out.push({
          rule: `copy_present:${rule.label ?? rule.text.slice(0, 40)}`,
          status: y >= 0 ? 'pass' : 'fail',
          detail:
            y >= 0
              ? `found at y=${y}`
              : `NOT on the rendered page: "${rule.text.slice(0, 90)}" — it may be in the block content and losing to something upstream`,
        });
        break;
      }

      case 'order': {
        const beforeY = yOfText(page, rule.before);
        let afterY = -1;
        let afterWhat = '';
        if (rule.afterText) {
          afterY = yOfText(page, rule.afterText);
          afterWhat = `"${rule.afterText.slice(0, 40)}"`;
        } else {
          const kinds = rule.afterControls ?? ['file'];
          const hit = page.controls.find((c) => kinds.some((k) => c.kind.includes(k)));
          if (hit) {
            afterY = hit.y;
            afterWhat = `the ${hit.kind} control${hit.text ? ` ("${hit.text.slice(0, 30)}")` : ''}`;
          }
        }

        if (afterY < 0) {
          // Skipped, not satisfied. See the module header.
          out.push({
            rule: `order:${rule.label}`,
            status: 'inapplicable',
            detail: `nothing matched the "after" side, so this rule proved nothing — it did not pass`,
          });
          break;
        }
        if (beforeY < 0) {
          out.push({
            rule: `order:${rule.label}`,
            status: 'fail',
            detail: `"${rule.before.slice(0, 60)}" is not on the page at all, but ${afterWhat} is (y=${afterY})`,
          });
          break;
        }
        out.push({
          rule: `order:${rule.label}`,
          status: beforeY < afterY ? 'pass' : 'fail',
          detail:
            beforeY < afterY
              ? `y=${beforeY} before ${afterWhat} at y=${afterY}`
              : `WRONG ORDER — the visitor reaches ${afterWhat} at y=${afterY} before reading "${rule.before.slice(0, 50)}" at y=${beforeY}`,
        });
        break;
      }

      case 'no_owner_strings': {
        const needles = [...OWNER_FACING, ...(rule.extra ?? [])];
        const hits: string[] = [];
        for (const node of page.nodes) {
          for (const n of needles) {
            if (norm(node.text).includes(norm(n))) hits.push(`"${n}" at y=${node.y} (${node.text.slice(0, 60)})`);
          }
          // Case-sensitive, word-bounded. See OWNER_FACING_TOKENS.
          for (const tok of OWNER_FACING_TOKENS) {
            if (new RegExp(`\\b${tok}\\b`).test(node.text)) {
              hits.push(`"${tok}" at y=${node.y} (${node.text.slice(0, 60)})`);
            }
          }
        }
        // Raw JSON reaching a visitor: a leaf text node that parses as an object/array.
        for (const node of page.nodes) {
          const t = node.text.trim();
          if (t.length > 12 && /^[[{]/.test(t) && /[}\]]$/.test(t)) {
            try {
              JSON.parse(t);
              hits.push(`raw JSON at y=${node.y} (${t.slice(0, 60)})`);
            } catch {
              /* prose that merely starts with a brace */
            }
          }
        }
        out.push({
          rule: 'no_owner_strings',
          status: hits.length ? 'fail' : 'pass',
          detail: hits.length ? hits.slice(0, 6).join('; ') : 'none of the builder-facing strings reached the page',
        });
        break;
      }

      case 'min_contrast': {
        const min = rule.ratio ?? 3;
        const bad = page.contrast.filter((c) => c.ratio < min);
        out.push({
          rule: `min_contrast:${min}`,
          status: bad.length ? 'fail' : 'pass',
          detail: bad.length
            ? bad.slice(0, 5).map((b) => `${b.ratio}:1 at y=${b.y} — "${b.text.slice(0, 50)}"`).join('; ')
            : `all ${page.nodes.length} visible text nodes clear ${min}:1`,
        });
        break;
      }
    }
  }

  return out;
}

/**
 * The default rule set for any published client site.
 *
 * ⚠️ The ordering rule is generic on purpose: ANY control that collects something from a visitor
 * must come after the fee disclosure. Written as "the bill upload" it would stop applying the day
 * a client's page collects something else, which is precisely when nobody would notice.
 */
export function defaultRules(opts: { mustContain?: string[]; disclosure?: string } = {}): Rule[] {
  const rules: Rule[] = [
    { kind: 'no_owner_strings' },
    { kind: 'min_contrast', ratio: 3 },
  ];
  for (const text of opts.mustContain ?? []) rules.push({ kind: 'copy_present', text });
  if (opts.disclosure) {
    rules.push({
      kind: 'order',
      before: opts.disclosure,
      afterControls: ['file', 'button', 'email', 'text'],
      label: 'disclosure before any control that collects from a visitor',
    });
  }
  return rules;
}

export function summarize(findings: Finding[]) {
  const fail = findings.filter((f) => f.status === 'fail');
  const inapplicable = findings.filter((f) => f.status === 'inapplicable');
  return {
    ok: fail.length === 0,
    failed: fail.length,
    // Surfaced separately and never folded into "pass" — a rule that proved nothing is not a rule
    // that succeeded, and the difference is the whole reason this field exists.
    inapplicable: inapplicable.length,
    passed: findings.filter((f) => f.status === 'pass').length,
  };
}
