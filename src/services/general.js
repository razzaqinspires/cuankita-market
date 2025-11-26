const db = require("../database/core");
const registry = require("../engine/commandRegistry");

async function performMenu(ctx) {
  const config = db.load("config");
  const categorizedCommands = registry.getCategorizedCommands();

  // PERBAIKAN LOGIKA HITUNG TOTAL COMMAND
  let totalCommands = 0;
  Object.values(categorizedCommands).forEach(
    (list) => (totalCommands += list.length),
  );

  let text = `🤖 *CUANKITA SYSTEM v${config.system_version || "2.3.0"}*
👋 Halo, ${ctx.sender.split("@")[0]}
_Total ${totalCommands} fitur siap digunakan._
`;

  for (const category in categorizedCommands) {
    text += `\n*${category.toUpperCase()}*\n`;
    categorizedCommands[category].forEach((cmd) => {
      text += `.${cmd.rawCommand} ${cmd.args} - ${cmd.description}\n`;
    });
  }

  text += `\n_Ketik perintah tanpa tanda kurung.\n_Powered by Intent-Aware Engine`;

  await ctx.sock.sendMessage(ctx.from, { text: text.trim() });
}

async function performOwnerInfo(ctx) {
  const config = db.load("config");
  const ownerNum = config.owner_jid ? config.owner_jid.split("@")[0] : "-";
  await ctx.sock.sendMessage(ctx.from, {
    text: `👑 *OWNER INFO*\n\nNomor: wa.me/${ownerNum}\nStatus: Developer & Bandar Pasar`,
  });
}

async function performPing(ctx) {
  const start = Date.now();
  await ctx.sock.sendMessage(ctx.from, { text: "🏓 Pong!" });
  const latensi = Date.now() - start;
  await ctx.sock.sendMessage(ctx.from, {
    text: `Kecepatan Respon: ${latensi}ms`,
  });
}

// --- FITUR BARU: LEADERBOARD (TOP GLOBAL) ---
async function performLeaderboard(ctx) {
  const users = db.load("users");
  const market = db.load("market_data");
  const price = market.current_price || 1000;

  // 1. Ubah Object User ke Array dan Hitung Kekayaan
  const richList = Object.keys(users).map((jid) => {
    const u = users[jid];
    const saldo = u.saldo || 0;
    const assets = (u.assets?.ara_coin || 0) * price;
    return {
      jid: jid,
      tag: jid.split("@")[0], // Ambil nomor HP
      totalWealth: saldo + assets,
    };
  });

  // 2. Urutkan dari Paling Kaya (Descending)
  richList.sort((a, b) => b.totalWealth - a.totalWealth);

  // 3. Ambil Top 10
  const top10 = richList.slice(0, 10);

  let text =
    `🏆 *TOP 10 SULTAN CUANKITA* 🏆\n` + `_Siapa penguasa pasar $ARA?_\n\n`;

  top10.forEach((sultan, index) => {
    let medal = "";
    if (index === 0) medal = "🥇";
    else if (index === 1) medal = "🥈";
    else if (index === 2) medal = "🥉";
    else medal = `${index + 1}.`;

    text += `${medal} *${sultan.tag}*\n   💰 Rp ${sultan.totalWealth.toLocaleString()}\n`;
  });

  // Cek posisi user sendiri
  const myRank = richList.findIndex((x) => x.jid === ctx.from) + 1;
  text += `\n---------------------------\n`;
  text += `🫵 Posisi Anda: Peringkat #${myRank}`;

  await ctx.sock.sendMessage(ctx.from, { text: text });
}

module.exports = {
  performMenu,
  performOwnerInfo,
  performPing,
  performLeaderboard,
};
