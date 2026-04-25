import { describe, test, expect } from "bun:test";
import { decide } from "../src/filter/judolFilter.js";

const CASES = [
  // ==========================================
  // 1. BRAND MENTIONS IN PSA / NEWS (Strict Block)
  // Even if they pretend to be news or warnings, the brand is shown.
  // ==========================================
  { id: "block.psa.brand-blokir", donator: "user1", msg: "Pemerintah lagi blokir situs hoki88", block: true },
  { id: "block.psa.brand-warning", donator: "user2", msg: "Hati hati main di jayatoto banyak penipu", block: true },
  { id: "block.psa.brand-news", donator: "user3", msg: "Berita terbaru sultan33 ditangkap polisi", block: true },
  { id: "block.psa.brand-advice", donator: "user4", msg: "Jangan main mahjong77 ntar miskin lo", block: true },
  { id: "block.psa.brand-kominfo", donator: "user5", msg: "Info blokir ligabola dari kominfo hari ini", block: true },
  {
    id: "block.psa.brand-comparison",
    donator: "user6",
    msg: "Awas web palsu, yang asli cuma kantorbola99",
    block: true,
  },
  { id: "block.psa.brand-scam", donator: "user7", msg: "Gacor88 scam jangan kesana guys", block: true },
  { id: "block.psa.brand-runaway", donator: "user8", msg: "Hati-hati agen138 bawa kabur uang", block: true },
  { id: "block.psa.megajp", donator: "user9", msg: "Hati-hati MEGAJP lagi diincar kominfo", block: true },

  // ==========================================
  // 2. EXPLICIT BRANDS & DOMAINS IN PROMOS (Strict Block)
  // ==========================================
  { id: "block.brand.hoki88", donator: "promo1", msg: "Modal 10k auto paus di HOKI88", block: true },
  { id: "block.brand.kantorbola99", donator: "promo2", msg: "KANTORBOLA99 rtp live hijau terus", block: true },
  { id: "block.brand.ligabola", donator: "promo3", msg: "Parlay parah cuma di LIGABOLA", block: true },
  { id: "block.brand.jayatoto", donator: "promo4", msg: "Daftar JAYATOTO diskon togel 66%", block: true },
  { id: "block.brand.mahjong77", donator: "promo5", msg: "MAHJONG77 lagi bagi-bagi bonus new member", block: true },
  { id: "block.brand.rajaslot", donator: "promo6", msg: "RAJASLOT kasih garansi kekalahan 100%", block: true },
  { id: "block.brand.dewajp", donator: "promo7", msg: "Cek langsung ke dewajp.com", block: true },
  { id: "block.brand.gacor88", donator: "promo8", msg: "Login gacor88.vip sekarang mumpung server bocor", block: true },
  { id: "block.brand.agen138", donator: "promo9", msg: "Server luar agen138.net paling legit", block: true },
  { id: "block.brand.sultanjp", donator: "promo10", msg: "SULTANJP maxwin setiap hari", block: true },
  { id: "block.brand.sultan77", donator: "promo11", msg: "Main di SULTAN77 pasti gampang menang", block: true },
  { id: "block.brand.megajp", donator: "promo12", msg: "Daftar MEGAJP depo 20k bonus 20k", block: true },
  { id: "block.brand.bosstoto", donator: "promo13", msg: "Pasang nomor di BOSSTOTO aja", block: true },
  { id: "block.brand.dewaslot", donator: "promo14", msg: "DEWASLOT situs paling terpercaya 2024", block: true },
  { id: "block.brand.panen138", donator: "promo15", msg: "Link alternatif panen138 anti blokir", block: true },
  { id: "block.brand.naga168", donator: "promo16", msg: "NAGA168 rtp paling akurat", block: true },
  { id: "block.brand.hokiwin", donator: "promo17", msg: "HOKIWIN bagi bagi scatter gratis", block: true },
  { id: "block.brand.bola88", donator: "promo18", msg: "Taruhan piala asia di bola88", block: true },
  { id: "block.brand.zeus138", donator: "promo19", msg: "Petir merah zeus138 sering turun", block: true },
  { id: "block.domain.me", donator: "promo20", msg: "Langsung login ke hokiwin.me", block: true },
  { id: "block.domain.asia", donator: "promo21", msg: "Server paling cepat bosstoto.asia", block: true },

  // ==========================================
  // 3. BRAND IN DONATOR NAME (Strict Block)
  // ==========================================
  { id: "block.name.hoki88", donator: "Admin_Hoki88", msg: "Halo bang semangat", block: true },
  { id: "block.name.kantorbola", donator: "CS_KantorBola", msg: "Kopi bang buat nemenin stream", block: true },
  { id: "block.name.rajaslot", donator: "RajaSlot_Official", msg: "Mabar ML yuk", block: true },
  { id: "block.name.dewajp", donator: "DewaJP_VIP", msg: "Gas terus bang", block: true },
  { id: "block.name.bola99", donator: "Bola99_Link", msg: "Mantap bang jago", block: true },
  { id: "block.name.totomacau", donator: "TotoMacau_Agent", msg: "Salam dari binjai", block: true },
  { id: "block.name.slot88", donator: "Slot88_Gacor", msg: "GGWP", block: true },
  { id: "block.name.pgbet", donator: "PGBet_CS", msg: "Selamat pagi", block: true },
  { id: "block.name.sultan33", donator: "Sultan33_WD", msg: "Tidur bang udah malem", block: true },
  { id: "block.name.mahjong77", donator: "Mahjong77_JP", msg: "Sip mantap", block: true },
  { id: "block.name.sultan77", donator: "Sultan77_Gacor", msg: "Mabar bang", block: true },
  { id: "block.name.megajp", donator: "Admin_MegaJP", msg: "Sehat selalu", block: true },
  { id: "block.name.naga168", donator: "Naga168_Official", msg: "Nih kopi", block: true },
  { id: "block.name.zeus138", donator: "Zeus138_Login", msg: "Test", block: true },

  // ==========================================
  // 4. OBFUSCATED BRANDS (Strict Block)
  // ==========================================
  { id: "block.obf.leet1", donator: "hacker", msg: "coba d1 H0K188 p4st1 c41r", block: true },
  { id: "block.obf.space1", donator: "spam1", msg: "k a n t o r b o l a 9 9 wd lancar", block: true },
  { id: "block.obf.punct1", donator: "spam2", msg: "l.i.g.a.b.o.l.a deposit tanpa potongan", block: true },
  { id: "block.obf.space2", donator: "spam3", msg: "M A H J O N G 7 7 bgi bgi fr33sp1n", block: true },
  { id: "block.obf.leet2", donator: "spam4", msg: "d3w4jp modal receh maxwin", block: true },
  { id: "block.obf.leet3", donator: "spam5", msg: "g4c0r88 anti rungkad", block: true },
  { id: "block.obf.space3", donator: "spam6", msg: "a g e n 1 3 8 server luar", block: true },
  { id: "block.obf.punct2", donator: "spam7", msg: "s/u/l/t/a/n/j/p", block: true },
  { id: "block.obf.leet4", donator: "spam8", msg: "B0LA99 parlay jitu", block: true },
  { id: "block.obf.leet5", donator: "spam9", msg: "w!nl!ve4d pasti bayar", block: true },
  { id: "block.obf.leet6", donator: "spam10", msg: "m3r4hput1h gaskeun", block: true },
  { id: "block.obf.leet7", donator: "spam11", msg: "pgb3t rtp 99%", block: true },
  { id: "block.obf.vertical", donator: "spam12", msg: "S\nU\nL\nT\nA\nN\n3\n3", block: true },
  { id: "block.obf.homoglyph1", donator: "spam13", msg: "MÄHJÖNG77 scatter hitam", block: true },
  { id: "block.obf.homoglyph2", donator: "spam14", msg: "ËTH8877 gass poll", block: true },
  { id: "block.obf.panen138", donator: "spam15", msg: "p4n3n138 wd berapapun dibayar", block: true },
  { id: "block.obf.dewaslot", donator: "spam16", msg: "d e w a s l o t tempat para sultan", block: true },
  { id: "block.obf.bosstoto", donator: "spam17", msg: "B_O_S_S_T_O_T_O aman dan terpercaya", block: true },
  { id: "block.cta.brand_search", donator: "spam18", msg: "Ketik NAGA168 di google sekarang", block: true },
  { id: "block.cta.abbreviation", donator: "spam19", msg: "Ktik eth 77 di g00gl3 jam1n mldak jd1 sult4n", block: true },

  // ==========================================
  // 5. CALL TO ACTION - NO BRAND, BUT SUSPICIOUS LINK/PROFILE (Block)
  // ==========================================
  { id: "block.cta.bio", donator: "bot1", msg: "Link daftar ada di bio ya bos", block: true },
  { id: "block.cta.wa", donator: "bot2", msg: "Info pola hubungi WA 081234567890", block: true },
  { id: "block.cta.tele", donator: "bot3", msg: "Join grup telegram buat bocoran admin", block: true },
  { id: "block.cta.profile", donator: "bot4", msg: "Cek profil gue buat link gacor", block: true },
  { id: "block.cta.desc", donator: "bot5", msg: "Klik link di deskripsi ya bang", block: true },
  { id: "block.cta.shortlink", donator: "bot6", msg: "Cek sini bit.ly/gacor-hari-ini", block: true },
  { id: "block.cta.referral", donator: "bot7", msg: "Pakai kode referral ku dapet 50rb", block: true },
  { id: "block.cta.freespin", donator: "bot8", msg: "Klaim freespin harian kamu disini", block: true },
  { id: "block.cta.promo", donator: "bot9", msg: "Buruan daftar sebelum promo habis", block: true },
  { id: "block.cta.search", donator: "bot10", msg: "Cari di google pasti dijamin cuan gede", block: true },

  // ==========================================
  // 6. AMBIGUOUS / JARGON ONLY (Strict Review)
  // Heavily suggestive of judol, but missing explicit brand context.
  // ==========================================
  {
    id: "block.jargon.wd",
    donator: "player3",
    msg: "Nyari situs yang wd berapapun pasti dibayar lunas bosku",
    block: true,
  },
  { id: "review.jargon.depo", donator: "player11", msg: "Gimana cara depo via pulsa?", ideal: "review" },
  {
    id: "review.jargon.garansi",
    donator: "player12",
    msg: "Lagi cari yang garansi kekalahan 100% saldo balik",
    ideal: "review",
  },
  { id: "review.jargon.bonus", donator: "player13", msg: "Bonus new member 200% di depan", ideal: "review" },
  { id: "review.jargon.tarik", donator: "player14", msg: "Tarik dana ke OVO 1 menit cair", ideal: "review" },
  { id: "review.ambig.wd_besar", donator: "anon1", msg: "Hari ini berhasil WD puluhan juta", ideal: "review" },
  { id: "review.ambig.gacor_bgt", donator: "anon2", msg: "Lagi gacor banget nih roomnya", ideal: "review" },
  { id: "review.ambig.pola_ampuh", donator: "anon3", msg: "Pakai pola ini pasti langsung tembus", ideal: "review" },
  { id: "review.ambig.link_bio", donator: "anon4", msg: "Cek link di bio IG gue ya", ideal: "review" },
  { id: "review.ambig.join_tele", donator: "anon5", msg: "Gabung grup tele buat info harian", ideal: "review" },
  { id: "review.ambig.modal_kecil", donator: "anon6", msg: "Modal 50k bisa jadi sultan", ideal: "review" },
  { id: "review.ambig.situs_luar", donator: "anon7", msg: "Server kamboja emang paling beda", ideal: "review" },
  { id: "review.ambig.x1000", donator: "anon8", msg: "Nunggu petir merah x1000 turun", ideal: "review" },
  { id: "allow.ambig.info_room", donator: "anon9", msg: "Minta info room yang lagi bagus dong", block: false },
  { id: "review.ambig.anti_rungkad", donator: "anon10", msg: "Cari yang anti rungkad dimana ya", ideal: "review" },
  { id: "review.ambig.garansi_modal", donator: "anon11", msg: "Ada garansi modal kembali 100 persen", ideal: "review" },
  { id: "review.ambig.depo_pulsa_tanya", donator: "anon12", msg: "Bisa deposit pakai pulsa tsel ga?", ideal: "review" },
  {
    id: "review.ambig.menang_banyak",
    donator: "anon13",
    msg: "Semalem menang banyak dari game sebelah",
    ideal: "review",
  },
  {
    id: "review.ambig.scatter_tanya",
    donator: "anon14",
    msg: "Gimana sih cara dapet scatter gampang?",
    ideal: "review",
  },
  { id: "review.ambig.akun_wangi", donator: "anon15", msg: "Akun gue lagi wangi banget nih bro", ideal: "review" },
  { id: "review.ambig.bagi_saldo", donator: "anon16", msg: "Ada event bagi-bagi saldo gratis", ideal: "review" },
  { id: "review.ambig.cair_cepat", donator: "anon17", msg: "Proses cair cuma hitungan menit doang", ideal: "review" },
  { id: "review.ambig.admin_bocor", donator: "anon18", msg: "Adminnya lagi bocorin rahasia", ideal: "review" },
  { id: "allow.ambig.situs_baru", donator: "anon19", msg: "Baru nemu tempat main yang enak parah", block: false },
  {
    id: "review.ambig.kode_referral",
    donator: "anon20",
    msg: "Pakai kode ini buat tambahan modal awal",
    ideal: "review",
  },

  // ==========================================
  // 7. JARGON ONLY - NO BRAND (Allow)
  // "Pointless promotion" because there is no destination. Usually just viewers chatting.
  // ==========================================
  { id: "allow.jargon.maxwin", donator: "player1", msg: "Gila dapet maxwin 10 juta modal receh doang", block: false },
  { id: "allow.jargon.rtp", donator: "player2", msg: "RTP kakek zeus lagi hijau nih", block: false },
  { id: "allow.jargon.jp", donator: "player4", msg: "Semalem gue JP paus modal receh", block: false },
  { id: "allow.jargon.rungkad", donator: "player5", msg: "Rungkad terus euy main ginian", block: false },
  { id: "allow.jargon.perkalian", donator: "player6", msg: "Pecah perkalian x500 bro seneng banget", block: false },
  {
    id: "allow.jargon.scatter",
    donator: "player7",
    msg: "Akhirnya tembus scatter hitam di mahjong bang",
    block: false,
  },
  { id: "allow.jargon.pola", donator: "player8", msg: "Pola room: 10x turbo, 20x manual", block: false },
  { id: "allow.jargon.pgsoft", donator: "player9", msg: "Server PG Soft lagi berat banget", block: false },
  { id: "allow.jargon.kakek", donator: "player10", msg: "Petir merah kakek zeus turun", block: false },
  { id: "allow.jargon.modal", donator: "player15", msg: "Modal 20k jadi 2jt gila sih", block: false },

  // ==========================================
  // 8. LEGITIMATE GAMING / DAILY LIFE / FINANCE (Allow)
  // False positive protections.
  // ==========================================
  { id: "allow.legit.slot-ml", donator: "gamer1", msg: "Slot mabar ML masih ada bang?", block: false },
  { id: "allow.legit.slot-parkir", donator: "user1", msg: "Nyari slot parkir di mall susah banget", block: false },
  { id: "allow.legit.slot-ram", donator: "tech1", msg: "Beli motherboard yang slot RAM nya 4", block: false },
  { id: "allow.legit.panci-toto", donator: "chef1", msg: "Masak pakai panci toto biar cepet", block: false },
  { id: "allow.legit.sepakbola", donator: "sport1", msg: "Nonton sepakbola timnas nanti malam", block: false },
  { id: "allow.legit.cuan", donator: "seller1", msg: "Wah gila cuan banyak jualan hari ini", block: false },
  { id: "allow.legit.pack-fifa", donator: "gamer2", msg: "Buka pack FIFA dapet icon ronaldo", block: false },
  { id: "allow.legit.discord", donator: "gamer3", msg: "Join discord buat mabar malam ini", block: false },
  { id: "allow.legit.server-jp", donator: "gamer4", msg: "Server JP ping nya gede ga?", block: false },
  { id: "allow.legit.gacha", donator: "gamer5", msg: "Gacha Genshin dapet rate off sedih bgt", block: false },
  { id: "allow.legit.hoki", donator: "gamer6", msg: "Hoki banget dapet drop item langka", block: false },
  { id: "allow.legit.crypto", donator: "investor1", msg: "Lagi narik USDT dari Binance", block: false },
  { id: "allow.legit.reksadana", donator: "investor2", msg: "Withdraw reksadana ke BCA lancar", block: false },
  { id: "allow.legit.wd-game", donator: "gamer7", msg: "Wah Watch Dogs legion lagi diskon", block: false },
  { id: "allow.legit.timeslot", donator: "worker1", msg: "Ubah timeslot meeting ke jam 3 sore", block: false },
  { id: "allow.legit.slot-ml", donator: "gamer8", msg: "Slot VIP ngantri ga bang?", block: false },
  {
    id: "allow.legit.question",
    donator: "gamer10",
    msg: "Bang gw topup dm di ngawistore 100rb cepet banget masuknya",
    block: false,
  },

  // ==========================================
  // 9. LEGITIMATE DONATIONS & NORMAL CHAT (Allow)
  // ==========================================
  { id: "allow.chat.kopi", donator: "fans1", msg: "Sedikit donasi buat beli kopi bang", block: false },
  { id: "allow.chat.panti", donator: "fans2", msg: "Titip donasi buat panti asuhan", block: false },
  { id: "allow.chat.qris", donator: "fans3", msg: "QRIS panitia buat bencana alam aktif?", block: false },
  { id: "allow.chat.request", donator: "fans4", msg: "Ini 50rb request lagu anime ya", block: false },
  { id: "allow.chat.salam", donator: "fans5", msg: "Halo bang salam kenal dari bandung", block: false },
  { id: "allow.chat.support", donator: "fans6", msg: "Sukses terus bang channelnya", block: false },
  { id: "allow.chat.berita", donator: "fans7", msg: "Tadi baca berita di kompas.com", block: false },
  { id: "allow.chat.server", donator: "tech2", msg: "Server AWS lagi down ya?", block: false },
  { id: "allow.chat.cashback", donator: "buyer1", msg: "Dapet cashback shopee 50%", block: false },
  { id: "allow.chat.semangat", donator: "fans8", msg: "Semangat streamnya bang!", block: false },
  { id: "allow.chat.cuaca", donator: "fan_bali", msg: "Hujan deras banget di Bali hari ini", block: false },
  {
    id: "allow.chat.makanan",
    donator: "foodie",
    msg: "Lagi makan sate padang enak banget sambil nonton",
    block: false,
  },
  { id: "allow.chat.tanya_jadwal", donator: "sub1", msg: "Bang besok stream jam berapa?", block: false },
  { id: "allow.gaming.rpg", donator: "gamer8", msg: "Gacha weapon di WuWa ampas banget asli", block: false },
  { id: "allow.gaming.fps", donator: "gamer9", msg: "Tembus rank Immortal di Valorant akhirnya", block: false },
  { id: "allow.gaming.boss", donator: "gamer10", msg: "Pola serangan boss Elden Ring DLC gila banget", block: false },
  { id: "allow.tech.gpu", donator: "tech3", msg: "Lagi nabung buat beli RTX 5090 nih", block: false },
  { id: "allow.tech.hp", donator: "tech4", msg: "Mending beli iPhone atau Samsung s24 ya bang?", block: false },
  { id: "allow.finance.gajian", donator: "worker2", msg: "Alhamdulillah gajian udah cair hari ini", block: false },
  { id: "allow.finance.nabung", donator: "saver1", msg: "Nabung di bank jago dapet bunga lumayan juga", block: false },
  { id: "allow.daily.bensin", donator: "driver1", msg: "Harga pertamax naik lagi ya sekarang?", block: false },
  { id: "allow.daily.paket", donator: "buyer2", msg: "Kurir paket shopee udah sampai depan rumah", block: false },
  {
    id: "allow.chat.kesehatan",
    donator: "sick_fan",
    msg: "Lagi flu berat nih bang, gak bisa mabar dulu",
    block: false,
  },
  { id: "allow.gaming.roblox", donator: "gamer11", msg: "Server blox fruit lagi down kah?", block: false },
  { id: "allow.daily.kendaraan", donator: "rider", msg: "Service motor dulu biar tarikan enteng", block: false },
  { id: "allow.chat.joke", donator: "joker", msg: "Lucu banget liat kelakuan kucing lu bang", block: false },
  { id: "allow.finance.paylater", donator: "buyer3", msg: "Wah tagihan paylater bulan ini bengkak", block: false },
  { id: "allow.daily.belanja", donator: "buyer4", msg: "Diskon flash sale di tokped mantap bener", block: false },
  { id: "allow.chat.nonton", donator: "movie_fan", msg: "Baru selesai nonton film dune 2, epik parah", block: false },
  { id: "allow.gaming.moba", donator: "gamer12", msg: "Draft pick nya aneh banget tim lu bang tadi", block: false },
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
