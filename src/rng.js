"use strict";

function hashSeed(input) {
  const str = String(input ?? "terrarium");
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let state = hashSeed(seed) || 1;
  return {
    next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    chance(probability) {
      return this.next() < probability;
    },
    pick(items) {
      if (!items.length) {
        return null;
      }
      return items[Math.floor(this.next() * items.length)];
    }
  };
}

module.exports = {
  createRng
};
