import Image from "next/image";

// PT Apurva Wijaya Madani icon mark — used for the sidebar, mobile top
// bar, and favicon (see src/app/icon.png, generated from the same file).
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/logo-icon.png"
      alt="PT Apurva Wijaya Madani"
      width={size}
      height={size}
      className="rounded-md"
      priority
    />
  );
}
