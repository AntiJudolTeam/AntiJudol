import { describe, test, expect } from "bun:test";
import { decide } from "../src/filter/judolFilter.js";

const CASES = [
  { id: "allow.donation.basic", donator: "rudi", msg: "Ini sedikit donasi buat beli kopi ya bang", block: false },
  { id: "allow.donation.qris", donator: "siska", msg: "QRIS panitia yang kemarin masih aktif buat donasi ya?", block: false },
  { id: "allow.donation.rekening", donator: "andi", msg: "Nomor rekening donasi panti asuhan masih sama?", block: false },
  { id: "allow.thanks", donator: "fan123", msg: "Makasih bang streamnya seru!", block: false },

  { id: "allow.gaming.slot-room", donator: "mlplayer", msg: "Slot room custom ML masih kosong?", block: false },
  { id: "allow.gaming.discord", donator: "gamer", msg: "Open mabar di discord malam ini", block: false },
  { id: "allow.gaming.valorant", donator: "valo", msg: "Push rank valorant yuk", block: false },
  { id: "allow.gaming.booking", donator: "budi", msg: "Buat booking mabar VIP bang", block: false },
  { id: "allow.gaming.booking", donator: "ahmad", msg: "Gratis 5 VIP buat yang donate ID tercepat", block: false },

  { id: "allow.finance.withdraw", donator: "investor", msg: "Withdraw reksadana ke BCA biasanya berapa lama?", block: false },
  { id: "allow.finance.cashback", donator: "shopper", msg: "Dapet cashback shopee 50rb hari ini", block: false },

  { id: "allow.anti-judol", donator: "psa", msg: "Hati-hati iklan judol, banyak penipuan", block: false },

  { id: "allow.name.search", donator: "budi", msg: "cari di google bang drama terbaru sungut lele 69", block: false },


  { id: "block.brand.rtp", donator: "promoter", msg: "Kantorbola99 RTP 99% daftar sekarang", block: true },
  { id: "block.depo.qris", donator: "viewer", msg: "depo via qris 10rb wd lancar", block: true },
  { id: "block.slot.gacor", donator: "viewer", msg: "slot gacor hari ini pasti jp", block: true },
  { id: "block.free.spin", donator: "viewer", msg: "free spin harian klaim sekarang", block: true },
  { id: "block.bonus.member", donator: "viewer", msg: "bonus member baru 100%", block: true },
  { id: "block.link.daftar", donator: "viewer", msg: "link daftar slot ada di bio", block: true },
  { id: "block.link.search", donator: "viewer", msg: "cri di google kntorbola99", block: true },


  { id: "block.rtp.punct", donator: "viewer", msg: "r.t.p 99 hari ini", block: true },
  { id: "block.wd.punct", donator: "viewer", msg: "w.d lancar tiap hari", block: true },

  { id: "block.jp.spaced", donator: "viewer", msg: "j p besar hari ini", block: true },
  { id: "block.slot.spaced", donator: "viewer", msg: "s l o t gacor", block: true },

  { id: "block.slot.slash", donator: "viewer", msg: "s/l/o/t g/a/c/o/r", block: true },

  { id: "block.leet.slot", donator: "viewer", msg: "sl0t g4c0r hari ini", block: true },
  { id: "block.leet.link", donator: "viewer", msg: "l1nk d4ft4r sl0t", block: true },

  { id: "block.symbol", donator: "viewer", msg: "g*a*c*o*r m*a*x*w*i*n", block: true },

  { id: "block.brand.typo", donator: "viewer", msg: "kantorbolla99 daftar sekarang", block: true },

  { id: "block.vowel-drop.sultan", donator: "eth99", msg: "mldk stiap ptrannya lngsung jd sltan!", block: true },

  { id: "block.discord.bypass", donator: "viewer", msg: "rtp 97 live discord room", block: true },
  { id: "block.anti-judol.bypass", donator: "viewer", msg: "depo qris wd lancar bukan penipuan", block: true },
  { id: "block.safeword.bypass", donator: "viewer", msg: "slot gacor live stream aman terpercaya", block: true },


  { id: "ambiguous.jp", donator: "viewer", msg: "jackpot gede banget kemarin", ideal: "review" },
  { id: "ambiguous.cuan", donator: "viewer", msg: "kemarin cuan 10 juta dari game", ideal: "review" },
  { id: "ambiguous.server", donator: "viewer", msg: "server thailand bagus banget", ideal: "review" },
  { id: "ambiguous.vip", donator: "viewer", msg: "akun vip sudah aktif", ideal: "review" },

  { id: "ambiguous.gacha-sultan", donator: "viewer", msg: "min gw kemarin menang gacha dari moonton langsung jadi sultan jir akun gw", ideal: "review" },


  { id: "block.typo.vowel-jackpot",   donator: "viewer", msg: "jckpot besar hari ini",           block: true },
  { id: "block.typo.vowel-sultan",    donator: "viewer", msg: "lngsung jd sltan",                block: true },
  { id: "block.typo.fuzzy-gacoor",    donator: "viewer", msg: "gacoor maxwin hari ini",          block: true },
  { id: "block.typo.fuzzy-maxwinn",   donator: "viewer", msg: "maxwinn gacor banget",            block: true },

  { id: "review.typo.jackpot-gede",   donator: "viewer", msg: "jckpot gede kemarin",             ideal: "review" },
  { id: "review.typo.akunn-vip",      donator: "viewer", msg: "akunn vip aktif di twitch",       ideal: "review" },
  { id: "review.typo.cuaan-amount",   donator: "viewer", msg: "cuaan 10 juta dari main",         ideal: "review" },
  { id: "review.leet.server-thai",    donator: "viewer", msg: "s3rver thailand bgs banget",      ideal: "review" },
  { id: "review.leet.pasti-cair",     donator: "viewer", msg: "past1 c41r tiap hari",            ideal: "review" },

  { id: "allow.leet.thanks",          donator: "viewer", msg: "t3r1ma k4s1h bang",               block: false },
  { id: "allow.leet.food",            donator: "viewer", msg: "m4k4n siang bareng bang",         block: false },
  { id: "allow.leet.gaming-genshin",  donator: "viewer", msg: "g3nshin gacha baru seru",         block: false },
  { id: "allow.leet.gaming-mobile",   donator: "viewer", msg: "mobil3 legends turnamen",         block: false },
  { id: "allow.typo.bnget",           donator: "viewer", msg: "bnget seru streamnya",            block: false },
  { id: "allow.typo.withdraw-legit",  donator: "viewer", msg: "withdraw reksadana sudah sampai", block: false },
  { id: "allow.safe.donation",        donator: "viewer", msg: "donasi langsung ke masjid",       block: false },
  { id: "allow.zerowidth",            donator: "viewer", msg: "te​rima kasih bang",              block: false },
];

describe("judolFilter: decide()", () => {
  for (const { id, donator, msg, block, ideal } of CASES) {
    const expected = ideal ?? (block ? "block" : "allow");
    const label = `${id} [${expected}]: "${donator}" / "${msg}"`;
    test(label, () => {
      const { action } = decide(donator, msg);
      expect(action).toBe(expected);
    });
  }

  test("returns stage=empty for fully empty input", () => {
    expect(decide("", "").stage).toBe("empty");
    expect(decide(null, undefined).stage).toBe("empty");
  });
});
