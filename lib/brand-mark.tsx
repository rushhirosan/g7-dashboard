type BrandMarkProps = {
  size: number;
  letter?: string;
};

export function BrandMark({ size, letter = "W" }: BrandMarkProps) {
  const radius = Math.round(size * (18 / 52));
  const fontSize = Math.round(size * 0.38);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
        color: "#ffffff",
        borderRadius: `${radius}px`,
        fontSize,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {letter}
    </div>
  );
}
