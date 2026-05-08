/**
 * CategoryIcon — renders an SVG icon for a given component category.
 * Uses lucide-react. All icons are aria-hidden since they are decorative.
 */

import {
  Cpu, CircuitBoard, Monitor, MemoryStick,
  HardDrive, Zap, Box, Wind, Fan, Thermometer,
  Keyboard, Mouse, Headphones, Speaker, Camera,
  Globe, Network, Wifi, Music, Package, Settings,
  Database, Disc, Battery, Wrench,
} from 'lucide-react';
import type { ComponentCategory } from '../types';

interface Props {
  category: ComponentCategory;
  size?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

const ICONS: Record<ComponentCategory, React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  gpu: Monitor,
  ram: MemoryStick,
  storage: HardDrive,
  psu: Zap,
  case: Box,
  cooling: Wind,
  fan: Fan,
  thermal_paste: Thermometer,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
  headphones: Headphones,
  speakers: Speaker,
  webcam: Camera,
  os: Globe,
  wired_network_adapter: Network,
  wireless_network_adapter: Wifi,
  sound_card: Music,
  case_accessory: Package,
  fan_controller: Settings,
  external_storage: Database,
  optical_drive: Disc,
  ups: Battery,
  accessory: Wrench,
};

export function CategoryIcon({ category, size = 20, className, 'aria-hidden': ariaHidden = true }: Props) {
  const Icon = ICONS[category] ?? Box;
  return <Icon size={size} className={className} aria-hidden={ariaHidden} />;
}
