const variantStyles = {
  primary: {
    background: '#98da27',
    color: '#213600',
    border: 'none',
  },
  secondary: {
    background: 'rgba(93,230,255,0.12)',
    color: '#5de6ff',
    border: '1px solid rgba(93,230,255,0.3)',
  },
  outline: {
    background: 'transparent',
    color: '#dae2fd',
    border: '1px solid #2d3449',
  },
  ghost: {
    background: 'transparent',
    color: '#8b93a8',
    border: 'none',
  },
  destructive: {
    background: 'rgba(255,84,73,0.15)',
    color: '#ff5449',
    border: '1px solid rgba(255,84,73,0.4)',
  },
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2 text-xs',
  lg: 'px-7 py-3 text-sm',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  style = {},
  disabled,
  ...props
}) {
  const variantStyle = variantStyles[variant] || variantStyles.primary;

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-bold uppercase tracking-widest
        rounded-full
        transition-all duration-150 cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        hover:brightness-110 active:scale-95
        ${sizeClasses[size]}
        ${className}
      `}
      style={{ ...variantStyle, ...style }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
