import React from 'react';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  footerLabel?: string;
  footerTitle?: string;
  onFooterClick?: () => void;
}

export const Modal = ({
  title,
  children,
  onClose,
  footerLabel,
  footerTitle,
  onFooterClick,
}: ModalProps) => {
  return (
    <div
      role="presentation"
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div role="dialog" className="modal-panel">
        <h3
          style={{
            margin: 0,
            marginBottom: '0.75rem',
            fontWeight: 800,
            fontSize: '1.1rem',
            textAlign: 'left',
          }}
        >
          {title}
        </h3>
        <div className="modal-body">{children}</div>
        {footerLabel && (
          <div className="modal-footer">
            <button
              type="button"
              className="app-button app-button--primary"
              onClick={onFooterClick || onClose}
              title={footerTitle}
            >
              {footerLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
