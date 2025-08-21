'use client';
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Printer, Save, Sparkles } from "lucide-react";

/**
 * delivered.menu — New Chef Costs Calculator
 * -------------------------------------------------------
 * Drop this component anywhere (e.g., /app/chef/onboarding/costs/page.tsx)
 * and default export it. Tailwind + shadcn/ui + lucide-react.
 *
 * Goal: give chefs a clear estimate of startup + recurring costs,
 * with knobs for jurisdiction, operation type, headcount for training,
 * packaging starter kit, and optional gear. Generates a shareable link
 * from current selections and can print a one-pager.
 *
 * Disclaimer: numbers here are sensible defaults. You can wire in
 * jurisdictional data from your DB later (e.g., compliance_requirements
 * and county-specific fees) by swapping the constants below.
 */

// ---------- Helpers ----------
const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// ---------- Domain model (defaults you can tune) ----------
const TRAINING = {
  // Per person Food Handler (3-year typical in CA; accredited course)
  FOOD_HANDLER_PER_PERSON_CENTS: 1000, // $10 default
  // NYC Food Protection Certificate exam fee
  NYC_FPC_EXAM_CENTS: 2400, // $24
};

const INSURANCE_PLANS = [
  { id: "basic", label: "Basic GL + Product ($1M/$2M)", annualCents: 29900 },
  { id: "plus", label: "Plus (higher limits / add-ons)", annualCents: 39900 },
];

const PACKAGING_PRESETS = [
  { meals: 50, label: "50 meals" },
  { meals: 100, label: "100 meals" },
  { meals: 200, label: "200 meals" },
];

const DEFAULTS = {
  // Permit estimates (enter real values or fetch per-county)
  MEHKO_ANNUAL_PERMIT_CENTS: 40000, // $400 default (varies by county)
  COMMERCIAL_PERMIT_EST_CENTS: 60000, // $600 placeholder
  COMMISSARY_DEPOSIT_CENTS: 20000, // $200
};

// ---------- Types ----------
type StateCode = "CA" | "TX" | "NY" | "OTHER";
type OpType = "MEHKO" | "COTTAGE" | "HOME_PROCESSOR" | "COMMERCIAL_KITCHEN";

// ---------- Component ----------
export default function NewChefCostsCalculator() {
  // Selections
  const [state, setState] = useState<StateCode>("CA");
  const [nyc, setNyc] = useState(false); // applies only if state === 'NY'
  const [op, setOp] = useState<OpType>("COTTAGE");
  const [people, setPeople] = useState(1); // # needing food-handler training

  const [insuranceId, setInsuranceId] = useState(INSURANCE_PLANS[0].id);
  const insuranceAnnualCents = useMemo(
    () => INSURANCE_PLANS.find(p => p.id === insuranceId)?.annualCents ?? INSURANCE_PLANS[0].annualCents,
    [insuranceId]
  );

  const [kitMeals, setKitMeals] = useState(PACKAGING_PRESETS[1].meals); // default 100
  const [perMealPackagingCents, setPerMealPackagingCents] = useState(60); // $0.60 default; 35–85 typical

  const [includeLabelPrinter, setIncludeLabelPrinter] = useState(false);
  const [includeGear, setIncludeGear] = useState(true); // scale, probes, PPE bundle
  const [commissaryDepositCents, setCommissaryDepositCents] = useState(DEFAULTS.COMMISSARY_DEPOSIT_CENTS);
  const [permitCents, setPermitCents] = useState(DEFAULTS.MEHKO_ANNUAL_PERMIT_CENTS);

  // Derive allowed operation types by state
  const opOptions: Array<{ value: OpType; label: string; disabled?: boolean }> = useMemo(() => {
    const base: Array<{ value: OpType; label: string; disabled?: boolean }> = [];
    if (state === "CA") base.push({ value: "COTTAGE", label: "Cottage Food" }, { value: "MEHKO", label: "MEHKO (home kitchen)" }, { value: "COMMERCIAL_KITCHEN", label: "Commercial kitchen" });
    else if (state === "TX") base.push({ value: "COTTAGE", label: "Cottage Food" }, { value: "COMMERCIAL_KITCHEN", label: "Commercial kitchen" });
    else if (state === "NY") base.push({ value: "HOME_PROCESSOR", label: "Home Processor (NY)" }, { value: "COMMERCIAL_KITCHEN", label: nyc ? "NYC commercial kitchen" : "Commercial kitchen" });
    else base.push({ value: "COMMERCIAL_KITCHEN", label: "Commercial kitchen" }, { value: "COTTAGE", label: "Home-based (check local)" });
    return base;
  }, [state, nyc]);

  // Adjust defaults when state/op changes
  useEffect(() => {
    // Update default permit estimate based on op
    if (op === "MEHKO") setPermitCents(DEFAULTS.MEHKO_ANNUAL_PERMIT_CENTS);
    else if (op === "COMMERCIAL_KITCHEN") setPermitCents(DEFAULTS.COMMERCIAL_PERMIT_EST_CENTS);
    else setPermitCents(0);
  }, [op]);

  // Costs calculation
  const costs = useMemo(() => {
    const items: { key: string; label: string; cents: number; recurring?: "annual" | "per-meal" }[] = [];

    // Training
    const fhCents = TRAINING.FOOD_HANDLER_PER_PERSON_CENTS * clamp(people, 0, 50);
    if (fhCents > 0) items.push({ key: "training_fh", label: `Food Handler training × ${people}`, cents: fhCents });

    const needsNYCFPC = state === "NY" && nyc && op === "COMMERCIAL_KITCHEN";
    if (needsNYCFPC) items.push({ key: "training_nyc_fpc", label: "NYC Food Protection Certificate (manager exam)", cents: TRAINING.NYC_FPC_EXAM_CENTS });

    // Permits (annual)
    if (permitCents > 0) {
      const label = op === "MEHKO" ? "MEHKO permit (annual)" : op === "COMMERCIAL_KITCHEN" ? "Commercial kitchen permit (est., annual)" : "Permit/registration";
      items.push({ key: "permit", label, cents: permitCents, recurring: "annual" });
    }

    // Insurance (annual)
    items.push({ key: "ins", label: INSURANCE_PLANS.find(p => p.id === insuranceId)?.label || "Insurance", cents: insuranceAnnualCents, recurring: "annual" });

    // Packaging starter kit (upfront; variable per-meal ongoing)
    const kitCents = kitMeals * perMealPackagingCents;
    items.push({ key: "pack_kit", label: `Packaging starter kit (${kitMeals} meals @ ${fmt(perMealPackagingCents)}/meal)`, cents: kitCents });

    // Optional gear (upfront)
    if (includeLabelPrinter) items.push({ key: "label_printer", label: "Label printer", cents: 10000 }); // $100
    if (includeGear) items.push({ key: "gear_bundle", label: "Scale + thermometers + PPE + test strips", cents: 8000 }); // $80

    // Commissary deposit (if commercial)
    if (op === "COMMERCIAL_KITCHEN" && commissaryDepositCents > 0) items.push({ key: "commissary_dep", label: "Commissary deposit/onboarding", cents: commissaryDepositCents });

    // Summaries
    const upfront = items.filter(i => !i.recurring).reduce((a, b) => a + b.cents, 0);
    const annual = items.filter(i => i.recurring === "annual").reduce((a, b) => a + b.cents, 0);
    const perMeal = perMealPackagingCents; // packaging is the main per-meal variable here

    // Example batch summary: first 100 meals
    const first100 = upfront + annual + 100 * perMeal;

    return { items, upfront, annual, perMeal, first100 };
  }, [people, state, nyc, op, permitCents, insuranceId, insuranceAnnualCents, kitMeals, perMealPackagingCents, includeLabelPrinter, includeGear, commissaryDepositCents]);

  // Shareable link
  const makeShareUrl = () => {
    const url = new URL(typeof window !== "undefined" ? window.location.href : "https://delivered.menu/chef/onboarding/costs");
    url.searchParams.set("state", state);
    url.searchParams.set("nyc", nyc ? "1" : "0");
    url.searchParams.set("op", op);
    url.searchParams.set("people", String(people));
    url.searchParams.set("ins", insuranceId);
    url.searchParams.set("kitMeals", String(kitMeals));
    url.searchParams.set("perMeal", String(perMealPackagingCents));
    url.searchParams.set("permit", String(permitCents));
    url.searchParams.set("commissary", String(commissaryDepositCents));
    url.searchParams.set("lbl", includeLabelPrinter ? "1" : "0");
    url.searchParams.set("gear", includeGear ? "1" : "0");
    return url.toString();
  };

  // Hydrate from URL on first load for shareable presets
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("state") as StateCode | null; if (s) setState(s);
    const n = sp.get("nyc"); if (n) setNyc(n === "1");
    const o = sp.get("op") as OpType | null; if (o) setOp(o);
    const p = parseInt(sp.get("people") || ""); if (!Number.isNaN(p)) setPeople(clamp(p, 0, 50));
    const ins = sp.get("ins"); if (ins) setInsuranceId(ins);
    const km = parseInt(sp.get("kitMeals") || ""); if (!Number.isNaN(km)) setKitMeals(km);
    const pm = parseInt(sp.get("perMeal") || ""); if (!Number.isNaN(pm)) setPerMealPackagingCents(clamp(pm, 20, 150));
    const pc = parseInt(sp.get("permit") || ""); if (!Number.isNaN(pc)) setPermitCents(clamp(pc, 0, 500000));
    const cd = parseInt(sp.get("commissary") || ""); if (!Number.isNaN(cd)) setCommissaryDepositCents(clamp(cd, 0, 1000000));
    const lbl = sp.get("lbl"); if (lbl) setIncludeLabelPrinter(lbl === "1");
    const gr = sp.get("gear"); if (gr) setIncludeGear(gr === "1");
  }, []);

  const share = async () => {
    const link = makeShareUrl();
    await navigator.clipboard.writeText(link);
    alert("Shareable link copied to clipboard");
  };

  const printPage = () => window.print();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5" />
        <h1 className="text-2xl font-semibold">New Chef Costs — quick estimate</h1>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Setup</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* State */}
          <div>
            <Label>State</Label>
            <Select value={state} onValueChange={(v) => setState(v as StateCode)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CA">California</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="OTHER">Other (estimate)</SelectItem>
              </SelectContent>
            </Select>
            {state === "NY" && (
              <div className="mt-2 flex items-center gap-2">
                <Switch id="nyc" checked={nyc} onCheckedChange={setNyc} />
                <Label htmlFor="nyc">I'm operating in NYC</Label>
              </div>
            )}
          </div>

          {/* Operation type */}
          <div>
            <Label>Operation type</Label>
            <Select value={op} onValueChange={(v) => setOp(v as OpType)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {opOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {op === "MEHKO" && state === "CA" && (
              <p className="text-xs text-muted-foreground mt-2">MEHKO availability is county-specific. Permit estimates vary; enter your county's amount below.</p>
            )}
          </div>

          {/* People to train */}
          <div>
            <Label>People needing Food Handler training</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} max={50} value={people} onChange={(e) => setPeople(clamp(parseInt(e.target.value || "0"), 0, 50))} />
              <Badge variant="secondary">~{fmt(TRAINING.FOOD_HANDLER_PER_PERSON_CENTS)} each</Badge>
            </div>
          </div>

          {/* Insurance */}
          <div>
            <Label>Insurance plan</Label>
            <Select value={insuranceId} onValueChange={setInsuranceId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {INSURANCE_PLANS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">Annual; includes Additional Insured endorsement requirement.</p>
          </div>

          {/* Permit cost */}
          <div>
            <Label>{op === "MEHKO" ? "MEHKO annual permit" : op === "COMMERCIAL_KITCHEN" ? "Commercial permit (est., annual)" : "Permit/registration"}</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} value={permitCents} onChange={(e) => setPermitCents(clamp(parseInt(e.target.value || "0"), 0, 500000))} />
              <span className="text-sm text-muted-foreground">cents</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Enter the latest fee in cents (e.g., 40000 for $400). Set 0 if not required.</p>
          </div>

          {/* Commissary deposit (commercial only) */}
          {op === "COMMERCIAL_KITCHEN" && (
            <div>
              <Label>Commissary deposit / onboarding (upfront)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} value={commissaryDepositCents} onChange={(e) => setCommissaryDepositCents(clamp(parseInt(e.target.value || "0"), 0, 1000000))} />
                <span className="text-sm text-muted-foreground">cents</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Packaging & gear</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Starter kit size</Label>
            <Select value={String(kitMeals)} onValueChange={(v) => setKitMeals(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent>
                {PACKAGING_PRESETS.map(k => (
                  <SelectItem key={k.meals} value={String(k.meals)}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Per-meal packaging cost</Label>
            <div className="mt-2">
              <Slider min={20} max={150} step={5} value={[perMealPackagingCents]} onValueChange={(v) => setPerMealPackagingCents(v[0] ?? 60)} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>$0.20</span><span>Now: <b>{fmt(perMealPackagingCents)}</b></span><span>$1.50</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Typical range $0.35–$0.85 depending on size/eco options.</p>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="gear" checked={includeGear} onCheckedChange={setIncludeGear} />
            <Label htmlFor="gear">Include gear bundle (scale, probes, PPE)</Label>
            <Badge variant="secondary" className="ml-auto">$80</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="label" checked={includeLabelPrinter} onCheckedChange={setIncludeLabelPrinter} />
            <Label htmlFor="label">Include label printer</Label>
            <Badge variant="secondary" className="ml-auto">$100</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Estimate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-3 bg-muted/30">
              <div className="text-sm font-medium">Upfront (one-time)</div>
              <div className="text-2xl font-semibold">{fmt(costs.upfront)}</div>
              <div className="text-xs text-muted-foreground">Includes training, starter kit, gear, deposits.</div>
            </div>
            <div className="rounded-xl border p-3 bg-muted/30">
              <div className="text-sm font-medium">Recurring (annual)</div>
              <div className="text-2xl font-semibold">{fmt(costs.annual)}</div>
              <div className="text-xs text-muted-foreground">Insurance + any annual permits.</div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">Per-meal variable (packaging)</div>
              <div className="text-lg font-semibold">{fmt(costs.perMeal)}</div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Other per-meal costs (ingredients, labor, delivery) are not included here.</div>
          </div>

          <div className="rounded-xl border p-3 bg-emerald-50">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Example: first 100 meals</div>
              <div className="text-xl font-semibold">{fmt(costs.first100)}</div>
            </div>
            <div className="text-xs text-emerald-900 mt-1">Upfront + annual + (100 × per-meal packaging)</div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border overflow-hidden">
              <div className="px-3 py-2 text-sm font-medium bg-muted/40">Line items</div>
              <div className="divide-y">
                {costs.items.map(i => (
                  <div key={i.key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{i.label}{i.recurring ? <span className="ml-2 text-xs text-muted-foreground">({i.recurring})</span> : null}</span>
                    <span className="font-medium">{fmt(i.cents)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Pro tip: If you leave a review incentive active (e.g., 10% off next order), include its expected redemption rate in your margin model, not here.</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={share}><Copy className="h-4 w-4 mr-2"/>Copy shareable link</Button>
                <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-2"/>Print one-pager</Button>
                {/* Optional: persist to profile */}
                {/* <Button onClick={saveToProfile}><Save className="h-4 w-4 mr-2"/>Save to my profile</Button> */}
              </div>
              <div className="text-xs text-muted-foreground">
                Estimates only — verify current fees with your local health department and insurer. Packaging pricing reflects bulk-purchase pass-throughs.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
