import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";

const OPENSEA_SHARED_STOREFRONT_ADDRESS = '0x495f947276749Ce646f68AC8c248420045cb7b5e';

const discordBot = new Discord.Client();
const  discordSetup = async (): Promise<TextChannel> => {
  return new Promise<TextChannel>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })
  
    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
      resolve(channel as TextChannel);
    });
  })
}

const buildMessage = (listing: any) => (
  new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(listing.asset.name + ' listed!')
	.setURL(listing.asset.permalink)
	.setAuthor('OpenSea Bot', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png', 'https://github.com/sbauch/opensea-discord-bot')
	.setThumbnail(listing.asset.collection.image_url)
	.addFields(
		{ name: 'Name', value: listing.asset.name },
		{ name: 'Amount', value: `${ethers.utils.formatEther(listing.ending_price || '0')}${ethers.constants.EtherSymbol}`},
		// { name: 'Seller', value: listing?.owner?.address,  },
	)
  .setImage(listing.asset.image_url)
	.setTimestamp(Date.parse(`${listing?.created_date}Z`))
	.setFooter('Listed on OpenSea', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png')
)

async function main() {
  const channel = await discordSetup();
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  
  const params = new URLSearchParams({
    offset: '0',
    event_type: 'created',
    only_opensea: 'false',
    occurred_after: hoursAgo.toString(), 
    collection_slug: process.env.COLLECTION_SLUG!,
  })

  if (process.env.CONTRACT_ADDRESS && process.env.CONTRACT_ADDRESS !== OPENSEA_SHARED_STOREFRONT_ADDRESS) {
    params.append('asset_contract_address', process.env.CONTRACT_ADDRESS!)
  }

  let headers = {
    method: 'GET',
    headers:{
      "X-API-KEY": process.env.OPENSEA_API_KEY
    }
  }

  const openSeaResponse = await fetch(
    "https://api.opensea.io/api/v1/events?" + params, headers).then((resp) => {
      return resp.json();
    });

  return await Promise.all(
    openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
      const message = buildMessage(sale);
      return channel.send(message)
    })
  );   
}

main()
  .then((res) =>{ 
    if (!res.length) console.log("No recent listings.")
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
