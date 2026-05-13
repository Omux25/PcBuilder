import type { CompatibilityResult, Component } from '@shared/types';
import { validateCompatibility as sharedValidate, type BuildInput } from '@shared/compatibility-engine';

export { type BuildInput };

export class CompatibilityService {
  validateCompatibility(build: BuildInput): CompatibilityResult {
    return sharedValidate(build);
  }
}

const service = new CompatibilityService();
export const validateCompatibility = service.validateCompatibility.bind(service);
