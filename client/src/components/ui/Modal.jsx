import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(6,14,32,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-xl p-6"
        style={{
          background: 'rgba(19,27,46,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid #2d3449',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(152,218,39,0.05)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-5 pb-4"
          style={{ borderBottom: '1px solid #2d3449' }}
        >
          <h2
            className="font-headline text-base font-bold uppercase tracking-widest"
            style={{ color: '#98da27' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: '#8b93a8' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#dae2fd'; e.currentTarget.style.background = '#2d3449'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
