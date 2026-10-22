import React from "react";
import Image from "next/image";

interface AppLogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

export function AppLogo({
  width = 180,
  height = 63,
  className = "h-12 w-auto object-contain",
  priority = true,
  alt = "Ride Lab Logo",
}: AppLogoProps) {
  return (
    <>
      <Image
        src="/ridelab-logo-dark.png"
        alt={alt}
        width={width}
        height={height}
        className={`app-logo-dark ${className}`}
        priority={priority}
      />
      <Image
        src="/ridelab-logo-light.png"
        alt={alt}
        width={width}
        height={height}
        className={`app-logo-light ${className}`}
        priority={priority}
      />
    </>
  );
}

export default AppLogo;
