'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui';
import { format, formatDistance } from 'date-fns';

interface TimelineEvent {
  type: string;
  source: 'guest' | 'log';
  created_at: string;
  trigger_reason?: string;
  referrer?: string;
  page_url?: string;
  platform?: string | null;
  device_type?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  [key: string]: any; // optional fallback for dynamic props
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userLabel: string;
  guestEvents: TimelineEvent[];
  userLogs: TimelineEvent[];
}

export function UserTimelineDialog({
  open,
  onClose,
  userId,
  userLabel,
  guestEvents,
  userLogs,
}: Props) {
  const [showAbsolute, setShowAbsolute] = useState(false);

  const allEvents = [...guestEvents, ...userLogs]
    .map((e) => ({
      ...e,
      timestamp: new Date(e.created_at),
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const origin = allEvents[0]?.timestamp ?? new Date();

  const emojiMap: Record<string, string> = {
    view: '👁️',
    click: '🚀',
    signup_complete: '✅',
    site_published: '📤',
  };

  const descriptions: Record<string, string> = {
    view: 'User opened the upgrade modal',
    click: 'User clicked “Sign Up” button',
    signup_complete: 'User completed sign up',
    site_published: 'User published a site',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Timeline for {userLabel}</DialogTitle>
          {guestEvents.length > 0 &&
            (() => {
              const firstView = guestEvents.find((e) => e.type === 'view');
              if (!firstView) return null;

              const ref = (firstView as any).referrer || '';
              const host = typeof window !== 'undefined' ? window.location.origin : '';
              const isInternal = ref.startsWith(host) || ref === '';

              const refColor = ref
                ? isInternal
                  ? 'text-green-600'
                  : 'text-red-600'
                : 'text-muted-foreground';

              const utmFields = [
                'utm_source',
                'utm_medium',
                'utm_campaign',
                'utm_term',
                'utm_content',
              ];

              return (
                <div className="text-sm text-muted-foreground space-y-1 border p-2 rounded bg-muted">
                  {firstView.trigger_reason && (
                    <div>
                      <strong>Trigger:</strong> {firstView.trigger_reason}
                    </div>
                  )}
                  <div>
                    <strong>Referrer:</strong> <span className={refColor}>{ref || 'none'}</span>
                  </div>
                  {(firstView as any).page_url && (
                    <div>
                      <strong>Page:</strong>{' '}
                      <a
                        href={(firstView as any).page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {(firstView as any).page_url}
                      </a>
                    </div>
                  )}
                  {utmFields
                    .filter((key) => (firstView as any)[key])
                    .map((key) => (
                      <div key={key}>
                        <strong>{key.replace('utm_', '').toUpperCase()}:</strong>{' '}
                        {(firstView as any)[key]}
                      </div>
                    ))}
                  {(firstView as any).page_url && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => window.open((firstView as any).page_url, '_blank')}
                    >
                      Open Page Context ↗
                    </Button>
                  )}
                </div>
              );
            })()}
        </DialogHeader>

        <div className="mb-2">
          <Button variant="outline" size="sm" onClick={() => setShowAbsolute(!showAbsolute)}>
            Toggle {showAbsolute ? 'Relative' : 'Absolute'} Timestamps
          </Button>
        </div>

        <div className="space-y-2 text-sm max-h-[400px] overflow-y-auto">
          <TooltipProvider>
            {allEvents.map((e, i) => {
              const prev = allEvents[i - 1]?.timestamp;
              const delta =
                prev && e.timestamp
                  ? formatDistance(e.timestamp, prev, { addSuffix: false })
                  : null;

              const deviceInfo =
                e.source === 'guest' && (e.user_agent || e.platform || e.device_type)
                  ? [e.platform, e.device_type].filter(Boolean).join(' • ') +
                    (e.user_agent ? `\n${e.user_agent}` : '')
                  : null;

              return (
                <div key={i} className="border-b pb-1">
                  <div className="flex justify-between items-start">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          {emojiMap[e.type] || '🔹'} {descriptions[e.type] || e.type}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{descriptions[e.type] || 'Event in user journey'}</p>
                      </TooltipContent>
                    </Tooltip>

                    <span className="text-muted-foreground text-xs">
                      {showAbsolute
                        ? format(e.timestamp, 'MMM d, yyyy HH:mm:ss')
                        : formatDistance(e.timestamp, origin, {
                            addSuffix: true,
                          })}
                    </span>
                  </div>

                  {delta && (
                    <div className="text-xs text-muted-foreground pl-4">
                      +{delta} since previous
                    </div>
                  )}

                  {deviceInfo && (
                    <div className="text-xs text-muted-foreground mt-1 pl-4 whitespace-pre-wrap">
                      {deviceInfo}
                    </div>
                  )}
                </div>
              );
            })}
          </TooltipProvider>

          {allEvents.length === 0 && (
            <div className="text-muted-foreground italic">No events found for this user.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
