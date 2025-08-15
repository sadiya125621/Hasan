module.exports.config = {
    name: 'removebg',
    version: '1.1.2',
    hasPermssion: 0,
    credits: 'Naim + ChatGPT',
    description: 'Removes background from replied image',
    usePrefix: true,
    commandCategory: 'Tools',
    usages: 'Reply to an image with /removebg',
    cooldowns: 3,
    dependencies: {
        'form-data': '',
        'image-downloader': ''
    }
};

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');
const { image } = require('image-downloader');

module.exports.run = async function({ api, event }) {
    try {
        const processingMsg = `🖼️=== [ REMOVING BACKGROUND ] ===🖼️`;

        // Must reply to a photo
        if (event.type !== "message_reply") {
            return api.sendMessage("❌ অনুগ্রহ করে ব্যাকগ্রাউন্ড রিমুভ করার জন্য একটি ছবির রিপ্লাই করুন।", event.threadID, event.messageID);
        }
        if (!event.messageReply.attachments || event.messageReply.attachments.length === 0) {
            return api.sendMessage("❌ কোন ছবি পাওয়া যায়নি।", event.threadID, event.messageID);
        }
        if (event.messageReply.attachments[0].type !== "photo") {
            return api.sendMessage("❌ শুধুমাত্র ছবির ব্যাকগ্রাউন্ড রিমুভ করা যাবে।", event.threadID, event.messageID);
        }

        // Download the replied image
        const imageUrl = event.messageReply.attachments[0].url;
        const inputPath = path.resolve(__dirname, 'cache', `photo_${Date.now()}.png`);
        await fs.ensureDir(path.resolve(__dirname, 'cache'));
        await image({ url: imageUrl, dest: inputPath });

        // Your Remove.bg API keys
        const MtxApi = [
            "YOUR_REMOVE_BG_API_KEY" // এখানে নিজের key বসাও
        ];

        // Send processing message
        api.sendMessage(processingMsg, event.threadID, event.messageID);

        // Prepare form data for API call
        const formData = new FormData();
        formData.append('size', 'auto');
        formData.append('image_file', fs.createReadStream(inputPath), path.basename(inputPath));

        // Call remove.bg API
        const response = await axios({
            method: 'post',
            url: 'https://api.remove.bg/v1.0/removebg',
            data: formData,
            responseType: 'arraybuffer',
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': MtxApi[Math.floor(Math.random() * MtxApi.length)]
            }
        });

        if (response.status !== 200) {
            return api.sendMessage(`❌ ব্যাকগ্রাউন্ড রিমুভ করতে ব্যর্থ হয়েছে।`, event.threadID, event.messageID);
        }

        // Save processed image
        fs.writeFileSync(inputPath, response.data);

        // Send result back
        return api.sendMessage({
            body: "✅ ব্যাকগ্রাউন্ড সফলভাবে রিমুভ করা হয়েছে!",
            attachment: fs.createReadStream(inputPath)
        }, event.threadID, () => fs.unlinkSync(inputPath));

    } catch (err) {
        console.error(err);
        return api.sendMessage("❌ সার্ভার ব্যস্ত, পরে আবার চেষ্টা করুন।", event.threadID, event.messageID);
    }
};
