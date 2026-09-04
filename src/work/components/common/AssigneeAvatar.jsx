import { Avatar, Tooltip } from "@mui/material";

// Deterministic colour per user so the same person keeps the same avatar.
const PALETTE = [
  "#5C6BC0", "#26A69A", "#EF5350", "#AB47BC",
  "#42A5F5", "#66BB6A", "#FFA726", "#8D6E63",
];

const colorFor = (seed = "") => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  }
  return PALETTE[hash % PALETTE.length];
};

const initialsFor = (name = "") =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

/**
 * Hidden entirely when the item is unassigned — with one account this is
 * always you, which is fine; it stops the card jumping once there are two.
 *
 * @param {object|null} user  { publicId, displayName, username, avatarUrl }
 */
export default function AssigneeAvatar({ user, size = 24, sx }) {
  if (!user) return null;

  const name = user.displayName || user.username || user.email || "Unknown";
  const seed = user.publicId || name;

  return (
    <Tooltip title={name}>
      <Avatar
        src={user.avatarUrl || undefined}
        sx={{
          width: size,
          height: size,
          fontSize: size * 0.42,
          fontWeight: 600,
          bgcolor: colorFor(seed),
          ...sx,
        }}
      >
        {initialsFor(name)}
      </Avatar>
    </Tooltip>
  );
}
