import discord
from discord.ext import commands
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get bot token and owner ID from environment variables
TOKEN = os.getenv('DISCORD_BOT_TOKEN')
OWNER_ID = int(os.getenv('OWNER_ID'))  # Convert to int as IDs are integers

# File to store whitelist
WHITELIST_FILE = 'whitelist.json'

# Load whitelist from file or initialize with owner ID
def load_whitelist():
    if os.path.exists(WHITELIST_FILE):
        with open(WHITELIST_FILE, 'r') as f:
            whitelist = json.load(f)
            # Ensure owner is always in whitelist
            if OWNER_ID not in whitelist:
                whitelist.append(OWNER_ID)
                save_whitelist(whitelist)
            return whitelist
    return [OWNER_ID]  # Initialize with owner ID if file doesn't exist

# Save whitelist to file
def save_whitelist(whitelist):
    with open(WHITELIST_FILE, 'w') as f:
        json.dump(whitelist, f)

# Initialize whitelist
WHITELIST = load_whitelist()

intents = discord.Intents.default()
intents.message_content = True  # Required for reading message content

bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user} (ID: {bot.user.id})')
    print(f'Current whitelist: {WHITELIST}')
    print('------')

@bot.command(name='j')
async def join_vc(ctx):
    if ctx.author.id not in WHITELIST:
        await ctx.send("TERA BAAP KO BOL KI ROLE DE AMAZE PAPA KO BOL")
        return

    if not ctx.author.voice:
        await ctx.send("You need to be in a voice channel to use this command.")
        return

    channel = ctx.author.voice.channel
    if ctx.voice_client is not None:
        await ctx.voice_client.move_to(channel)
        await ctx.send(f"Moved to {channel.name}.")
    else:
        await channel.connect()
        await ctx.send(f"Joined {channel.name}.")

@bot.command(name='r')
async def remove_vc(ctx):
    if ctx.author.id not in WHITELIST:
        await ctx.send("TERA BAAP KO BOL KI ROLE DE AMAZE PAPA KO BOL.")
        return

    if ctx.voice_client is None:
        await ctx.send("The bot is not connected to any voice channel.")
        return

    await ctx.voice_client.disconnect()
    await ctx.send("Disconnected from the voice channel.")

@bot.command(name='addwhitelist')
async def add_whitelist(ctx, user: discord.User):
    if ctx.author.id != OWNER_ID:
        await ctx.send("TERA BAAP AMAZE HI USE KAR SAKTA HA.")
        return

    if user.id in WHITELIST:
        await ctx.send(f"{user.name} is already whitelisted.")
        return

    WHITELIST.append(user.id)
    save_whitelist(WHITELIST)
    await ctx.send(f"{user.name} has been added to the whitelist.")

@bot.command(name='removewhitelist')
async def remove_whitelist(ctx, user: discord.User):
    if ctx.author.id != OWNER_ID:
        await ctx.send("TERA BAAP AMAZE HI USE KAR SAKTA HA.")
        return

    if user.id not in WHITELIST:
        await ctx.send(f"TU RAND HA ISLIYE WHITELIST ME NHI HA.")
        return

    WHITELIST.remove(user.id)
    save_whitelist(WHITELIST)
    await ctx.send(f"{user.name} has been removed from the whitelist.")

@bot.command(name='whitelist')
async def show_whitelist(ctx):
    if ctx.author.id != OWNER_ID:
        await ctx.send("TERA BAAP HI USE KAR SAKTA HA.")
        return

    if not WHITELIST:
        await ctx.send("The whitelist is empty.")
        return

    whitelist_names = []
    for user_id in WHITELIST:
        user = await bot.fetch_user(user_id)
        whitelist_names.append(user.name)
    await ctx.send(f"Current whitelist: {', '.join(whitelist_names)}")

bot.run(TOKEN)