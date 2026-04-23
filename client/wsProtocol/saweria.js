export function parse(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.type !== "donation" || !Array.isArray(data.data)) return null;
    return data.data.map((x) => ({
      donator: x.donator || "",
      message: x.message || "",
      amount: x.amount || 0,
      currency: x.currency || "",
    }));
  } catch {
    return null;
  }
}

export function modify(raw, replacement) {
  try {
    const data = JSON.parse(raw);
    for (const x of data.data) {
      if (replacement.replaceDonator) x.donator = replacement.replaceDonator;
      if (replacement.replaceMessage) x.message = replacement.replaceMessage;
      x.tts = null;
    }
    return JSON.stringify(data);
  } catch {
    return raw;
  }
}
