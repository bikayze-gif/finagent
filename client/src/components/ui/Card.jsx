export default function Card({ children, className = '', style = {}, ...props }) {
  return (
    <div
      className={`rounded-xl p-6 ${className}`}
      style={{
        background: '#131b2e',
        border: '1px solid #2d3449',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
