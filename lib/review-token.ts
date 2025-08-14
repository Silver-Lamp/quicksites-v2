// /lib/review-token.ts
export function makeToken(len = 22) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let s = ''; for (let i=0;i<len;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
    return s;
  }
  