// ai.js — Advanced, drop-in compatible
const axios = require("axios");

/**
 * ছোট্ট থ্রেড-মেমোরি: একই গ্রুপ/থ্রেডে শেষ কয়েকটা বার্তা জমা রাখে
 * বট রিস্টার্ট হলে মেমোরি রিসেট হবে (ইন-মেমোরি)
 */
const memoryByThread = new Map();
const MAX_MEMORY = 5;

// তোমার আগের এন্ডপয়েন্ট প্যাটার্নই রাখা হলো
const GEMINI_ENDPOINT = "https://gehs.onrender.com/chat-with-gemini";
// ইমেজ না থাকলে: "text_only", ইমেজ থাকলে: "text_and_image"

module.exports = {
  config: {
    name: "ai",
    version: "2.0.0",
    credit: "Naim + GPT-5 Thinking",
    description: "Gemini AI (text + image) with context & language auto-detect",
    cooldowns: 3,
    hasPermssion: 0,
    commandCategory: "AI",
    usages: {
      en: "ai <message> (or reply to an image with: ai <prompt>)"
    }
  },

  run: async ({ api, args, event }) => {
    const threadID = event.threadID;
    const messageID = event.messageID;

    // ইউজার ইনপুট
    const userText = args.join(" ").trim();

    // রিপ্লাই করা মেসেজ/অ্যাটাচমেন্ট বের করা
    const replied = event.messageReply || null;
    const repliedAttachments = replied?.attachments || [];
    const currentAttachments = event.attachments || [];

    // কোন ইমেজ আছে কি না খোঁজা (রিপ্লাই করা মেসেজে বা বর্তমান মেসেজে)
    const findImageUrl = (atts) => {
      for (const a of atts) {
        const t = (a.type || "").toLowerCase();
        if (t.includes("photo") || t.includes("image")) {
          if (a.url) return a.url;
          if (a.previewUrl) return a.previewUrl;
          if (a.hiresUrl) return a.hiresUrl;
        }
      }
      return null;
    };

    const repliedImage = findImageUrl(repliedAttachments);
    const currentImage = findImageUrl(currentAttachments);
    const imageUrl = repliedImage || currentImage;

    // কিছু না লিখে দিলে এবং কোনো ইমেজও না থাকলে—ব্যবহারের বার্তা
    if (!userText && !imageUrl) {
      return api.sendMessage(
        "✍️ কিছু লিখুন (যেমন: `ai আমার জন্য একটা ক্যাপশন দাও`) অথবা কোনো ছবিতে রিপ্লাই করে `ai <prompt>` লিখুন।",
        threadID,
        messageID
      );
    }

    // বাংলা/ইংরেজি সনাক্তকরণ (খুব লাইটওয়েট)
    const isBangla = /[\u0980-\u09FF]/.test(userText || (replied?.body || ""));
    const langInstr = isBangla
      ? "আপনি বাংলায় স্পষ্ট, ভদ্র ও সহায়ক ভঙ্গিতে উত্তর দেবেন। প্রয়োজন হলে ছোট উদাহরণ দিন।"
      : "Reply in clear, polite, and helpful English. Add concise examples if useful.";

    // থ্রেড কনটেক্সট (আগের 5টা বিনিময়)
    const history = memoryByThread.get(threadID) || [];
    const clippedHistory = history.slice(-MAX_MEMORY);

    // রিপ্লাই করা টেক্সট থাকলে কনটেক্সটে যোগ করি
    const repliedText = replied?.body ? `\n\n[Replied message]: ${replied.body}` : "";

    // সিস্টেম/ইন্সট্রাকশন + কনটেক্সট
    const systemPrompt = [
      "You are a friendly, concise, and knowledgeable assistant.",
      "Be accurate and avoid hallucinations. If unsure, say you are unsure.",
      "Format short lists with bullets and keep answers tight but complete.",
      langInstr
    ].join(" ");

    // কনটেক্সট বিল্ড
    const contextBlock = clippedHistory
      .map((turn, i) => `Turn ${i + 1}:\nUser: ${turn.user}\nAI: ${turn.ai}`)
      .join("\n\n");

    const fullPrompt = [
      `System: ${systemPrompt}`,
      contextBlock ? `\n\n[Conversation Memory]\n${contextBlock}` : "",
      `\n\nUser: ${userText || "(no text, image-based request)"}${repliedText}`,
      "Assistant:"
    ].join("");

    // API পে-লোড তৈরি
    const payload = {
      modelType: imageUrl ? "text_and_image" : "text_only",
      prompt: fullPrompt
    };
    if (imageUrl) {
      payload.imageParts = [imageUrl];
    }

    // টাইপিং ফিডব্যাক (সাপোর্ট থাকলে)
    try {
      api.sendTypingIndicator?.(threadID);
    } catch (_) {}

    try {
      const res = await axios.post(GEMINI_ENDPOINT, payload, {
        timeout: 25_000 // 25s
      });

      const result =
        (res && res.data && (res.data.result || res.data.text || res.data.reply)) ||
        "";

      const replyText =
        result.trim() ||
        (isBangla
          ? "দুঃখিত, আমি এই মুহূর্তে উত্তর প্রস্তুত করতে পারিনি। একটু পরে আবার চেষ্টা করুন।"
          : "Sorry, I couldn't generate a reply right now. Please try again shortly.");

      // মেসেজ পাঠানো
      api.sendMessage(replyText, threadID, messageID);

      // মেমোরি আপডেট
      const newTurn = {
        user: userText || (imageUrl ? "[image]" : ""),
        ai: replyText
      };
      memoryByThread.set(threadID, [...clippedHistory, newTurn].slice(-MAX_MEMORY));
    } catch (err) {
      console.error("[AI ERROR]", err?.response?.data || err?.message || err);

      const msg = isBangla
        ? "⚠️ AI সার্ভারে সমস্যা হচ্ছে বা সময় শেষ হয়ে গেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।"
        : "⚠️ The AI server had an issue or timed out. Please try again later.";
      api.sendMessage(msg, threadID, messageID);
    }
  }
};
