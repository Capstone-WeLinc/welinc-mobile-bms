import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const });

export function HomeIcon({ size = 26, color = "#ffffff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 26, color = "#ffffff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 7.5V12l3 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ListIcon({ size = 26, color = "#ffffff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 8.5h.01M8 12h.01M8 15.5h.01M11 8.5h5.5M11 12h5.5M11 15.5h5.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function DocumentIcon({ size = 26, color = "#ffffff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M6 3.5h8.5L18.5 7.5V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function BellIcon({ size = 26, color = "#ffffff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M12 4.5a4.5 4.5 0 0 1 4.5 4.5v2.1c0 .8.3 1.5.8 2.2l1.2 1.5c.6.7.1 1.7-.8 1.7H6.3c-.9 0-1.4-1-.8-1.7l1.2-1.5c.5-.7.8-1.4.8-2.2V9A4.5 4.5 0 0 1 12 4.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M10 18.5a2 2 0 0 0 4 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileIcon({ size = 26, color = "#ffffff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M6.5 18.2c1.2-2 3.2-3.2 5.5-3.2s4.3 1.2 5.5 3.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function TruckIcon({ size = 20, color = "#1a1f6e", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3 6.5h10.5v9H3zM13.5 9.5h4l3 3.5v2.5h-7" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx="7" cy="17.5" r="1.8" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="17" cy="17.5" r="1.8" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ArrowCircleIcon({ size = 20, color = "#1a1f6e", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 12h8M12.5 8.5 16 12l-3.5 3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckCircleIcon({ size = 20, color = "#15803d", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="m8.5 12.2 2.3 2.3 4.7-4.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FormIcon({ size = 20, color = "#c62828", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M5 4h9v16H5zM7.5 8h4M7.5 11.5h4M7.5 15h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m14.5 16 5-5.5 1.5 1.4-5 5.5-2 .6.5-2Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function PinIcon({ size = 20, color = "#6d28d9", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="2.3" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ChevronIcon({ size = 18, color = "#0f172a", strokeWidth = 2.2, direction = "right" }: IconProps & { direction?: "left" | "right" }) {
  return (
    <Svg {...base(size)}>
      <Path d={direction === "right" ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarIcon({ size = 22, color = "#0b1250", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function CaretDownIcon({ size = 16, color = "#0f172a" }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M5 8h14l-7 8-7-8Z" fill={color} />
    </Svg>
  );
}

export function CheckIcon({ size = 16, color = "#ffffff", strokeWidth = 3 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="m5 12.5 4.5 4.5L19 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 22, color = "#64748b", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function EyeOffIcon({ size = 22, color = "#64748b", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.7 3.5M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.6-.6 5-1.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PhoneIcon({ size = 20, color = "#334155", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
