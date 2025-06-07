export function AdminClaimOverride({ domain }: { domain: string }) {
  const markUnclaimed = async () => {
    await fetch('/api/admin/unclaim-site', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
    alert('Unclaimed for override.');
    location.reload();
  };

  return (
    <button
      onClick={markUnclaimed}
      className="text-xs bg-red-800 px-3 py-1 rounded text-white mt-2"
    >
      Force Unclaim
    </button>
  );
}
