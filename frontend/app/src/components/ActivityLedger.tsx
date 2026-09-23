import { Trash2 } from 'lucide-react';
import type { ActivityItem } from '@/lib/types';

interface ActivityLedgerProps {
  activity: ActivityItem[];
  onClear: () => void;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function ActivityLedger({ activity, onClear }: ActivityLedgerProps) {
  return (
    <div className="ledger" id="activity">
      <div className="ledger__head">
        <h3>Activity</h3>
        <button className="icon-btn" type="button" onClick={onClear} title="Clear activity">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="ledger__body">
        {activity.length ? activity.map((item) => (
          <div key={`${item.at}-${item.title}`} className={`ledger-item ${item.tone === 'error' ? 'is-error' : item.tone === 'success' ? 'is-success' : ''}`}>
            <div className="ledger-item__top">
              <div className="mini-item__name">{item.title}</div>
              <div className="label">{timeAgo(item.at)}</div>
            </div>
            <div className="ledger-item__meta">{item.detail || item.kind}</div>
          </div>
        )) : (
          <div className="empty-state">No activity yet.</div>
        )}
      </div>
    </div>
  );
}
