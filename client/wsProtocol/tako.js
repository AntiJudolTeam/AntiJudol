export function detectDonationSignal(raw) {
  try {
    const text = typeof raw === "string" ? raw.replace(/\x1e/g, "") : raw;
    const data = JSON.parse(text);
    return data.event === "messages";
  } catch {
    return false;
  }
}

export function parseFetchBody(data) {
  const donationData = data && data.result;
  if (!donationData || !donationData.sender || !donationData.message) return null;
  return {
    donator: donationData.sender.name || "",
    message: donationData.message || "",
    amount: donationData.amount || 0,
    currency: donationData.currency || "",
  };
}

export function modifyFetchBody(data, replacement) {
  if (replacement.replaceDonator) data.result.sender.name = replacement.replaceDonator;
  if (replacement.replaceMessage) data.result.message = replacement.replaceMessage;
  return data;
}
