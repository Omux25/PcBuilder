import type { CompatibilityResult, Component } from '@shared/types';
import {
  validateCompatibility as sharedValidate,
  checkSocketCompatibility as sharedCheckSocket,
  evaluateCompatibility as sharedEvaluate,
  type BuildInput
} from '@shared/engine/compatibility.engine.js';
export { type BuildInput };

export class CompatibilityService {
  validateCompatibility(build: BuildInput): CompatibilityResult {
    return sharedValidate(build);
  }

  checkSocketCompatibility(source: string | string[] | undefined, target: string | undefined): boolean {
    return sharedCheckSocket(source, target);
  }

  evaluateCompatibility(
    component: Partial<Component>,
    currentBuild: Record<string, Partial<Component>>
  ): { isCompatible: boolean; reasons: string[] } {
    return sharedEvaluate(component, currentBuild);
  }
}

const service = new CompatibilityService();
export const validateCompatibility = service.validateCompatibility.bind(service);
export const checkSocketCompatibility = service.checkSocketCompatibility.bind(service);
export const evaluateCompatibility = service.evaluateCompatibility.bind(service);
