import { describe, test, expect } from "bun:test";
import * as saweria from "../../client/wsProtocol/saweria.js";
import * as bagibagi from "../../client/wsProtocol/bagibagi.js";
import * as sociabuzz from "../../client/wsProtocol/sociabuzz.js";
import * as tako from "../../client/wsProtocol/tako.js";

const BLOCK = { replaceDonator: "Hidden", replaceMessage: "[blocked]" };

describe("wsProtocol/saweria", () => {
  const frame = JSON.stringify({
    type: "donation",
    data: [
      {
        donator: "bobby",
        message: "slot gacor",
        amount: 10000,
        currency: "IDR",
        tts: ["base64audio"],
      },
    ],
  });

  test("parse returns donation array", () => {
    const r = saweria.parse(frame);
    expect(r).toEqual([{ donator: "bobby", message: "slot gacor", amount: 10000, currency: "IDR" }]);
  });

  test("parse returns null for non-donation frame", () => {
    expect(saweria.parse(JSON.stringify({ type: "heartbeat" }))).toBeNull();
  });

  test("parse returns null for malformed JSON", () => {
    expect(saweria.parse("not json")).toBeNull();
  });

  test("modify replaces donator/message and nulls tts", () => {
    const out = saweria.modify(frame, BLOCK);
    const parsed = JSON.parse(out);
    expect(parsed.data[0].donator).toBe("Hidden");
    expect(parsed.data[0].message).toBe("[blocked]");
    expect(parsed.data[0].tts).toBeNull();
  });

  test("modify leaves amount and currency untouched", () => {
    const out = saweria.modify(frame, BLOCK);
    const parsed = JSON.parse(out);
    expect(parsed.data[0].amount).toBe(10000);
    expect(parsed.data[0].currency).toBe("IDR");
  });

  test("modify returns raw on parse failure", () => {
    expect(saweria.modify("not json", BLOCK)).toBe("not json");
  });
});

describe("wsProtocol/bagibagi", () => {
  const payload = {
    type: 1,
    target: "Donation",
    arguments: [
      {
        preferedName: "alice",
        username: "alice123",
        message: "depo qris wd",
        amount: 5000,
        audioData: "blob",
      },
    ],
  };
  const frame = JSON.stringify(payload) + "\x1e";

  test("parse strips \\x1e and returns donation", () => {
    const r = bagibagi.parse(frame);
    expect(r).toEqual([{ donator: "alice", message: "depo qris wd", amount: 5000, currency: "IDR" }]);
  });

  test("parse falls back to username when preferedName missing", () => {
    const f =
      JSON.stringify({
        target: "Donation",
        arguments: [{ username: "fallback", message: "hi", amount: 1 }],
      }) + "\x1e";
    expect(bagibagi.parse(f)[0].donator).toBe("fallback");
  });

  test("parse returns null for UserDonated event (not Donation)", () => {
    const f =
      JSON.stringify({
        target: "UserDonated",
        arguments: [{ preferedName: "x", message: "y" }],
      }) + "\x1e";
    expect(bagibagi.parse(f)).toBeNull();
  });

  test("modify preserves \\x1e trailer", () => {
    const out = bagibagi.modify(frame, BLOCK);
    expect(out.endsWith("\x1e")).toBe(true);
  });

  test("modify replaces both preferedName and username, nulls audioData", () => {
    const out = bagibagi.modify(frame, BLOCK);
    const parsed = JSON.parse(out.replace(/\x1e/g, ""));
    const arg = parsed.arguments[0];
    expect(arg.preferedName).toBe("Hidden");
    expect(arg.username).toBe("Hidden");
    expect(arg.message).toBe("[blocked]");
    expect(arg.audioData).toBeNull();
  });
});

describe("wsProtocol/sociabuzz", () => {
  const inner = {
    fullname: "carla",
    note: "free spin klaim",
    amount: "25000",
    currency: "IDR",
    tts: "https://cdn/a.mp3",
    voice_note: "https://cdn/b.mp3",
  };
  const frame = JSON.stringify({
    action: 15,
    messages: [{ data: JSON.stringify(inner) }],
  });

  test("parse extracts nested JSON donation", () => {
    const r = sociabuzz.parse(frame);
    expect(r).toEqual([{ donator: "carla", message: "free spin klaim", amount: 25000, currency: "IDR" }]);
  });

  test("parse returns null for non-action-15 frames", () => {
    expect(sociabuzz.parse(JSON.stringify({ action: 10, messages: [] }))).toBeNull();
  });

  test("modify re-stringifies inner data with deleted tts and voice_note", () => {
    const out = sociabuzz.modify(frame, BLOCK);
    const outer = JSON.parse(out);
    const innerParsed = JSON.parse(outer.messages[0].data);
    expect(innerParsed.fullname).toBe("Hidden");
    expect(innerParsed.note).toBe("[blocked]");
    expect(innerParsed.tts).toBeUndefined();
    expect(innerParsed.voice_note).toBeUndefined();
  });

  test("modify preserves inner amount and currency", () => {
    const out = sociabuzz.modify(frame, BLOCK);
    const innerParsed = JSON.parse(JSON.parse(out).messages[0].data);
    expect(innerParsed.amount).toBe("25000");
    expect(innerParsed.currency).toBe("IDR");
  });
});

describe("wsProtocol/tako", () => {
  test("detectDonationSignal returns true for messages event", () => {
    expect(tako.detectDonationSignal(JSON.stringify({ event: "messages" }))).toBe(true);
  });

  test("detectDonationSignal strips \\x1e", () => {
    expect(tako.detectDonationSignal(JSON.stringify({ event: "messages" }) + "\x1e")).toBe(true);
  });

  test("detectDonationSignal returns false for other events", () => {
    expect(tako.detectDonationSignal(JSON.stringify({ event: "heartbeat" }))).toBe(false);
  });

  test("detectDonationSignal returns false for non-JSON", () => {
    expect(tako.detectDonationSignal("ping")).toBe(false);
  });

  test("parseFetchBody extracts donation from result object", () => {
    const body = {
      result: {
        sender: { name: "dave" },
        message: "maxwin bonus",
        amount: 7500,
        currency: "IDR",
      },
    };
    expect(tako.parseFetchBody(body)).toEqual({
      donator: "dave",
      message: "maxwin bonus",
      amount: 7500,
      currency: "IDR",
    });
  });

  test("parseFetchBody returns null when result missing", () => {
    expect(tako.parseFetchBody({})).toBeNull();
  });

  test("parseFetchBody returns null when sender missing", () => {
    expect(tako.parseFetchBody({ result: { message: "hi" } })).toBeNull();
  });

  test("parseFetchBody returns null when message missing", () => {
    expect(tako.parseFetchBody({ result: { sender: { name: "x" } } })).toBeNull();
  });

  test("modifyFetchBody replaces sender.name and message in-place", () => {
    const body = {
      result: { sender: { name: "dave", id: 42 }, message: "m", amount: 7500 },
    };
    const out = tako.modifyFetchBody(body, BLOCK);
    expect(out.result.sender.name).toBe("Hidden");
    expect(out.result.message).toBe("[blocked]");
    expect(out.result.sender.id).toBe(42);
    expect(out.result.amount).toBe(7500);
  });
});
