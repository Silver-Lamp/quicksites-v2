export function parseHashtags(input?: string | null): string[] {
    if (!input) return [];
    // split on commas or whitespace
    const raw = input.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    // normalize: lowercase, prefix '#', strip leading '#'
    const tags = raw.map(t => {
      const clean = t.replace(/^#+/, '').toLowerCase();
      // keep only a-z0-9 and dashes
      const safe = clean.replace(/[^a-z0-9-]/g, '');
      return safe ? `#${safe}` : '';
    }).filter(Boolean);
    // de-dup preserve order
    const seen = new Set<string>();
    return tags.filter(t => (seen.has(t) ? false : (seen.add(t), true)));
  }
  
  export function composeHashtags(opts: {
    base?: string[];           // e.g. ['localfood','homemade']
    cuisines?: string[];       // ['Thai','Vegan'] → '#thai', '#vegan'
    connectorDefault?: string; // text field from social_webhooks.default_hashtags
    mealHashtags?: string;     // text field from meals.hashtags
    mode?: 'append'|'replace'; // meals.hashtags_mode
    cap?: number;              // limit total count (default 6)
  }): string {
    const cap = opts.cap ?? 6;
  
    const base = (opts.base ?? []).map(t => `#${t.toLowerCase().replace(/[^a-z0-9-]/g,'')}`);
    const fromCuisines = (opts.cuisines ?? [])
      .map(c => `#${c.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}`);
  
    const fromConnector = parseHashtags(opts.connectorDefault);
    const fromMeal = parseHashtags(opts.mealHashtags);
  
    let combined: string[];
    if (opts.mode === 'replace' && fromMeal.length) {
      // meal fully overrides
      combined = fromMeal;
    } else {
      combined = [...base, ...fromCuisines, ...fromConnector, ...fromMeal];
    }
  
    // de-dup while preserving order
    const seen = new Set<string>();
    const unique = combined.filter(t => (seen.has(t) ? false : (seen.add(t), true)));
  
    // cap the list
    return unique.slice(0, cap).join(' ');
  }
  