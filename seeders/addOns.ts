import type { AddOn } from "../types/bms";

// TODO: load the add-on price list from the BMS backend.
export const ADD_ONS: AddOn[] = [
  { key: "BOX_20", label: "20×20×20 Box", price: 130 },
  { key: "CLING_WRAP", label: "Cling Wrap", price: 400 },
  { key: "PACKAGING_TAPE", label: "Packaging Tape", price: 50 },
  { key: "BUBBLE_WRAP", label: "Bubble Wrap", price: 1000 },
  { key: "HALF_BUBBLE_WRAP", label: "Half Bubble Wrap", price: 500 },
];
