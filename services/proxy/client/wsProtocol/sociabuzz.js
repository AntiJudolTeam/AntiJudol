export function parse(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.action !== 15 || !Array.isArray(data.messages)) return null;
    return data.messages.map((m) => {
      const x = typeof m.data === "string" ? JSON.parse(m.data) : m.data;
      return {
        donator: x.fullname || "",
        message: x.note || "",
        amount: parseInt(x.amount, 10) || 0,
        currency: x.currency || "IDR",
      };
    });
  } catch {
    return null;
  }
}

export function modify(raw, replacement) {
  try {
    const data = JSON.parse(raw);
    for (const m of data.messages) {
      const x = typeof m.data === "string" ? JSON.parse(m.data) : m.data;
      if (replacement.replaceDonator) x.fullname = replacement.replaceDonator;
      if (replacement.replaceMessage) x.note = replacement.replaceMessage;
      delete x.tts;
      delete x.voice_note;
      m.data = JSON.stringify(x);
    }
    return JSON.stringify(data);
  } catch {
    return raw;
  }
}
