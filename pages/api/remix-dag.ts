export default async function handler(req, res) {
  // Example static data, replace with dynamic Supabase pull later
  const nodes = [
    { id: 'root', data: { label: '@alice' }, position: { x: 100, y: 100 } },
    { id: 'b1', data: { label: '@bob' }, position: { x: 300, y: 200 } },
    { id: 'c1', data: { label: '@carol' }, position: { x: 500, y: 300 } }
  ];
  const edges = [
    { id: 'e1', source: 'root', target: 'b1' },
    { id: 'e2', source: 'b1', target: 'c1' }
  ];
  res.status(200).json({ nodes, edges });
}
