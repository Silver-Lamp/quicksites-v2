'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let emaArray = [];
  data.forEach((value, i) => {
    if (i === 0) {
      emaArray.push(value.value);
    } else {
      emaArray.push(value.value * k + emaArray[i - 1] * (1 - k));
    }
  });
  return emaArray;
}

export default function MACDTrend({ slug }: { slug: string }) {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    fetch('/api/checkins-trend?slug=' + slug)
      .then(res => res.json())
      .then((raw) => {
        const data = raw.map((d, i) => ({ date: d.date, value: d.count }));
        const ema7 = calculateEMA(data, 7);
        const ema30 = calculateEMA(data, 30);
        setPoints(data.map((d, i) => ({
          ...d,
          ema7: parseFloat(ema7[i].toFixed(2)),
          ema30: parseFloat(ema30[i].toFixed(2))
        })));
      });
  }, [slug]);

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <XAxis dataKey="date" tick={{ fill: '#888' }} />
          <YAxis tick={{ fill: '#888' }} />
          <Tooltip />
          <Line type="monotone" dataKey="ema7" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ema30" stroke="#3b82f6" strokeWidth={1} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
