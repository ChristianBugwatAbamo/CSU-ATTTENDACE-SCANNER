import React from 'react';
import HeaderTermSwitcher from './HeaderTermSwitcher';
import GlobalTermSelector from './GlobalTermSelector';

export default function Header({
  selectedTermId,
  setSelectedTermId,
  onSelectTerm,
  ...props
}) {
  const handleSelect = onSelectTerm || setSelectedTermId;

  return (
    <header className="top-header no-print print:hidden">
      <div className="page-title-group">
        <h2>CSU ROTC ATTENDANCE</h2>
        <p>Admin HQ Desktop</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Global Academic Term Dropdown Selector */}
        <HeaderTermSwitcher
          selectedTermId={selectedTermId}
          setSelectedTermId={setSelectedTermId}
          onSelectTerm={handleSelect}
        />

        {/* Live Date */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {new Date().toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      </div>
    </header>
  );
}

export { Header, HeaderTermSwitcher, GlobalTermSelector };
