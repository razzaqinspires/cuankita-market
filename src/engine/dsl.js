const engine = require("./intentEngine");

/**
 * DSL PARSER
 * Mengubah bahasa manusia "When... Expect... Perform" menjadi Logic.
 */
function when(line) {
  // Regex untuk menangkap pola: when message: "kata_kunci"
  const match = line.match(/when message: "(.*)"/);
  const keyword = match ? match[1] : null;

  const block = {
    expects: [],
    performs: [],
  };

  return {
    expect(field) {
      block.expects.push(field);
      return this;
    },
    perform(actionFunction) {
      block.performs.push(actionFunction);
      return this;
    },
    commit() {
      if (!keyword) {
        console.error(
          "❌ DSL Error: Pattern 'when message' tidak valid:",
          line,
        );
        return;
      }
      // Daftarkan ke Engine
      engine.define(
        (input) => input === keyword.toLowerCase(), // Exact match (bisa diubah jadi contains)
        async (ctx) => {
          console.log(`🤖 Executing Intent: [${keyword}]`);
          // Validasi fields (expects) bisa ditambahkan disini

          // Jalankan semua action
          for (const action of block.performs) {
            await action(ctx);
          }
        },
      );
    },
  };
}

module.exports = { when };
