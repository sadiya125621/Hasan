/**
 * Command: /removebg
 * কাজ: গ্রুপে ছবির রিপ্লাই করলে ব্যাকগ্রাউন্ড রিমুভ করে রিপ্লাই করে দিবে
 */

const fs = require("fs");
const axios = require("axios");

module.exports.config = {
    name: "removebg",
    description: "Removes background from a photo",
    usage: "/removebg (Reply to an image)",
    cooldown: 5,
};

module.exports.run = async ({ api, event }) => {
    try {
        // Check if the message is a reply to an image
        if (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0) {
            return api.sendMessage(
                "❌ অনুগ্রহ করে একটি ছবির সাথে রিপ্লাই করুন।",
                event.threadID
            );
        }

        const imageUrl = event.messageReply.attachments[0].url;

        // তোমার Remove.bg API Key এখানে বসাও
        const removeBgApiKey = "YOUR_REMOVE_BG_API_KEY";

        // Remove.bg API কল
        const response = await axios({
            method: "post",
            url: "https://api.remove.bg/v1.0/removebg",
            data: {
                image_url: imageUrl,
                size: "auto"
            },
            headers: {
                "X-Api-Key": removeBgApiKey
            },
            responseType: "arraybuffer"
        });

        // প্রক্রিয়াজাত ছবি সেভ করা
        const filePath = `/tmp/removebg_${Date.now()}.png`;
        fs.writeFileSync(filePath, response.data);

        // গ্রুপে পাঠানো
        api.sendMessage(
            {
                body: "🎉 ব্যাকগ্রাউন্ড রিমুভ করা হয়েছে!",
                attachment: fs.createReadStream(filePath)
            },
            event.threadID,
            () => fs.unlinkSync(filePath) // পাঠানোর পরে ফাইল ডিলিট
        );

    } catch (error) {
        console.error(error);
        api.sendMessage(
            "❌ কিছু ভুল হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।",
            event.threadID
        );
    }
};
