export function generateServices(templateId: string) {
  if (templateId.includes('tow')) {
    return [
      'Roadside Assistance',
      'Towing & Recovery',
      'Battery Jump Start',
      'Lockout Service',
      'Winch-Outs',
    ];
  }

  if (templateId.includes('plumb')) {
    return [
      'Leak Detection',
      'Drain Cleaning',
      'Water Heater Install',
      'Toilet Repair',
      'Pipe Replacement',
    ];
  }

  return ['Consulting', 'Installation', 'Support', 'Upgrades', 'Maintenance'];
}
