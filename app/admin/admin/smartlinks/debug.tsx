import SmartLinkDebug from '@/components/admin/smart-link-debug';
import { SmartLinkProvider } from '@/components/admin/smart-link-provider';

export default function SmartLinkDebugPage() {
  return (
    <SmartLinkProvider>
      <main className="p-6 space-y-6 text-white">
        <h1 className="text-xl font-bold">🧪 SmartLink Debug Panel</h1>
        <p className="text-sm text-gray-400">
          This panel is also toggleable via <kbd>Shift</kbd> + <kbd>D</kbd>
        </p>
        <SmartLinkDebug />
      </main>
    </SmartLinkProvider>
  );
}
