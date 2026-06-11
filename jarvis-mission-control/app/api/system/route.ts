import os from "os";
import si from "systeminformation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [mem, load, fsSize, netStats] = await Promise.all([
      si.mem(),
      si.currentLoad(),
      si.fsSize(),
      si.networkStats(),
    ]);

    // Largest mounted filesystem = the disk that matters on a personal machine
    const disk = fsSize.reduce(
      (best, fs) => (fs.size > (best?.size ?? 0) ? fs : best),
      fsSize[0]
    );

    const net = netStats[0];

    return Response.json({
      ok: true,
      ts: Date.now(),
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} ${os.arch()}`,
      cpu: {
        load: load.currentLoad,
        cores: os.cpus().length,
        perCore: load.cpus.map((c) => c.load),
      },
      mem: {
        used: mem.active,
        total: mem.total,
      },
      disk: disk
        ? { used: disk.used, total: disk.size, mount: disk.mount }
        : null,
      uptime: os.uptime(),
      net: net
        ? {
            iface: net.iface,
            // bytes/sec; -1 on the first sample before si has a baseline
            rxSec: net.rx_sec ?? -1,
            txSec: net.tx_sec ?? -1,
          }
        : null,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "system read failed" },
      { status: 500 }
    );
  }
}
