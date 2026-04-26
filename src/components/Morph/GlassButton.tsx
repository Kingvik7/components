import s from "./GlassButton.module.css";

interface GlassButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export default function GlassButton({ onClick, children }: GlassButtonProps) {
  return (
    <button className={s.frostedGlass} onClick={onClick}>
      <span className={s.label}>{children}</span>
    </button>
  );
}
