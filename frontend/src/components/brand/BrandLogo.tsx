import stackedLogo from '../../assets/brand/logo-stacked.png';
import horizontalLogo from '../../assets/brand/logo-lockup-horizontal.png';

type BrandLogoProps = {
  variant?: 'stacked' | 'horizontal';
  height?: number;
  alt?: string;
  src?: string | null;
};

export function BrandLogo({
  variant = 'stacked',
  height = 180,
  alt = 'Hajj & Umrah Agency Pro',
  src,
}: BrandLogoProps) {
  const image = src || (variant === 'horizontal' ? horizontalLogo : stackedLogo);

  return (
    <img
      src={image}
      alt={alt}
      style={{
        height,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'block',
        marginInline: 'auto',
      }}
    />
  );
}
