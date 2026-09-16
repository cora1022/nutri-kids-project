export default function Button({
  children,
  variant = 'primary', // primary | secondary | ghost | danger
  size = 'md', // md | lg
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
