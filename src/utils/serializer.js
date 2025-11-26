const {
  getContentType,
  jidNormalizedUser,
  isJidGroup,
} = require("@whiskeysockets/baileys");

/**
 * Serializer Pesan Canggih
 * Membersihkan dan menstandarisasi pesan masuk Baileys.
 */
function serialize(sock, m) {
  if (!m) return m;

  let msg = m;
  let type = getContentType(msg.message);

  // Dapatkan body/teks pesan
  let body =
    type === "conversation" && msg.message.conversation
      ? msg.message.conversation
      : type === "imageMessage" && msg.message.imageMessage.caption
        ? msg.message.imageMessage.caption
        : type === "videoMessage" && msg.message.videoMessage.caption
          ? msg.message.videoMessage.caption
          : type === "extendedTextMessage" &&
              msg.message.extendedTextMessage.text
            ? msg.message.extendedTextMessage.text
            : "";

  // Dapatkan JID yang mengirim pesan (SANGAT KRITIS)
  // Logika: Jika dari grup, ambil participant. Jika dari personal chat, ambil remoteJid.
  let sender = msg.key.remoteJid;
  if (isJidGroup(sender)) {
    sender = msg.key.participant || sender;
  } else {
    sender = msg.key.fromMe ? jidNormalizedUser(sock.user.id) : sender;
  }

  // Dapatkan target chat (remoteJid)
  let remoteJid = msg.key.remoteJid;

  // Dapatkan mentions (semua JID yang di-tag)
  let mentions = [];
  if (
    msg.message &&
    msg.message.extendedTextMessage &&
    msg.message.extendedTextMessage.contextInfo &&
    msg.message.extendedTextMessage.contextInfo.mentionedJid
  ) {
    mentions = msg.message.extendedTextMessage.contextInfo.mentionedJid;
  }

  // Dapatkan Quoted Message (jika ada)
  let quoted = null;
  if (
    msg.message &&
    msg.message.extendedTextMessage &&
    msg.message.extendedTextMessage.contextInfo &&
    msg.message.extendedTextMessage.contextInfo.quotedMessage
  ) {
    // Kita hanya mengambil pesan yang di-quoted sebagai teks untuk Intent Engine
    let quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
    let quotedType = getContentType(quotedMsg);

    quoted = {
      type: quotedType,
      text:
        quotedType === "extendedTextMessage"
          ? quotedMsg.extendedTextMessage.text
          : quotedMsg[quotedType]?.caption || quotedMsg[quotedType]?.text || "",
    };
  }

  // Objek pesan yang sudah bersih dan terstruktur
  return {
    m: msg,
    type,
    body,
    text: body.trim(),
    command: body.startsWith(".")
      ? body.split(" ")[0].slice(1).toLowerCase()
      : null,
    args: body.startsWith(".") ? body.trim().split(" ").slice(1) : [],
    sender,
    remoteJid,
    mentions,
    quoted,
  };
}

module.exports = { serialize };
