// lib/sales/laneSpec.ts
//
// A "lane" is one thing sold, one way, by phone: what it is, who picks up, what they push back
// with, and the claims a rep may not make. It is the single source behind BOTH halves of the
// sales-rehearsal work:
//
//   • the offline live-call flowchart at /for-sales/call (this repo), and
//   • the practice engine HiveJournal builds (crosstalk/contracts/rehearsal-engine.md),
//     which takes the lane as INPUT rather than hardcoding it.
//
// ⚠️ That second point is the whole design. The engine's honesty rule is a caller-supplied
// input, not a constant in its source — a recruiter's rule, ours, and a deck-seller's are
// different rules. Keeping the objections and the rules here means the branch a rep rehearsed
// is the branch they see mid-call, because both read the same ids.
//
// ⚠️ No archetype is ever a real prospect. See the contract §4: the engine must never learn
// who is being called. A named business owner agreed to nothing.

/** One thing a prospect says, and what to do about it. `id` is echoed back by the engine. */
export type Objection = {
  id: string;
  /** In their words, roughly as it actually arrives on a call. */
  says: string;
  /** The move. One sentence — this is read while someone is talking. */
  goodMove: string;
  /** The tempting wrong move. Reps lose calls here, not on the pitch. */
  trap: string;
};

/** A claim the rep may not make. Supplied to the engine; flagged in their own words. */
export type HonestyRule = {
  id: string;
  rule: string;
  why: string;
  /** Real phrasings that violate it — few-shot for the engine, examples for the rep. */
  violatingExamples: string[];
};

/** Who picks up. A type of person, never a person. */
export type Archetype = {
  id: string;
  label: string;
  traits: string[];
  mood: 'skeptical' | 'busy' | 'friendly' | 'hostile';
  openingState: string;
};

/** One beat of the call. The spine of the flowchart. */
export type CallStep = {
  id: string;
  label: string;
  /** What the rep is trying to make happen. Not a script to read aloud. */
  goal: string;
  /** Words that work, kept short enough to glance at mid-sentence. */
  say?: string;
};

export type LaneSpec = {
  id: string;
  label: string;
  /** What is being sold, in one sentence, the way you would say it out loud. */
  sells: string;
  /**
   * Names what the `grounding` text IS, in the engine's own honesty sentence:
   * "if the practiser states something that <groundingLabel> does not support ... flag it."
   *
   * ⚠️ Must be a phrase that reads grammatically in that slot — the default HJ falls back to is
   * "what they can actually back up", so a singular "what …" clause fits and a plural noun does
   * not. Capped at 120 chars their side.
   *
   * We set it rather than taking the default because the default is generic and this one names
   * the three things a rep actually over-claims about.
   */
  groundingLabel: string;
  /** The single outcome that counts as a win on this call. */
  goal: string;
  /** Claims a rep may make because they are true and checkable. */
  trueClaims: string[];
  steps: CallStep[];
  archetypes: Archetype[];
  objections: Objection[];
  honestyRules: HonestyRule[];
};

/**
 * The lane as the engine wants it — the snake_case JSON in
 * crosstalk/contracts/rehearsal-engine.md §1.
 *
 * It exists so the contract and this file cannot drift apart quietly: if HJ's shape changes,
 * this function stops matching the contract in one obvious place rather than in five call
 * sites. Deliberately drops `steps` and `trueClaims` — those drive our flowchart, and the
 * engine has no use for them.
 */
export function toEngineLaneSpec(lane: LaneSpec) {
  return {
    lane: { id: lane.id, label: lane.label, sells: lane.sells, goal: lane.goal },
    // Read off the spec ROOT (their `r.grounding_label`), not from inside `lane`. HJ had this
    // in the request envelope where nothing read it: every run silently used the default and
    // nothing ever errored — it would have looked correct indefinitely.
    grounding_label: lane.groundingLabel,
    archetypes: lane.archetypes.map((a) => ({
      id: a.id,
      label: a.label,
      traits: a.traits,
      mood: a.mood,
      opening_state: a.openingState,
    })),
    objections: lane.objections.map((o) => ({
      id: o.id,
      says: o.says,
      good_move: o.goodMove,
      trap: o.trap,
    })),
    honesty_rules: lane.honestyRules.map((r) => ({
      id: r.id,
      rule: r.rule,
      why: r.why,
      violating_examples: r.violatingExamples,
    })),
  };
}
