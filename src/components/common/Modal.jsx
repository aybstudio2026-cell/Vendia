import React, { useEffect, useRef } from 'react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 480,
  className = '',
  style = {},
  contentStyle = {},
  centerTitle = false,
  titleStyle = {}
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Cerrar con Escape o haciendo clic fuera del contenido (backdrop)
  const handleClick = (e) => {
    const dialog = dialogRef.current;
    if (dialog && e.target === dialog) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`no-scrollbar ${className}`}
      style={{
        width: `min(${maxWidth}px, calc(100% - 24px))`,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        ...style
      }}
    >
      <div
        className="dlg no-scrollbar"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          ...contentStyle
        }}
      >
        {title && (
          <h2 style={{ ...(centerTitle ? { textAlign: 'center' } : {}), ...titleStyle }}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </dialog>
  );
}
