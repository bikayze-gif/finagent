import { forwardRef } from 'react';

const Select = forwardRef(function Select(
  { label, error, options = [], placeholder, className = '', ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: '#8b93a8' }}
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`w-full px-3 py-2.5 text-sm transition-all duration-150 outline-none cursor-pointer ${className}`}
        style={{
          background: '#0b1326',
          border: error ? '1px solid #ff5449' : '1px solid #2d3449',
          borderRadius: '0.25rem',
          color: '#dae2fd',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#98da27';
          e.target.style.boxShadow = '0 0 0 2px rgba(152,218,39,0.15)';
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#ff5449' : '#2d3449';
          e.target.style.boxShadow = 'none';
          if (props.onBlur) props.onBlur(e);
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs" style={{ color: '#ff5449' }}>{error}</p>}
    </div>
  );
});

export default Select;
