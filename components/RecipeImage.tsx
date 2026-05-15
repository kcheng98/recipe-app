type RecipeImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
};

/** Uses a native img so imported blog cover photos work from any domain. */
export default function RecipeImage({
  src,
  alt,
  className = "",
  fill = false,
}: RecipeImageProps) {
  const sizeClass = fill ? "absolute inset-0 h-full w-full object-cover" : "";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`${sizeClass} ${className}`.trim()} />
  );
}
