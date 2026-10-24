import React from 'react';

export default function TopBanner({ message, actionText, onActionClick }) {
  if (!message) return null;

  return (
    <div className="ann" id="ann">
      {message}
      {actionText && (
        <button
          type="button"
          onClick={onActionClick}
          tabIndex={0}
          role="link"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
