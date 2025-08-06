// admin/lib/ensureBlockId.ts
import { v4 as uuidv4 } from 'uuid';

export function ensureBlockId(block: any): any {
  let id = block._id;

  if (typeof id !== 'string') {
    if (typeof id === 'object') {
      if (typeof id._id === 'string') {
        id = id._id;
      } else if (Object.values(id).every(c => typeof c === 'string')) {
        id = Object.values(id).join('');
      } else {
        id = uuidv4();
      }
    } else if (typeof id?.toString === 'function') {
      id = id.toString();
    } else {
      id = uuidv4();
    }
  }

  return {
    ...block,
    _id: id,
  };
}
