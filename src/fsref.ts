/** Dependency-free helpers for `fsfile:` audio references (see filestore.ts), safe to import anywhere. */
export const FS_PREFIX = 'fsfile:';
export const isFsFile = (src: string) => src.startsWith(FS_PREFIX);
