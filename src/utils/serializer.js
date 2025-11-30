const { proto } = require('@whiskeysockets/baileys');

// Daftar prefix yang diizinkan untuk command bot
const PREFIXES = /^[.!#?]/;

/**
 * Mengekstrak teks dari berbagai jenis pesan Baileys
 */
function extractMessageText(M) {
    if (M.message) {
        if (M.message.conversation) return M.message.conversation;
        if (M.message.extendedTextMessage?.text) return M.message.extendedTextMessage.text;
        if (M.message.imageMessage?.caption) return M.message.imageMessage.caption;
        if (M.message.videoMessage?.caption) return M.message.videoMessage.caption;
        if (M.message.buttonsResponseMessage?.selectedButtonId) return M.message.buttonsResponseMessage.selectedButtonId;
        if (M.message.listResponseMessage?.singleSelectReply?.selectedRowId) return M.message.listResponseMessage.singleSelectReply.selectedRowId;
    }
    return '';
}

/**
 * Serializer Utama (FIXED ARGUMENT ORDER)
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Instance Baileys
 * @param {proto.IWebMessageInfo} M - Objek Pesan
 */
function serialize(sock, M) {
    // Safety check jika M kosong/undefined
    if (!M || !M.key) return {};

    const from = M.key.remoteJid || '';
    const isGroup = from.endsWith('@g.us');
    
    // Tentukan pengirim (sender)
    // Jika di grup: ambil participant. Jika pribadi: ambil remoteJid
    const sender = isGroup ? (M.key.participant || from) : from;
    
    // 1. Ekstrak Teks
    let text = extractMessageText(M).trim();
    
    // 2. Ekstrak Quoted Message (Pesan yang dibalas)
    let quoted = null;
    if (M.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedM = M.message.extendedTextMessage.contextInfo;
        quoted = {
            JID: quotedM.participant || '',
            message: quotedM.quotedMessage,
            text: extractMessageText({ message: quotedM.quotedMessage })
        };
    }

    // 3. Command & Argumen Parsing
    let command = '';
    let args = [];
    
    if (text.match(PREFIXES)) {
        // Hapus prefix dan pisahkan command dari argumen
        const parts = text.slice(1).trim().split(/\s+/);
        command = parts[0]?.toLowerCase() || '';
        args = parts.slice(1);
    }
    
    // 4. Final Context Object (ctx)
    return {
        from,
        sender,
        isGroup,
        text, 
        command, 
        args, 
        M, 
        sock, 
        quoted 
    };
}

module.exports = { serialize };