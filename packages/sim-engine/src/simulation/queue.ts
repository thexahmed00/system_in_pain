/* One box in the architecture, modelled as a service counter with N workers
   (instances) and a waiting line.

   - A request arrives → a free worker serves it, else it waits in line, else
     (line full) it is turned away (load-shedding).
   - A worker finishing pulls the next request from the line.

   The simulator owns the clock and the service durations; this class only tracks
   occupancy, the line, and the tallies. Generic over the request payload R.

   The waiting line uses a moving "front" pointer rather than removing the first
   element — under a heavy backlog that keeps "serve next" instant instead of
   re-shuffling the whole line each time. */

export type Admission = "serve" | "queued" | "dropped";

export class NodeQueue<R> {
  private busy = 0;
  private readonly line: R[] = [];
  private head = 0; // index of the front of the line

  // tallies the simulator reads at the end
  served = 0;
  dropped = 0;
  busyTimeSec = 0;
  peakBacklog = 0;

  constructor(
    private readonly servers: number,
    private readonly queueLimit: number,
  ) {}

  private get waiting(): number {
    return this.line.length - this.head;
  }

  /** A request wants service now. Returns what happened to it. */
  arrive(req: R): Admission {
    if (this.busy < this.servers) {
      this.busy++;
      return "serve";
    }
    if (this.waiting < this.queueLimit) {
      this.line.push(req);
      if (this.waiting > this.peakBacklog) this.peakBacklog = this.waiting;
      return "queued";
    }
    this.dropped++;
    return "dropped";
  }

  /**
   * A worker just finished a request that took `serviceTimeSec`.
   * Frees the worker, records the work, and — if anyone is waiting — immediately
   * starts the next one (returns it so the simulator can schedule its finish).
   */
  finish(serviceTimeSec: number): R | null {
    this.busy--;
    this.served++;
    this.busyTimeSec += serviceTimeSec;
    if (this.head < this.line.length) {
      const next = this.line[this.head++];
      // reclaim memory once the consumed front dominates the array
      if (this.head > 10_000 && this.head * 2 > this.line.length) {
        this.line.splice(0, this.head);
        this.head = 0;
      }
      this.busy++;
      return next;
    }
    return null;
  }
}
