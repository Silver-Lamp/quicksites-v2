// Super-light mustache-style variable replacement.
// Usage: render("Hello {{name}}", {name: "world"}) => "Hello world"
// Also supports {{#hashtags}}…{{/hashtags}} (section shows only if value is non-empty string)
export function render(tpl: string | null | undefined, ctx: Record<string, any>): string {
    if (!tpl) return '';
    let out = tpl;
  
    // Sections: {{#key}}...{{/key}}
    out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, inner) => {
      const v = ctx[key];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'string' ? v : String(v);
      return s ? inner : '';
    });
  
    // Variables: {{key}}
    out = out.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
      const v = ctx[key];
      return v === null || v === undefined ? '' : String(v);
    });
  
    return out;
  }
  
  // Helpful default captions if no template is set
  export function defaultCaption(kind: 'drop'|'last_call'|'custom', ctx: Record<string, any>) {
    if (kind === 'drop') {
      return `🍽️ ${ctx.meal_title} is LIVE on ${ctx.site_name} — ${ctx.price}. Limited portions.`;
    }
    if (kind === 'last_call') {
      return `⏳ Last portions of ${ctx.meal_title} — ${ctx.price}. Grab yours now.`;
    }
    return `${ctx.meal_title} — ${ctx.price}`;
  }
  