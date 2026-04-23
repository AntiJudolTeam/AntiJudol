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
  { id: "allow.gaming.hoki", donator: "budi", msg: "hoki banget lu jing", block: false },

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

  { id: "block.cta.ayo-deposit", donator: "viewer", msg: "AYO DEPOSIT SEKARANG DI HOKI888 DAN DAPATKAN HADIAH JACKPOT x1000 SELAMA PERMAINAN!", block: true },
  { id: "block.cta.yuk-main-slot", donator: "viewer", msg: "yuk main slot bareng", block: true },
  { id: "block.cta.buruan-daftar", donator: "viewer", msg: "buruan daftar sebelum promo habis", block: true },
  { id: "review.multiplier.jp-x500", donator: "viewer", msg: "jp x500 tiap putaran", ideal: "review" },
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

  // --- gambling-brand-token (whole or embedded brand token with lexicon stem + digits)
  { id: "block.brand-token.hoki888", donator: "bobi", msg: "HOKI888", block: true },
  { id: "block.brand-token.winlive4d", donator: "BHIMOCHI", msg: "WINLIVE4D", block: true },
  { id: "block.brand-token.mahjong877", donator: "Haha", msg: "Mahjong877", block: true },
  { id: "block.brand-token.mahjong-weist", donator: "Haha", msg: "MahjongWeist777", block: true },
  { id: "block.brand-token.merahputih", donator: "viewer", msg: "MERAHPUTIH500 dapet jackpot", block: true },
  { id: "block.brand-token.ruangbola", donator: "", msg: "RuangB0La77 Dijamin Auto Sukses dalam waktu singkat", block: true },
  { id: "block.brand-token.eth8877", donator: "Lovelyxrooo", msg: "ËTH8877", block: true },
  { id: "block.brand-token.pgbet606", donator: "Haha", msg: "PGBET606", block: true },
  { id: "block.brand-token.premier98", donator: "viewer", msg: "daftar di PREMIER98 sekarang", block: true },
  { id: "block.brand-token.rungkad211", donator: "viewer", msg: "Rungkad211 auto cair tiap hari", block: true },

  // --- gambling-brand-phrase (two-word gambling brand phrases, no digits required)
  { id: "block.brand-phrase.garuda-hoki", donator: "Lovely", msg: "GARUDA HOKI", block: true },
  { id: "block.brand-phrase.naga-hoki", donator: "As", msg: "Naga Hoki 88 & Macan Asia - Tempat Berkumpulnya Para Juara", block: true },
  { id: "block.brand-phrase.raja-slot", donator: "viewer", msg: "raja slot terbaru", block: true },
  { id: "block.brand-phrase.sultan-cuan", donator: "viewer", msg: "sultan cuan bertebaran", block: true },

  // --- try-at-brand (coba/main/daftar/join + di/ke + gambling stem)
  { id: "block.try-at.coba-premier", donator: "Rafi", msg: "coba di PREMIER98. pasti dapet 5jt sekali depo", block: true },
  { id: "block.try-at.coba-merahputih", donator: "syahrul", msg: "GW UDAH COBA DI SITUS MERAHPUTIH500 DAPET 10JT", block: true },
  { id: "block.try-at.main-sundatoto", donator: "Bapakku", msg: "Judi di sundatoto.id gacor", block: true },

  // --- big-win-claim (menang/dapet/wd/wede/cair + N juta/jt/milyar)
  { id: "block.big-win.menang-16jt", donator: "dewa99", msg: "gw barusan menang 16jt bro dari dewa99", block: true },
  { id: "block.big-win.wede-100-milyar", donator: "REZA", msg: "GACOR SLOT ANJENGG GW WEDE 100 MILYAR EDANN", block: true },
  { id: "block.big-win.dapet-5jt", donator: "viewer", msg: "dapet 5jt sekali depo sekali main", block: true },
  { id: "block.big-win.cair-10juta", donator: "viewer", msg: "cair 10 juta tadi pagi", block: true },

  // --- tembus-hit (tembus + gacor/jp/jackpot/maxwin/scatter/cuan/perkalian)
  { id: "block.tembus.gacor", donator: "ladeshmuani99", msg: "satu kali depo langsung tembus gacor", block: true },
  { id: "block.tembus.jp", donator: "viewer", msg: "tembus jp gede kemarin", block: true },

  // --- gacor-then-slot (reverse word order)
  { id: "block.gacor-slot.reverse", donator: "REZA", msg: "GACOR SLOT ANJENGG GW WEDE 100 MILYAR", block: true },
  { id: "block.maxwin-judi.reverse", donator: "viewer", msg: "maxwin judi tiap hari", block: true },

  // --- win-guarantee extended (dijamin/pasti/auto + knek/dapet/tembus/cair/sukses)
  { id: "block.guarantee.dijamin-knek", donator: "viewer", msg: "dijamin knekk terus setiap putaran", block: true },
  { id: "block.guarantee.auto-sukses", donator: "viewer", msg: "main sini auto sukses cair tiap hari", block: true },
  { id: "block.guarantee.pasti-tembus", donator: "viewer", msg: "pasti tembus scatter hitam", block: true },

  // --- perkalian-hype
  { id: "block.perkalian.gwede", donator: "xRungkad211", msg: "Pindah sini aja, Perkalian gwede Dijamin knekk jatah penarikan gratis 3 kali per hari", block: true },
  { id: "review.perkalian.only", donator: "viewer", msg: "perkalian gede banget kemarin", ideal: "review" },

  // --- gambling-domain-branded (hoki88.com, winlive4d.net, etc.)
  { id: "block.domain.hoki88-com", donator: "viewer", msg: "cek hoki88.com", block: true },
  { id: "block.domain.with-stem", donator: "viewer", msg: "main di sundatoto.id jackpot besar", block: true },
  { id: "block.domain.suspicious-tld", donator: "viewer", msg: "link88.vip siap daftar", block: true },

  // --- civilian names with digits (should NOT block)
  { id: "allow.name.rifan133", donator: "Rifan133", msg: "Rifan133", block: false },
  { id: "allow.name.andi99", donator: "Andi99", msg: "terima kasih bang", block: false },
  { id: "allow.name.putri21", donator: "Putri21", msg: "semangat streamnya", block: false },
  { id: "allow.name.budi2024", donator: "Budi2024", msg: "salam dari jogja", block: false },
  { id: "allow.name.mahendra99", donator: "Mahendra99", msg: "Mahendra99", block: false },

  // --- gaming titles with digits (should NOT block)
  { id: "allow.gaming.fifa23", donator: "viewer", msg: "main fifa23 bareng dong", block: false },
  { id: "allow.gaming.dota2", donator: "viewer", msg: "yuk push rank dota2", block: false },
  { id: "allow.gaming.gta5", donator: "viewer", msg: "streaming gta5 kapan?", block: false },

  // --- product mentions with digits (should NOT block)
  { id: "allow.product.office365", donator: "viewer", msg: "error di office365 pas login", block: false },
  { id: "allow.product.windows11", donator: "viewer", msg: "update windows11 lama banget", block: false },

  // --- domains of legit services (should NOT block)
  { id: "allow.domain.gojek", donator: "viewer", msg: "pakai gojek.com buat order", block: false },
  { id: "allow.domain.kompas", donator: "viewer", msg: "baca berita di kompas.id", block: false },

  // --- pure-brandish-msg (whole msg = <letters> + gambling suffix)
  { id: "block.brandish.pg-bet", donator: "Haha", msg: "PG BET", block: true },
  { id: "block.brandish.pg-bet888", donator: "Haha", msg: "PG BET888", block: true },
  { id: "block.brandish.rezatoto", donator: "Haha", msg: "RezaTOTO", block: true },
  { id: "block.brandish.bigbola", donator: "viewer", msg: "BigBola777", block: true },
  { id: "allow.brandish.not-pure", donator: "viewer", msg: "slot room custom ML masih kosong?", block: false },

  // --- leet-brand-token (letter+digit+letter+digit pattern with 2+ trailing digits)
  { id: "block.leet-brand.d3w188", donator: "D3W188", msg: "D3W188 EMNG GAC0000R", block: true },
  { id: "block.leet-brand.t0t098", donator: "Rafi", msg: "coba di T0T098. pasti dapet 5jt sekali depo", block: true },
  { id: "allow.leet-brand.thanks", donator: "viewer", msg: "t3r1ma k4s1h bang streamnya seru", block: false },
  { id: "allow.leet-brand.food", donator: "viewer", msg: "m4k4n siang bareng", block: false },
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
