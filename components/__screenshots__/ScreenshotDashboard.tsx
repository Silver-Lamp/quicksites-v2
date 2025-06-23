// components/__screenshots__/ScreenshotDashboard.tsx

export default function ScreenshotDashboard({ branches }: { branches: string[] }) {
  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        padding: '2rem',
        background: '#111',
        color: '#eee',
      }}
    >
      <h1>📸 QuickSites Visual QA Dashboard</h1>
      <ul>
        {branches.map((branch) => (
          <li key={branch}>
            <a
              href={`/__screenshots__/${branch}`}
              style={{ color: '#66f' }}
              target="_blank"
              rel="noreferrer"
            >
              {branch}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
