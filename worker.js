const { Client } = require("discord.js-selfbot-v13");
const { Manager } = require("erela.js");

// Global crash protection
process.on("unhandledRejection", (err) => {
  console.error("🚨 Unhandled Rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("🚨 Uncaught Exception:", err);
});

// Token from master
const token = process.argv[2];
if (!token) {
  console.error("❌ No token provided to worker");
  process.exit(1);
}

// ✅ Owner ID
const OWNER_ID = "1404122605262213211"; // change to your Discord ID
let WHITELIST = [OWNER_ID];

const client = new Client({ checkUpdate: false });

// Lavalink node
client.manager = new Manager({
  nodes: [
    {
      host: "lava-v3.ajieblogs.eu.org",
      port: 80,
      password: "https://dsc.gg/ajidevserver",
      secure: false,
    },
  ],
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
});

// Lavalink event logging
client.manager.on("nodeConnect", node =>
  console.log(`✅ Connected to Lavalink node: ${node.options.identifier || node.options.host}`)
);
client.manager.on("nodeError", (node, error) =>
  console.error(`🚨 Node error [${node.options.identifier || node.options.host}]:`, error.message)
);
client.manager.on("nodeDisconnect", (node, reason) =>
  console.warn(`⚠️ Node disconnected: ${node.options.identifier || node.options.host} (${reason})`)
);

client.on("raw", d => client.manager.updateVoiceState(d));

client.once("ready", () => {
  console.log(`[WORKER] Logged in as ${client.user.tag}`);
  client.manager.init(client.user.id);
});

// helper function
function formatDuration(ms) {
  if (!ms || isNaN(ms)) return "0:00";
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// helper function to extract user ID from mention or raw ID
function extractUserId(input) {
  if (!input) return null;
  // Remove <@ and > from mentions, and ! if present
  const cleaned = input.replace(/[<@!>]|\s/g, '');
  // Check if it's a valid Discord ID (numeric string)
  return /^\d{17,19}$/.test(cleaned) ? cleaned : null;
}

// command handler
client.on("messageCreate", async (msg) => {
  if (!msg.content) return;

  let args, cmd;
  try {
    args = msg.content.trim().split(/\s+/);
    cmd = args.shift().toLowerCase();
  } catch (e) {
    console.error("🚨 Failed parsing message:", e);
    return;
  }

  try {
    // whitelist management (owner only)
    if (cmd === "whitelist") {
      if (msg.author.id !== OWNER_ID) return msg.reply("❌ Only the owner can manage whitelist");
      const subcmd = args.shift()?.toLowerCase();
      const targetInput = args[0];
      const targetId = extractUserId(targetInput);
      
      if (subcmd === "add") {
        if (!targetId) return msg.reply("❌ Usage: `whitelist add <@user|userId>`");
        if (!WHITELIST.includes(targetId)) {
          WHITELIST.push(targetId);
          return msg.reply(`✅ Added <@${targetId}> to whitelist`);
        } else return msg.reply("⚠️ Already whitelisted");
      }
      if (subcmd === "remove") {
        if (!targetId) return msg.reply("❌ Usage: `whitelist remove <@user|userId>`");
        if (WHITELIST.includes(targetId)) {
          WHITELIST = WHITELIST.filter(id => id !== targetId && id !== OWNER_ID);
          return msg.reply(`✅ Removed <@${targetId}> from whitelist`);
        } else return msg.reply("⚠️ Not in whitelist");
      }
      if (subcmd === "show") {
        if (WHITELIST.length === 0) return msg.reply("⚠️ Whitelist empty");
        return msg.reply("👑 Whitelist:\n" + WHITELIST.map(id => `<@${id}>`).join("\n"));
      }
      return msg.reply("⚠️ Usage: `whitelist add/remove/show <@user|userId>`");
    }

    // help
    if ((cmd === "help" || cmd === "commands") && WHITELIST.includes(msg.author.id)) {
      let helpMsg =
       "🎵 **MADE BY AMAZE-X**\n\n" +
        "📖 **Available Commands**\n\n" +
        "**🎵 Music Controls**\n" +
        "`play <song>` – Play a track or playlist (clears previous queue)\n" +
        "`pause` – Pause the player\n" +
        "`resume` – Resume playback\n" +
        "`stop` – Stop and leave VC\n" +
        "`skip` – Skip current track\n" +
        "`queue` | `q` – Show queue\n" +
        "`nowplaying` | `np` – Show current track\n" +
        "`volume <0-13000>` – Adjust volume\n" +
        "`shuffle` – Shuffle the queue\n" +
        "`loop` – Toggle loop (none/track/queue)\n" +
        "`clear` – Clear the queue\n" +
        "`remove <pos>` – Remove a song from queue\n" +
        "`seek <seconds>` – Seek within a track\n" +
        "`lyrics` – Get lyrics link\n" +
        "`bassboost <0-5>` – Adjust bass boost\n\n" +
        "**⚙️ Utility**\n" +
        "`ping` – Show latency\n" +
        "`stats` – Show bot stats\n" +
        "`uptime` – Show uptime\n";

      // 👑 Owner gets whitelist commands too
      if (msg.author.id === OWNER_ID) {
        helpMsg +=
          "\n**👑 Whitelist Management (Owner only)**\n" +
          "`whitelist add <@user|userId>` – Add user to whitelist\n" +
          "`whitelist remove <@user|userId>` – Remove user\n" +
          "`whitelist show` – Show whitelisted users\n";
      }

      return msg.reply(helpMsg);
    }

    // block non-whitelist
    if (!WHITELIST.includes(msg.author.id)) return;

    // ===== MUSIC COMMANDS =====
    if (cmd === "play") {
      try {
        const query = args.join(" ");
        if (!query) return msg.reply("❌ Provide a song");

        // Find voice channel in the same guild as the text channel
        const guild = msg.guild;
        const member = guild.members.cache.get(msg.author.id);
        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) return msg.reply("❌ You must be in a voice channel");

        let player = client.manager.players.get(msg.guild.id);
        if (player) {
          // Clear existing queue and reset settings
          player.queue.clear();
          player.setTrackRepeat(false);
          player.setQueueRepeat(false);
          player.setVolume(100);
          player.setEQ(); // Reset equalizer
        } else {
          player = client.manager.create({
            guild: msg.guild.id,
            voiceChannel: voiceChannel.id,
            textChannel: msg.channel.id,
          });
          player.connect();
        }

        let res;
        try {
          res = await client.manager.search(query, msg.author);
        } catch (err) {
          console.error("🚨 Lavalink search failed:", err);
          return msg.reply("❌ Search failed");
        }
        if (!res || res.loadType === "NO_MATCHES") return msg.reply("❌ No results");

        if (res.loadType === "PLAYLIST_LOADED") {
          player.queue.add(res.tracks);
          if (!player.playing && !player.paused) player.play();
          return msg.reply(`📋 Added **${res.tracks.length}** songs from playlist`);
        }

        const track = res.tracks[0];
        if (!track) return msg.reply("❌ Track not found");
        player.queue.add(track);
        if (!player.playing && !player.paused) player.play();
        return msg.reply(`▶️ Now playing **${track.title}** - \`${formatDuration(track.duration)}\``);
      } catch (err) {
        console.error("🚨 Play command failed:", err);
        return msg.reply("⚠️ Failed to play track");
      }
    }

    if (cmd === "pause") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ Nothing playing");
        if (player.paused) return msg.reply("⚠️ Already paused");
        player.pause(true);
        return msg.reply("⏸️ Paused");
      } catch (err) {
        console.error("🚨 Pause failed:", err);
        return msg.reply("⚠️ Failed to pause");
      }
    }

    if (cmd === "resume") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ Nothing playing");
        if (!player.paused) return msg.reply("⚠️ Not paused");
        player.pause(false);
        return msg.reply("▶️ Resumed");
      } catch (err) {
        console.error("🚨 Resume failed:", err);
        return msg.reply("⚠️ Failed to resume");
      }
    }

    if (cmd === "stop") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ Nothing playing");
        player.destroy();
        return msg.reply("🛑 Stopped and left VC");
      } catch (err) {
        console.error("🚨 Stop failed:", err);
        return msg.reply("⚠️ Failed to stop");
      }
    }

    if (cmd === "skip") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ Nothing playing");
        if (!player.queue.current) return msg.reply("⚠️ No track to skip");
        const current = player.queue.current;
        player.stop();
        return msg.reply(`⏭️ Skipped **${current.title}**`);
      } catch (err) {
        console.error("🚨 Skip failed:", err);
        return msg.reply("⚠️ Failed to skip");
      }
    }

    if (cmd === "queue" || cmd === "q") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ No player");
        if (!player.queue.current) return msg.reply("⚠️ Queue empty");
        const queue = player.queue;
        const current = queue.current;
        let out = `🎵 Now Playing: **${current.title}** - \`${formatDuration(current.duration)}\`\n`;
        if (queue.length > 0) {
          out += "\n📋 Queue:\n";
          queue.slice(0, 10).forEach((t, i) => {
            out += `\`${i + 1}.\` ${t.title} - \`${formatDuration(t.duration)}\`\n`;
          });
          if (queue.length > 10) out += `...and ${queue.length - 10} more`;
        }
        return msg.reply(out);
      } catch (err) {
        console.error("🚨 Queue failed:", err);
        return msg.reply("⚠️ Failed to show queue");
      }
    }

    if (cmd === "nowplaying" || cmd === "np") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player || !player.queue.current) return msg.reply("⚠️ Nothing playing");
        const current = player.queue.current;
        return msg.reply(`🎵 Now Playing: **${current.title}**\n👤 ${current.author}\n⏱️ ${formatDuration(player.position)} / ${formatDuration(current.duration)}\n🔊 Volume: ${player.volume}%`);
      } catch (err) {
        console.error("🚨 NP failed:", err);
        return msg.reply("⚠️ Failed to show now playing");
      }
    }

    if (cmd === "volume") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ No player");
        const volume = parseInt(args[0]);
        if (isNaN(volume)) return msg.reply(`🔊 Volume: **${player.volume}%**`);
        if (volume < 0 || volume > 13000) return msg.reply("❌ Volume must be 0–13000");
        player.setVolume(volume);
        return msg.reply(`🔊 Volume set to **${volume}%**`);
      } catch (err) {
        console.error("🚨 Volume failed:", err);
        return msg.reply("⚠️ Failed to set volume");
      }
    }

    if (cmd === "shuffle") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player || player.queue.length < 2) return msg.reply("⚠️ Not enough songs");
        player.queue.shuffle();
        return msg.reply("🔀 Queue shuffled");
      } catch (err) {
        console.error("🚨 Shuffle failed:", err);
        return msg.reply("⚠️ Failed to shuffle");
      }
    }

    if (cmd === "loop") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ No player");
        const modes = ["none", "track", "queue"];
        const current = player.queueRepeat ? "queue" : player.trackRepeat ? "track" : "none";
        const next = modes[(modes.indexOf(current) + 1) % modes.length];
        player.setTrackRepeat(next === "track");
        player.setQueueRepeat(next === "queue");
        return msg.reply(`🔁 Loop mode: **${next}**`);
      } catch (err) {
        console.error("🚨 Loop failed:", err);
        return msg.reply("⚠️ Failed to toggle loop");
      }
    }

    if (cmd === "clear") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player || player.queue.length === 0) return msg.reply("⚠️ Queue empty");
        player.queue.clear();
        return msg.reply("🗑️ Queue cleared");
      } catch (err) {
        console.error("🚨 Clear failed:", err);
        return msg.reply("⚠️ Failed to clear queue");
      }
    }

    if (cmd === "remove") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ No player");
        const pos = parseInt(args[0]);
        if (!pos || pos < 1 || pos > player.queue.length) return msg.reply(`❌ Invalid position (1–${player.queue.length})`);
        const removed = player.queue.remove(pos - 1);
        return msg.reply(`🗑️ Removed **${removed?.title || "track"}**`);
      } catch (err) {
        console.error("🚨 Remove failed:", err);
        return msg.reply("⚠️ Failed to remove track");
      }
    }

    if (cmd === "seek") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player || !player.queue.current) return msg.reply("⚠️ Nothing playing");
        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0) return msg.reply("❌ Invalid seconds");
        const seekTime = seconds * 1000;
        if (seekTime > player.queue.current.duration) return msg.reply("❌ Seek exceeds duration");
        player.seek(seekTime);
        return msg.reply(`⏩ Seeked to ${formatDuration(seekTime)}`);
      } catch (err) {
        console.error("🚨 Seek failed:", err);
        return msg.reply("⚠️ Failed to seek");
      }
    }

    if (cmd === "lyrics") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player || !player.queue.current) return msg.reply("⚠️ Nothing playing");
        return msg.reply(`🎤 Search lyrics: https://genius.com/search?q=${encodeURIComponent(player.queue.current.title)}`);
      } catch (err) {
        console.error("🚨 Lyrics failed:", err);
        return msg.reply("⚠️ Failed to fetch lyrics link");
      }
    }

    if (cmd === "bassboost") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        if (!player) return msg.reply("⚠️ No player");
        const level = parseInt(args[0]);
        if (isNaN(level) || level < 0 || level > 5) return msg.reply("❌ Level must be 0–5");
        const bands = Array(3).fill(null).map((_, i) => ({ band: i, gain: level / 10 }));
        player.setEQ(...bands);
        return msg.reply(`🎛️ Bass boost level **${level}**`);
      } catch (err) {
        console.error("🚨 Bassboost failed:", err);
        return msg.reply("⚠️ Failed to set bassboost");
      }
    }

    // ===== UTILITY =====
    if (cmd === "ping") {
      try {
        const start = Date.now();
        const message = await msg.reply("🏓 Pinging...");
        const latency = Date.now() - start;
        return message.edit(`🏓 Pong!\n📡 Latency: **${latency}ms**\n💓 API: **${Math.round(client.ws.ping)}ms**`);
      } catch (err) {
        console.error("🚨 Ping failed:", err);
      }
    }

    if (cmd === "stats") {
      try {
        const player = client.manager.players.get(msg.guild.id);
        return msg.reply(`📊 Stats:\n▶️ Playing: ${player?.queue.current?.title || "None"}\n📋 Queue: ${player?.queue.length || 0}\n🔊 Volume: ${player?.volume || 100}%\n👥 Servers: ${client.guilds.cache.size}\n👤 Users: ${client.users.cache.size}\n📡 Ping: ${Math.round(client.ws.ping)}ms\n💾 RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      } catch (err) {
        console.error("🚨 Stats failed:", err);
      }
    }

    if (cmd === "uptime") {
      try {
        const up = process.uptime();
        const days = Math.floor(up / 86400);
        const hours = Math.floor(up / 3600) % 24;
        const mins = Math.floor(up / 60) % 60;
        const secs = Math.floor(up) % 60;
        return msg.reply(`⏰ Uptime: ${days}d ${hours}h ${mins}m ${secs}s`);
      } catch (err) {
        console.error("🚨 Uptime failed:", err);
      }
    }
  } catch (err) {
    console.error(`🚨 Command "${cmd}" crashed:`, err);
    try { await msg.reply("⚠️ An error occurred while executing that command"); } catch {}
  }
});

client.login(token).catch((err) => {
  console.error(`[WORKER] Login failed: ${err.message}`);
  process.exit(1);
});