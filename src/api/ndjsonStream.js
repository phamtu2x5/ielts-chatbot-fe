export async function readNdjsonStream(stream, onEvent) {
  if (!stream) throw new Error("Phản hồi không có dữ liệu stream.");

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeLine = async (line) => {
    if (!line.trim()) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new Error("Dữ liệu stream từ backend không hợp lệ.");
    }
    await onEvent(event);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) await consumeLine(line);
      if (done) break;
    }
    if (buffer.trim()) await consumeLine(buffer);
  } finally {
    reader.releaseLock();
  }
}
