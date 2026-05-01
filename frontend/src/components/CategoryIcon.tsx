/**
 * CategoryIcon — renders an SVG icon for a given component category.
 * Uses lucide-react. All icons are aria-hidden since they are decorative.
 */

import {
  Cpu, CircuitBoard, Monitor, MemoryStick,
  HardDrive, Zap, Box, Wind,
} from 'lucide-react';
import type { ComponentCategory } from '../types';

interface Props {
  category: ComponentCategory;
  size?: number;
  className?: string;
}

const ICONS: Record<ComponentCategory, React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  cpu:         Cpu,
  motherboard: CircuitBoard,
  gpu:         Monitor,
  ram:         MemoryStick,
  storage:     HardDrive,
  psu:         Zap,
  case:        Box,
  cooling:     Wind,
};

export function CategoryIcon({ category, size = 20, className }: Props) {
  const Icon = ICONS[category] ?? Box;
  return <Icon size={size} className={className} aria-hidden />;
}
