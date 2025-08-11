// constants/blockSchemas.ts
// UI settings for blocks.
export const BLOCK_SETTING_SCHEMAS: Record<
  string,
  {
    [key: string]: {
      type: 'text' | 'number' | 'boolean' | 'select';
      label?: string;
      default?: any;
      options?: string[];
      min?: number;
      max?: number;
      step?: number;
      group?: string;
      description?: string;
    };
  }
> = {
  retention: {
    granularity: {
      type: 'select',
      label: 'Granularity',
      options: ['daily', 'weekly', 'monthly'],
      default: 'weekly',
      group: 'Display Options',
      description: 'Controls how retention is grouped over time.',
    },
    showChart: {
      type: 'boolean',
      label: 'Show Chart',
      default: true,
      group: 'Display Options',
      description: 'Toggles whether to render the retention chart.',
    },
  },

  traffic: {
    chartType: {
      type: 'select',
      label: 'Chart Type',
      options: ['line', 'bar', 'area'],
      default: 'line',
      group: 'Appearance',
      description: 'Visual style of the traffic chart.',
    },
    maxDataPoints: {
      type: 'number',
      label: 'Max Data Points',
      default: 30,
      min: 10,
      max: 100,
      step: 5,
      group: 'Limits',
      description: 'Controls how many time buckets to display.',
    },
  },

  engagement: {
    threshold: {
      type: 'number',
      label: 'Engagement Threshold',
      default: 75,
      min: 0,
      max: 100,
      step: 1,
      group: 'Scoring',
      description: 'Score value above which a user is marked highly engaged.',
    },
    labelStyle: {
      type: 'select',
      label: 'Label Style',
      options: ['short', 'detailed'],
      default: 'short',
      group: 'Text Display',
      description: 'Affects how user labels appear under bars or lines.',
    },
  },

  activity: {
    grouping: {
      type: 'select',
      label: 'Time Grouping',
      options: ['hourly', 'daily', 'weekly'],
      default: 'daily',
      group: 'Aggregation',
      description: 'Sets the time resolution for activity chart data.',
    },
    colorize: {
      type: 'boolean',
      label: 'Enable Color Zones',
      default: true,
      group: 'Style',
      description: 'Colorizes activity zones based on thresholds.',
    },
    dataSampleSize: {
      type: 'number',
      label: 'Sample Size',
      default: 50,
      min: 10,
      max: 500,
      step: 10,
      group: 'Data',
      description: 'Maximum data rows shown in visualization.',
    },
  },
};
