'use client';
import { useTheme } from 'next-themes';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ThemedBarChart() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = {
    labels: ['Red', 'Blue', 'Yellow'],
    datasets: [
      {
        label: 'Votes',
        data: [12, 19, 3],
        backgroundColor: isDark ? 'var(--color-accent)' : 'var(--color-brand)',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: isDark ? 'white' : 'black',
        },
      },
    },
    scales: {
      x: { ticks: { color: isDark ? 'white' : 'black' } },
      y: { ticks: { color: isDark ? 'white' : 'black' } },
    },
  };

  return <Bar data={data} options={options} />;
}
