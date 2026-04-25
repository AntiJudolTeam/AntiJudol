export function parse(raw) {
  try {
    const data = JSON.parse(raw.replace(/\x1e/g, ""));
    if (data.target !== "Donation" || !Array.isArray(data.arguments)) return null;
    return data.arguments.map((x) => ({
      donator: x.preferedName || x.username || "",
      message: x.message || "",
      amount: x.amount || 0,
      currency: "IDR",
    }));
  } catch {
    return null;
  }
}

export function modify(raw, replacement) {
  try {
    const data = JSON.parse(raw.replace(/\x1e/g, ""));
    for (const x of data.arguments) {
      if (replacement.replaceDonator) {
        x.preferedName = replacement.replaceDonator;
        x.username = replacement.replaceDonator;
      }
      if (replacement.replaceMessage) x.message = replacement.replaceMessage;
      x.audioData = null;
    }
    return JSON.stringify(data) + "\x1e";
  } catch {
    return raw;
  }
}
