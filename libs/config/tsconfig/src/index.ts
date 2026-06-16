export const baseConfigPath = '../../tsconfig.base.json';

export function getTsConfigPreset() {
  return { extends: baseConfigPath };
}
