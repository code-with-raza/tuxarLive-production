export function Logo({
  size = 45,
  color,
  variant = "dark",
}: {
  size?: number;
  variant?: "light" | "dark";
  color?: string;
}) {
  const fill = color ?? (variant === "light" ? "#FFFFFF" : "#000000");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Tuxar"
      role="img"
    >
      <g fill={fill}>
        <polygon points="20,10 80,10 75,20 25,20" />
        <polygon points="10,35 65,35 60,45 15,45" />
        <polygon points="35,45 48,45 30,80 22,65" />
      </g>
    </svg>
  );
}
