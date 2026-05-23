import { extractStorageSpecs } from '../shared/hardware/specs/storage.js';

const names = [
  "Corsair Force MP510 1920 GB NVME",
  "Corsair MP510 240 GB",
  "Corsair MP510 480 GB"
];

for (const name of names) {
  console.log(`Name: "${name}" ->`, extractStorageSpecs(name));
}
