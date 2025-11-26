class IntentEngine {
  constructor() {
    this.rules = [];
  }

  // Mendaftarkan pattern dan handler
  define(patternFunc, handlerFunc) {
    this.rules.push({ pattern: patternFunc, handler: handlerFunc });
  }

  // Menafsirkan input user
  async interpret(command, ctx) {
    const text = command.toLowerCase();

    // Loop semua aturan yang ada
    for (const { pattern, handler } of this.rules) {
      if (pattern(text)) {
        try {
          await handler(ctx);
          return true; // Match found
        } catch (err) {
          console.error("❌ Error executing intent:", err);
          await ctx.sock.sendMessage(ctx.from, {
            text: "⚠️ Terjadi kesalahan sistem saat memproses niat Anda.",
          });
          return true;
        }
      }
    }

    return false; // No match found
  }
}

module.exports = new IntentEngine();
