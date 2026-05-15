'use client';

import { useState } from 'react';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import AdminDataPanel from './AdminDataPanel';

/**
 * Collapsible admin panel for the home page.
 * Default: collapsed (just shows a small button).
 */
export default function HomeAdminToggle() {
    const [open, setOpen] = useState(false);

    return (
        <div style={{ margin: '20px 0' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    background: open ? 'var(--surface-strong)' : 'transparent',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '10px',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                }}
            >
                <Settings2 size={14} />
                {open ? 'Ẩn quản trị dữ liệu' : 'Quản trị dữ liệu / Sync / DB'}
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {open && (
                <div style={{ marginTop: '12px' }}>
                    <AdminDataPanel compact />
                </div>
            )}
        </div>
    );
}
