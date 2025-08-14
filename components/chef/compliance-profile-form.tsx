'use client';
import { useEffect, useState } from 'react';

export default function ComplianceProfileForm() {
  const [state, setState] = useState('CA');
  const [op, setOp] = useState<'MEHKO'|'COTTAGE'|'COMMERCIAL_KITCHEN'>('COTTAGE');
  const [county, setCounty] = useState('');
  const [mehkoCounties, setMehkoCounties] = useState<string[]>([]);

  useEffect(() => {
    if (state === 'CA') {
      fetch('/api/public/mehko/counties?state=CA').then(r=>r.json()).then(d=>setMehkoCounties(d.counties||[]));
    } else {
      setMehkoCounties([]);
    }
  }, [state]);

  const mehkoAllowed = state === 'CA' && mehkoCounties.length > 0;

  return (
    <div className="space-y-3">
      {/* state picker ... */}
      <div>
        <label className="text-sm font-medium">Operation type</label>
        <select
          className="border rounded-md px-2 py-1 text-sm"
          value={op}
          onChange={(e)=>setOp(e.target.value as any)}
        >
          <option value="COTTAGE">Cottage Food</option>
          <option value="COMMERCIAL_KITCHEN">Commercial kitchen</option>
          <option value="MEHKO" disabled={!mehkoAllowed}>MEHKO (home kitchen)</option>
        </select>
        {op === 'MEHKO' && state === 'CA' && (
          <p className="text-xs text-muted-foreground mt-1">
            MEHKO is county-specific. Select an opted-in county.
          </p>
        )}
      </div>

      {state === 'CA' && (
        <div>
          <label className="text-sm font-medium">County</label>
          <select
            className="border rounded-md px-2 py-1 text-sm"
            value={county}
            onChange={(e)=>setCounty(e.target.value)}
          >
            <option value="">Select…</option>
            {mehkoCounties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
