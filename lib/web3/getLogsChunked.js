export async function getLogsChunked(provider, filter, fromBlock, toBlock, chunkSize = 5000) {
  const logs = [];
  const end =
    toBlock === "latest" ? Number(await provider.getBlockNumber()) : Number(toBlock);

  let from = Number(fromBlock);

  while (from <= end) {
    const to = Math.min(from + chunkSize - 1, end);

    try {
      const part = await provider.getLogs({
        ...filter,
        fromBlock: from,
        toBlock: to,
      });
      logs.push(...part);
      from = to + 1;
    } catch (e) {
      const msg = String(e?.message || "");
      const code = e?.code;

      if (code === -32005 || msg.toLowerCase().includes("more than 10000")) {
        if (chunkSize <= 500) throw e;
        chunkSize = Math.floor(chunkSize / 2);
        continue;
      }
      throw e;
    }
  }

  return logs;
}
