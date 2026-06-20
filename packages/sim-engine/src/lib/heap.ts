/* The simulator's timed to-do list.

   The simulation is driven by events that happen at specific times ("request
   arrives at 0.5s", "DB finishes at 1.2s"). We must always process the
   next-soonest event first. This structure lets us add events in any order and
   always pull out the earliest one quickly.

   Determinism note: the comparator must give a complete ordering — when two
   events share a timestamp we break the tie by the order they were added (a
   sequence number on the event), so runs are perfectly repeatable. */

export class MinHeap<T> {
  private readonly data: T[] = [];
  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.data.length;
  }
  peek(): T | undefined {
    return this.data[0];
  }

  /** add an event */
  push(item: T): void {
    const d = this.data;
    d.push(item);
    let i = d.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(d[i], d[parent])) break;
      [d[i], d[parent]] = [d[parent], d[i]];
      i = parent;
    }
  }

  /** remove and return the earliest event */
  pop(): T | undefined {
    const d = this.data;
    if (d.length === 0) return undefined;
    const top = d[0];
    const last = d.pop()!;
    if (d.length > 0) {
      d[0] = last;
      let i = 0;
      const n = d.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.less(d[l], d[smallest])) smallest = l;
        if (r < n && this.less(d[r], d[smallest])) smallest = r;
        if (smallest === i) break;
        [d[i], d[smallest]] = [d[smallest], d[i]];
        i = smallest;
      }
    }
    return top;
  }
}
