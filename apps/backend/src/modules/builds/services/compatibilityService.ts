import type { CompatibilityResult, Component } from '@shared/types';
import { 
  validateCompatibility as sharedValidate, 
  checkSocketCompatibility as sharedCheckSocket,
  type BuildInput 
} from '@shared/compatibility-engine';

export { type BuildInput };

export class CompatibilityService {
  validateCompatibility(build: BuildInput): CompatibilityResult {
    return sharedValidate(build);
  }

  checkSocketCompatibility(source: string | string[] | undefined, target: string | undefined): boolean {
    return sharedCheckSocket(source, target);
  }
}

const service = new CompatibilityService();
export const validateCompatibility = service.validateCompatibility.bind(service);
export const checkSocketCompatibility = service.checkSocketCompatibility.bind(service);
