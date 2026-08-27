import styles from './PlayerAvatar.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown } from '@fortawesome/free-solid-svg-icons';

const schemes = [
  {
    background: '#1b6e4b',
    foreground: '#faf7f2',
    stripe: '#14573b',
    suit: '♠',
  },
  {
    background: '#d94432',
    foreground: '#faf7f2',
    stripe: '#b83022',
    suit: '♥',
  },
  {
    background: '#f5a623',
    foreground: '#191c2d',
    stripe: '#d98e18',
    suit: '♦',
  },
  {
    background: '#1e9e98',
    foreground: '#faf7f2',
    stripe: '#178780',
    suit: '♣',
  },
  {
    background: '#3a3d52',
    foreground: '#faf7f2',
    stripe: '#292c3e',
    suit: '♠',
  },
  {
    background: '#8b4513',
    foreground: '#faf7f2',
    stripe: '#6b3410',
    suit: '♥',
  },
  {
    background: '#5b4a9f',
    foreground: '#faf7f2',
    stripe: '#46377e',
    suit: '♦',
  },
  {
    background: '#1a6b8a',
    foreground: '#faf7f2',
    stripe: '#145470',
    suit: '♣',
  },
];

const sizeMap = { xs: 28, sm: 36, md: 48, lg: 72, xl: 112 };

export function isPlaceholderAvatar(imageUrl?: string | null) {
  if (!imageUrl) return true;

  const path = imageUrl.split(/[?#]/)[0].toLowerCase();
  return path === 'avatar.png' || path.endsWith('/avatar.png');
}

type Props = {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof sizeMap;
  champion?: boolean;
  celebrate?: boolean;
  className?: string;
};

function hashName(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  displayName?: string | null,
) {
  if (firstName || lastName) {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  }

  const words = (displayName ?? '?').trim().split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? '?'}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toUpperCase();
}

export function getGeneratedAvatarUrl(name: string) {
  const { scheme, initials } = getGeneratedAvatarDetails(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${scheme.background}"/><path d="M-15 85L85-15M10 110L110 10" stroke="${scheme.stripe}" stroke-width="2" opacity=".35"/><text x="50" y="61" text-anchor="middle" font-family="Georgia,serif" font-size="38" font-weight="700" fill="${scheme.foreground}">${initials}</text><text x="79" y="91" font-family="Georgia,serif" font-size="24" fill="${scheme.foreground}" opacity=".32">${scheme.suit}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getGeneratedAvatarDetails(name: string) {
  return {
    scheme: schemes[hashName(name) % schemes.length],
    initials: getInitials(undefined, undefined, name),
  };
}

export function getPlayerAvatarUrl(name: string, imageUrl?: string | null) {
  return isPlaceholderAvatar(imageUrl)
    ? getGeneratedAvatarUrl(name)
    : imageUrl!;
}

export default function PlayerAvatar({
  firstName,
  lastName,
  displayName,
  imageUrl,
  size = 'md',
  champion = false,
  celebrate = false,
  className = '',
}: Props) {
  const fullName =
    displayName ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    'Poker player';
  const pixels = sizeMap[size];
  const scheme = schemes[hashName(fullName) % schemes.length];
  const hasPlayerImage = !isPlaceholderAvatar(imageUrl);

  return (
    <span
      className={`${styles.wrapper} ${className}`}
      style={{ width: pixels, height: pixels }}
    >
      {hasPlayerImage ? (
        <img
          className={styles.image}
          src={imageUrl!}
          alt={`${fullName} avatar`}
          width={pixels}
          height={pixels}
          loading="lazy"
        />
      ) : (
        <span
          className={styles.fallback}
          style={{
            backgroundColor: scheme.background,
            color: scheme.foreground,
            backgroundImage: `repeating-linear-gradient(135deg, transparent 0, transparent 7px, ${scheme.stripe}55 7px, ${scheme.stripe}55 8px)`,
          }}
          role="img"
          aria-label={`${fullName} avatar`}
        >
          <span
            className={styles.initials}
            style={{ fontSize: Math.max(12, Math.round(pixels * 0.38)) }}
          >
            {getInitials(firstName, lastName, displayName)}
          </span>
          <span
            className={styles.suit}
            aria-hidden="true"
            style={{ fontSize: Math.max(10, Math.round(pixels * 0.26)) }}
          >
            {scheme.suit}
          </span>
        </span>
      )}
      {champion && (
        <span
          className={`${styles.crown} ${celebrate ? styles.celebrate : ''}`}
          aria-label="Champion"
          role="img"
          style={{
            width: Math.max(20, Math.round(pixels * 0.48)),
            height: Math.max(20, Math.round(pixels * 0.48)),
            top: -Math.max(8, Math.round(pixels * 0.16)),
            right: -Math.max(8, Math.round(pixels * 0.14)),
          }}
        >
          <FontAwesomeIcon icon={faCrown} />
        </span>
      )}
    </span>
  );
}
