// LOOP//BREAK - Uniform grid broadphase. Rebuilt every tick; queries avoid O(n^2) enemy checks.

export class SpatialHash {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.inv = 1 / cellSize;
    this.cells = new Map();
    this.pool = [];
  }

  key(cx, cy) {
    // Pack two signed 16-bit cell coords into one integer key
    return ((cx + 32768) << 16) | (cy + 32768);
  }

  clear() {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.pool.push(bucket);
    }
    this.cells.clear();
  }

  insert(obj) {
    const k = this.key(Math.floor(obj.x * this.inv), Math.floor(obj.y * this.inv));
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = this.pool.pop() || [];
      this.cells.set(k, bucket);
    }
    bucket.push(obj);
  }

  // Fills `out` with objects whose cell overlaps the query circle's bounding box. Caller does exact checks.
  query(x, y, r, out) {
    out.length = 0;
    const minX = Math.floor((x - r) * this.inv);
    const maxX = Math.floor((x + r) * this.inv);
    const minY = Math.floor((y - r) * this.inv);
    const maxY = Math.floor((y + r) * this.inv);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
      }
    }
    return out;
  }
}
