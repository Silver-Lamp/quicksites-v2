import fs from 'fs';
import path from 'path';

export async function getStaticProps() {
  const dir = path.join(process.cwd(), 'public/__screenshots__');
  const branches = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => !name.startsWith('.'))
    : [];

  return {
    props: { branches },
  };
}

export default function ScreenshotDashboard({
  branches,
}: {
  branches: string[];
}) {
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
