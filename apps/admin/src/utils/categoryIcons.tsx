import React from 'react';
import { 
  Cpu, 
  CircuitBoard, 
  HardDrive, 
  Zap, 
  Box, 
  Fan, 
  Thermometer, 
  Monitor, 
  Keyboard, 
  Mouse, 
  Headphones, 
  Speaker, 
  Video, 
  Wifi, 
  Settings,
  HelpCircle
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cpu: <Cpu size={16} />,
  motherboard: <CircuitBoard size={16} />,
  gpu: <Cpu size={16} />, 
  ram: <HardDrive size={16} />, 
  storage: <HardDrive size={16} />,
  psu: <Zap size={16} />,
  case: <Box size={16} />,
  cooling: <Fan size={16} />,
  fan: <Fan size={16} />,
  thermal_paste: <Thermometer size={16} />,
  monitor: <Monitor size={16} />,
  keyboard: <Keyboard size={16} />,
  mouse: <Mouse size={16} />,
  headphones: <Headphones size={16} />,
  speakers: <Speaker size={16} />,
  webcam: <Video size={16} />,
  os: <Settings size={16} />,
  wired_network_adapter: <Wifi size={16} />, 
  wireless_network_adapter: <Wifi size={16} />,
  sound_card: <Speaker size={16} />,
  case_accessory: <Settings size={16} />,
  fan_controller: <Settings size={16} />,
};

export function getCategoryIcon(category: string | null) {
  if (!category) return <HelpCircle size={16} />;
  return CATEGORY_ICONS[category] || <HelpCircle size={16} />;
}
