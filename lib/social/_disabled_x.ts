// import { TwitterApi } from 'twitter-api-v2';

// export async function getXClient(record: {
//   access_token: string; refresh_token?: string | null; expires_at?: string | null;
// }) {
//   const base = new TwitterApi({
//     clientId: process.env.TWITTER_CLIENT_ID!,
//     clientSecret: process.env.TWITTER_CLIENT_SECRET!,
//   });

//   // Refresh if near expiry
//   if (record.refresh_token && record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
//     const { client, accessToken, refreshToken, expiresIn } = await base.refreshOAuth2Token(record.refresh_token);
//     return {
//       client,
//       updated: {
//         access_token: accessToken,
//         refresh_token: refreshToken || record.refresh_token,
//         expires_at: expiresIn ? new Date(Date.now() + (expiresIn - 60) * 1000).toISOString() : record.expires_at
//       }
//     };
//   }
//   // Use current token
//   const client = new TwitterApi(record.access_token);
//   return { client, updated: null };
// }
