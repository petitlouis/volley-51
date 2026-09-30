import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

describe('version', () => {
  it('package.json porte un numéro de version semver, affiché dans le pied de page et utilisé pour le tag de release', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
