import fs from 'fs';
import path from 'path';
import React from 'react';
import ScreenshotDashboard from '../../components/__screenshots__/ScreenshotDashboard';

export async function getStaticProps() {
  const dir = path.join(process.cwd(), 'public/__screenshots__');
  const branches = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => !name.startsWith('.'))
    : [];

  return {
    props: { branches },
  };
}

export default function Page({ branches }: { branches: string[] }) {
  return <ScreenshotDashboard branches={branches} />;
}
