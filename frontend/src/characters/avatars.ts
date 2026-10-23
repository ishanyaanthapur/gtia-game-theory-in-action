import type { AvatarId } from "../types";

export interface AvatarStyle {
  id: AvatarId;
  name: string;
  species: string;
  blurb: string;
  fur: string;
  muzzle: string;
  limbs: string; // arms/feet (panda = black)
  armor: string;
  trim: string;
  headband: string;
  ears: "cat" | "floppy" | "panda";
  tail: "striped" | "wag" | "stub";
  stripes?: string;
  earColor?: string;
}

export const AVATARS: Record<AvatarId, AvatarStyle> = {
  yoshi: {
    id: "yoshi",
    name: "Yoshi",
    species: "Tabby cat samurai",
    blurb: "Calculating, curious, always lands on its feet.",
    fur: "#f28c28",
    muzzle: "#fff7ed",
    limbs: "#f28c28",
    armor: "#3b6fd8",
    trim: "#93c5fd",
    headband: "#dbeafe",
    ears: "cat",
    tail: "striped",
    stripes: "#c2410c",
  },
  jujubee: {
    id: "jujubee",
    name: "Jujubee",
    species: "Golden dog samurai",
    blurb: "Loyal to a fault... probably.",
    fur: "#e7b55c",
    muzzle: "#fdebc8",
    limbs: "#e7b55c",
    armor: "#a855f7",
    trim: "#f472b6",
    headband: "#fbcfe8",
    ears: "floppy",
    tail: "wag",
    earColor: "#c98f3a",
  },
  kimchi: {
    id: "kimchi",
    name: "Kimchi",
    species: "Panda samurai",
    blurb: "Chill exterior, strategic bamboo brain.",
    fur: "#f8fafc",
    muzzle: "#ffffff",
    limbs: "#18181b",
    armor: "#dc2626",
    trim: "#fbbf24",
    headband: "#fecaca",
    ears: "panda",
    tail: "stub",
  },
};

export const AVATAR_ORDER: AvatarId[] = ["yoshi", "jujubee", "kimchi"];
